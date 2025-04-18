package server

import "sync"

type ZoneCoord struct {
	X uint16
	Y uint16
}

type zoneAddition struct {
	client   *Client
	newZones map[ZoneCoord]struct{}
}

type clientRemoval struct {
	client *Client
}

type zoneQuery struct {
	zones    map[ZoneCoord]struct{}
	response chan map[*Client]struct{}
}

// ZoneMap tracks which clients are interested in which zones
type ZoneMap struct {
	clientsByZone         [ZONE_COUNT][ZONE_COUNT]map[*Client]struct{}
	currentZonesForClient map[*Client]map[ZoneCoord]struct{}
	additions             chan zoneAddition
	removals              chan clientRemoval
	queries               chan zoneQuery
	resultPool            sync.Pool
}

func NewZoneMap() *ZoneMap {
	zm := &ZoneMap{
		additions:             make(chan zoneAddition, 1024),
		removals:              make(chan clientRemoval, 1024),
		queries:               make(chan zoneQuery, 1024),
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

func (zm *ZoneMap) processZoneMap() {
	for {
		select {
		case op := <-zm.additions:
			oldZones, exists := zm.currentZonesForClient[op.client]
			if exists {
				for zone := range oldZones {
					delete(zm.clientsByZone[zone.X][zone.Y], op.client)
				}
			}
			zm.currentZonesForClient[op.client] = op.newZones

			for zone := range op.newZones {
				zm.clientsByZone[zone.X][zone.Y][op.client] = struct{}{}
			}
		case op := <-zm.removals:
			delete(zm.currentZonesForClient, op.client)
		case query := <-zm.queries:
			resultMap := zm.resultPool.Get().(map[*Client]struct{})
			for k := range resultMap {
				delete(resultMap, k)
			}
			for zone := range query.zones {
				for client := range zm.clientsByZone[zone.X][zone.Y] {
					resultMap[client] = struct{}{}
				}
			}
			query.response <- resultMap
		}
	}
}

func (zm *ZoneMap) AddClientToZones(client *Client, pos Position) {
	newZones := GetRelevantZones(pos)
	op := zoneAddition{
		client:   client,
		newZones: newZones,
	}
	zm.additions <- op
}

func (zm *ZoneMap) RemoveClient(client *Client) {
	op := clientRemoval{
		client: client,
	}
	zm.removals <- op
}

func (zm *ZoneMap) GetClientsForZones(zones map[ZoneCoord]struct{}) map[*Client]struct{} {
	response := make(chan map[*Client]struct{}, 1)
	query := zoneQuery{
		zones:    zones,
		response: response,
	}
	zm.queries <- query
	result := <-response

	return result
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
