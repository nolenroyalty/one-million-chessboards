package server

import "sync"

type ZoneCoord struct {
	X uint16
	Y uint16
}

type ZoneMap struct {
	sync.RWMutex
	clientsByZone         [ZONE_COUNT][ZONE_COUNT]map[*Client]struct{}
	currentZonesForClient map[*Client]map[ZoneCoord]struct{}
	resultPool            sync.Pool
}

func NewZoneMap() *ZoneMap {
	zm := &ZoneMap{
		currentZonesForClient: make(map[*Client]map[ZoneCoord]struct{}),
		resultPool: sync.Pool{
			New: func() interface{} {
				return make(map[*Client]struct{}, 64)
			},
		},
	}

	for i := range ZONE_COUNT {
		for j := range ZONE_COUNT {
			zm.clientsByZone[i][j] = make(map[*Client]struct{})
		}
	}

	return zm
}

func (zm *ZoneMap) AddClientToZones(client *Client, pos Position) {
	newZones := GetRelevantZones(pos)

	zm.Lock()
	defer zm.Unlock()
	oldZones, exists := zm.currentZonesForClient[client]
	if exists {
		for zone := range oldZones {
			delete(zm.clientsByZone[zone.X][zone.Y], client)
		}
	}
	zm.currentZonesForClient[client] = newZones

	for zone := range newZones {
		zm.clientsByZone[zone.X][zone.Y][client] = struct{}{}
	}
}

func (zm *ZoneMap) RemoveClient(client *Client) {
	zm.Lock()
	defer zm.Unlock()
	oldZones, exists := zm.currentZonesForClient[client]
	if exists {
		for zone := range oldZones {
			delete(zm.clientsByZone[zone.X][zone.Y], client)
		}
	}
	delete(zm.currentZonesForClient, client)
}

func (zm *ZoneMap) GetClientsForZones(zones map[ZoneCoord]struct{}) map[*Client]struct{} {
	zm.RLock()
	defer zm.RUnlock()
	resultMap := zm.resultPool.Get().(map[*Client]struct{})
	for k := range resultMap {
		delete(resultMap, k)
	}
	for zone := range zones {
		for client := range zm.clientsByZone[zone.X][zone.Y] {
			resultMap[client] = struct{}{}
		}
	}
	return resultMap
}

func (zm *ZoneMap) ReturnClientMap(m map[*Client]struct{}) {
	zm.resultPool.Put(m)
}

func (zm *ZoneMap) GetAffectedZones(move Move) map[ZoneCoord]struct{} {
	fromZone := GetZoneCoord(move.FromX, move.FromY)
	toZone := GetZoneCoord(move.ToX, move.ToY)

	// If they're the same, return a single zone
	if fromZone == toZone {
		return map[ZoneCoord]struct{}{fromZone: {}}
	}

	return map[ZoneCoord]struct{}{fromZone: {}, toZone: {}}
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
