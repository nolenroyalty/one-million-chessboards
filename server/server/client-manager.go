package server

// CR nroyalty: think HARD about how to choose ZONE_COUNT vs our snapshot size
// to make sure that clients see all relevant moves but no more than that.

import (
	"log"
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

func (cm *ClientManager) UnregisterClient(client *Client) int32 {
	playingWhite := client.playingWhite.Load()
	if playingWhite {
		cm.whiteCount.Add(-1)
	} else {
		cm.blackCount.Add(-1)
	}
	totalClients := cm.whiteCount.Load() + cm.blackCount.Load()

	cm.Lock()
	defer cm.Unlock()
	oldZones, exists := cm.currentZonesForClient[client]
	if exists {
		for zone := range oldZones {
			delete(cm.clientsByZone[zone.X][zone.Y], client)
		}
	}
	delete(cm.currentZonesForClient, client)
	return totalClients
}

func (cm *ClientManager) UpdateClientPosition(client *Client, pos Position) {
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

func (cm *ClientManager) GetAllClients() map[*Client]struct{} {
	cm.RLock()
	defer cm.RUnlock()
	result := make(map[*Client]struct{}, len(cm.currentZonesForClient))
	for client := range cm.currentZonesForClient {
		result[client] = struct{}{}
	}
	return result
}

func (cm *ClientManager) ReturnClientMap(m map[*Client]struct{}) {
	cm.resultPool.Put(m)
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

func (cm *ClientManager) GetSomeActiveClientPositions(maxCount int) []Position {
	activeClients := make([]Position, 0, maxCount)
	cm.RLock()
	defer cm.RUnlock()
	count := 0
	for client := range cm.currentZonesForClient {
		if client.IsActive() {
			count++
			pos := client.position.Load().(Position)
			activeClients = append(activeClients, pos)
		}
		if count >= maxCount {
			break
		}
	}

	return activeClients
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
