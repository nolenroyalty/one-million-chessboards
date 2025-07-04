package server

import (
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
)

type ZoneCoord struct {
	X uint16
	Y uint16
}

type ClientManager struct {
	sync.RWMutex
	clientsByZone         [ZONE_COUNT][ZONE_COUNT]map[*Client]struct{}
	currentZonesForClient map[*Client]map[ZoneCoord]struct{}
	whiteCount            atomic.Int32
	blackCount            atomic.Int32
	resultPool            sync.Pool
}

func NewClientManager() *ClientManager {
	cm := &ClientManager{
		currentZonesForClient: make(map[*Client]map[ZoneCoord]struct{}),
		resultPool: sync.Pool{
			New: func() interface{} {
				return make(map[*Client]struct{}, 64)
			},
		},
	}

	for i := range ZONE_COUNT {
		for j := range ZONE_COUNT {
			cm.clientsByZone[i][j] = make(map[*Client]struct{})
		}
	}

	return cm
}

func (cm *ClientManager) RegisterClient(client *Client, pos Position, playingWhite bool) {
	if playingWhite {
		cm.whiteCount.Add(1)
	} else {
		cm.blackCount.Add(1)
	}

	cm.Lock()
	defer cm.Unlock()

	oldZones, exists := cm.currentZonesForClient[client]
	if exists {
		log.Printf("BUG? Registering client that is already registered")
		for zone := range oldZones {
			delete(cm.clientsByZone[zone.X][zone.Y], client)
		}
	}
	zones := GetRelevantZones(pos)
	cm.currentZonesForClient[client] = zones
	for zone := range zones {
		cm.clientsByZone[zone.X][zone.Y][client] = struct{}{}
	}
}

func (cm *ClientManager) UnregisterClient(client *Client) {
	playingWhite := client.playingWhite.Load()
	if playingWhite {
		cm.whiteCount.Add(-1)
	} else {
		cm.blackCount.Add(-1)
	}

	cm.Lock()
	defer cm.Unlock()
	oldZones, exists := cm.currentZonesForClient[client]
	if exists {
		for zone := range oldZones {
			delete(cm.clientsByZone[zone.X][zone.Y], client)
		}
	}

	delete(cm.currentZonesForClient, client)
}

func (cm *ClientManager) UpdateClientPosition(client *Client, pos Position, oldPos Position) {
	// no need to take the lock if the client is just scrolling around in their current zone
	fromZone := GetZoneCoord(oldPos.X, oldPos.Y)
	toZone := GetZoneCoord(pos.X, pos.Y)
	if fromZone == toZone {
		return
	}

	newZones := GetRelevantZones(pos)

	cm.Lock()
	defer cm.Unlock()
	oldZones, exists := cm.currentZonesForClient[client]
	if exists {
		for zone := range oldZones {
			delete(cm.clientsByZone[zone.X][zone.Y], client)
		}
	}
	cm.currentZonesForClient[client] = newZones

	for zone := range newZones {
		cm.clientsByZone[zone.X][zone.Y][client] = struct{}{}
	}
}

func (cm *ClientManager) GetClientsForZones(zones map[ZoneCoord]struct{}) map[*Client]struct{} {
	resultMap := cm.resultPool.Get().(map[*Client]struct{})
	for k := range resultMap {
		delete(resultMap, k)
	}

	cm.RLock()
	defer cm.RUnlock()
	for zone := range zones {
		for client := range cm.clientsByZone[zone.X][zone.Y] {
			resultMap[client] = struct{}{}
		}
	}
	return resultMap
}

func (cm *ClientManager) ReturnClientMap(m map[*Client]struct{}) {
	cm.resultPool.Put(m)
}

func (cm *ClientManager) AffectedZonesForAdoption(adoptionRequest *adoptionRequest) map[ZoneCoord]struct{} {
	fromZone := GetZoneCoord(adoptionRequest.StartingX(), adoptionRequest.StartingY())
	endingZone := GetZoneCoord(adoptionRequest.EndingX(), adoptionRequest.EndingY())

	if fromZone == endingZone {
		return map[ZoneCoord]struct{}{fromZone: {}}
	}

	return map[ZoneCoord]struct{}{fromZone: {}, endingZone: {}}
}

func (cm *ClientManager) AffectedZonesForBulkCapture(bulkCaptureRequest *bulkCaptureRequest) map[ZoneCoord]struct{} {
	fromZone := GetZoneCoord(bulkCaptureRequest.StartingX(), bulkCaptureRequest.StartingY())
	endingZone := GetZoneCoord(bulkCaptureRequest.EndingX(), bulkCaptureRequest.EndingY())

	if fromZone == endingZone {
		return map[ZoneCoord]struct{}{fromZone: {}}
	}

	return map[ZoneCoord]struct{}{fromZone: {}, endingZone: {}}
}

func (cm *ClientManager) GetAffectedZones(move Move) map[ZoneCoord]struct{} {
	fromZone := GetZoneCoord(move.FromX, move.FromY)
	toZone := GetZoneCoord(move.ToX, move.ToY)

	// If they're the same, return a single zone
	if fromZone == toZone {
		return map[ZoneCoord]struct{}{fromZone: {}}
	}

	return map[ZoneCoord]struct{}{fromZone: {}, toZone: {}}
}

func (cm *ClientManager) GetClientCount() int32 {
	return cm.whiteCount.Load() + cm.blackCount.Load()
}

func (cm *ClientManager) GetWhiteCount() int32 {
	return cm.whiteCount.Load()
}

func (cm *ClientManager) GetBlackCount() int32 {
	return cm.blackCount.Load()
}

func (cm *ClientManager) GetRandomActiveClientPosition() (Position, bool) {
	cm.RLock()
	defer cm.RUnlock()

	// Reservoir sampling with k=1
	// Thank you to https://samwho.dev/reservoir-sampling/ for teaching me this!
	var selectedClient *Client
	activeCount := 0
	totalCount := 0
	const maxActiveClientsToConsider = 100
	const maxTotalClientsToConsider = 500

	for client := range cm.currentZonesForClient {
		totalCount++
		if totalCount > maxTotalClientsToConsider {
			break
		}
		if client.IsActive() {
			activeCount++
			// With probability 1/count, replace the selected client
			if rand.Intn(activeCount) == 0 {
				selectedClient = client
			}
			if activeCount >= maxActiveClientsToConsider {
				break
			}
		}
	}

	if selectedClient == nil {
		return Position{}, false
	}

	return selectedClient.position.Load().(Position), true
}

func GetZoneCoord(x, y uint16) ZoneCoord {
	zoneX := x / ZONE_SIZE
	zoneY := y / ZONE_SIZE
	zoneX = min(zoneX, ZONE_COUNT-1)
	zoneY = min(zoneY, ZONE_COUNT-1)
	zoneX = max(zoneX, 0)
	zoneY = max(zoneY, 0)
	return ZoneCoord{X: zoneX, Y: zoneY}
}

func GetRelevantZones(pos Position) map[ZoneCoord]struct{} {
	// Calculate the center zone for the position
	centerZone := GetZoneCoord(pos.X, pos.Y)

	relevantZones := make(map[ZoneCoord]struct{})

	relevantZones[centerZone] = struct{}{}

	for dx := -1; dx <= 1; dx++ {
		for dy := -1; dy <= 1; dy++ {
			zone := GetZoneCoord(pos.X+uint16(dx)*ZONE_SIZE, pos.Y+uint16(dy)*ZONE_SIZE)
			relevantZones[zone] = struct{}{}

		}
	}

	return relevantZones
}
