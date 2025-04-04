package server

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	aggregationInterval = time.Second * 30
	statsUpdateInterval = time.Second * 5
)

// Server is the main game server coordinator
type Server struct {
	// Game state
	board      *Board
	zoneMap    *ZoneMap
	minimapAggregator *MinimapAggregator
	clients    map[*Client]struct{}
	
	// Communication channels
	register       chan *Client
	unregister     chan *Client
	getClients     chan CurrentClients
	moveRequests   chan MoveRequest
	subscriptions  chan SubscriptionRequest
	
	// HTTP server components
	upgrader   websocket.Upgrader
}
type zoneOperation struct {
	client *Client
	oldZones map[ZoneCoord]struct{}
	newZones map[ZoneCoord]struct{}
	done chan struct{}
}
type zoneQuery struct {
	zones map[ZoneCoord]struct{}
	response chan map[*Client]struct{}
}
	
// ZoneMap tracks which clients are interested in which zones
type ZoneMap struct {
	clientsByZone [ZONE_COUNT][ZONE_COUNT]map[*Client]struct{}
	operations chan zoneOperation
	queries chan zoneQuery
	resultPool sync.Pool
}

func NewZoneMap() *ZoneMap {
	zm := &ZoneMap{
		operations: make(chan zoneOperation, 1024),
		queries: make(chan zoneQuery, 1024),
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
		case op := <-zm.operations:
			for zone := range op.oldZones {
				delete(zm.clientsByZone[zone.X][zone.Y], op.client)
			}
			for zone := range op.newZones {
				zm.clientsByZone[zone.X][zone.Y][op.client] = struct{}{}
			}
			if (op.done != nil) {
				close(op.done)
			}
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

func (zm *ZoneMap) AddClientToZones(client *Client, newZones map[ZoneCoord]struct{}) {
	op := zoneOperation{
		client: client,
		oldZones: client.currentZones,
		newZones: newZones,
		done: make(chan struct{}),
	}
	zm.operations <- op
}

func (zm *ZoneMap) RemoveClientFromZones(client *Client) {
	op := zoneOperation{
		client: client,
		oldZones: client.currentZones,
		newZones: make(map[ZoneCoord]struct{}),
		done: make(chan struct{}),
	}
	zm.operations <- op
}

// GetClientsForZones returns all clients interested in any of the specified zones
func (zm *ZoneMap) GetClientsForZones(zones map[ZoneCoord]struct{}) map[*Client]struct{} {
	response := make(chan map[*Client]struct{}, 1)
	query := zoneQuery{
		zones: zones,
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

type ZoneCoord struct {
	X uint16
	Y uint16
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
			zone := GetZoneCoord(pos.X + uint16(dx) * ZONE_SIZE, pos.Y + uint16(dy) * ZONE_SIZE)
			relevantZones[zone] = struct{}{}
			
		}
	}
	
	return relevantZones
}

// NewServer creates a new game server
func NewServer() *Server {
	return &Server{
		board:         NewBoard(),
		zoneMap:       NewZoneMap(),
		minimapAggregator: NewMinimapAggregator(),
		clients:       make(map[*Client]struct{}),
		register:      make(chan *Client, 512),
		unregister:    make(chan *Client, 512),
		getClients:    make(chan CurrentClients, 128),
		moveRequests:  make(chan MoveRequest, 1024),
		subscriptions: make(chan SubscriptionRequest, 1024),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
	}
}

// Run starts all server processes
func (s *Server) Run() {

	s.minimapAggregator.Initialize(s.board)
	// Start the specialized processing goroutines
	go s.processMoves()
	go s.handleSubscriptions()
	go s.minimapAggregator.Run()
	go s.sendPeriodicAggregations()
	go s.sendPeriodicStats()
	go s.zoneMap.processZoneMap()
	go s.handleClientRegistrations()
	select {}
}

func (s *Server) sendPeriodicAggregations() {
	log.Printf("beginning periodic aggregations")
	ticker := time.NewTicker(aggregationInterval)
	defer ticker.Stop()

	for range ticker.C {
		log.Printf("Requesting aggregation")
		aggregation := s.minimapAggregator.RequestAggregation()
		log.Printf("Sending periodic aggregation")
		response := <-aggregation
		clientsReq := CurrentClients{response: make(chan map[*Client]struct{})}
		s.getClients <- clientsReq
		clients := <-clientsReq.response
		if (response != nil) {
			for client := range clients {
				client.SendMinimapUpdate(response)
			}
		}
	}
}

type StatsUpdate struct {
	Type string `json:"type"`
	TotalMoves uint64 `json:"totalMoves"`
	WhitePiecesRemaining uint32 `json:"whitePiecesRemaining"`
	BlackPiecesRemaining uint32 `json:"blackPiecesRemaining"`
	WhiteKingsRemaining uint32 `json:"whiteKingsRemaining"`
	BlackKingsRemaining uint32 `json:"blackKingsRemaining"`
}

func (s *Server) createStatsUpdate() StatsUpdate {
	stats := s.board.GetStats()
	return StatsUpdate{
		Type: "globalStats",
		TotalMoves: stats.TotalMoves,
		WhitePiecesRemaining: stats.WhitePiecesRemaining,
		BlackPiecesRemaining: stats.BlackPiecesRemaining,
		WhiteKingsRemaining: stats.WhiteKingsRemaining,
		BlackKingsRemaining: stats.BlackKingsRemaining,
	}
}

func (s *Server) sendPeriodicStats() {
	log.Printf("beginning periodic stats")
	ticker := time.NewTicker(statsUpdateInterval)
	defer ticker.Stop()

	for range ticker.C {
		statsUpdate := s.createStatsUpdate()
		statsJson, err := json.Marshal(statsUpdate)
		if err != nil {
			log.Printf("Error marshalling stats: %v", err)
			continue
		}
		clientsReq := CurrentClients{response: make(chan map[*Client]struct{})}
		s.getClients <- clientsReq
		clients := <-clientsReq.response
		for client := range clients {
			client.SendGlobalStats(statsJson)
		}
	}
}

func (s *Server) RequestStatsSnapshot() json.RawMessage {
	stats := s.createStatsUpdate()
	statsJson, err := json.Marshal(stats)
	if err != nil {
		log.Printf("Error marshalling stats: %v", err)
		return nil
	}
	return statsJson
}

func (s *Server) RequestStaleAggregation() json.RawMessage {
	resp := s.minimapAggregator.GetCachedAggregation()
	return resp
}

// processMoves handles move validation and application
// PERFORMANCE: there are a few allocations here; if we're running into
// issues we could avoid allocations
func (s *Server) processMoves() {
	for moveReq := range s.moveRequests {
		// Validate the move
		moveResult := s.board.ValidateAndApplyMove(moveReq.Move)
		if !moveResult.Valid {
			log.Printf("Move request invalid")
			moveReq.Client.SendError("Invalid move")
			continue
		}
		movedPiece := moveResult.MovedPiece
		capturedPiece := moveResult.CapturedPiece

		pieceMove := PieceMove{
			PieceID:   movedPiece.ID,
			FromX:     moveReq.Move.FromX,
			FromY:     moveReq.Move.FromY,
			ToX:       moveReq.Move.ToX,
			ToY:       moveReq.Move.ToY,
			PieceType: movedPiece.Type,
			IsWhite:   movedPiece.IsWhite,
			MoveState: movedPiece.MoveState,
			SeqNum:    moveResult.SeqNum,
		}

		affectedZones := s.zoneMap.GetAffectedZones(moveReq.Move)
		interestedClients := s.zoneMap.GetClientsForZones(affectedZones)
		var captureMove *PieceCapture = nil;
		if capturedPiece != nil {
			captureMove = &PieceCapture{
				CapturedPieceID: capturedPiece.ID,
				X:               moveReq.Move.ToX,
				Y:               moveReq.Move.ToY,
				CapturedType:    capturedPiece.Type,
				WasWhite:        capturedPiece.IsWhite,
				CapturingPieceID: movedPiece.ID,
				SeqNum:           moveResult.SeqNum,
			}
		}

		log.Printf("Updating minimap aggregator")
		s.minimapAggregator.UpdateForMove(&pieceMove, captureMove)
		
		// Run client notifications in a separate goroutine
		go func(clients map[*Client]struct{}, move PieceMove, capture *PieceCapture) {
			for client := range clients {
				client.AddMoveToBuffer(move)
			}
			if capture != nil {
				for client := range clients {
					client.AddCaptureToBuffer(*capture)
				}
			}
			s.zoneMap.ReturnClientMap(interestedClients)
		}(interestedClients, pieceMove, captureMove)
	}
}


// handleSubscriptions processes client subscription requests
// CR nroyalty: this should all just live in client.go at this
// point?
func (s *Server) handleSubscriptions() {
	for sub := range s.subscriptions {
		// Update the client's position
		sub.Client.position = Position{X: sub.Zone.X, Y: sub.Zone.Y}
		
		zones := GetRelevantZones(sub.Client.position)
		s.zoneMap.AddClientToZones(sub.Client, zones)
		sub.Client.currentZones = zones

		// CR nroyalty: only send a new snapshot if the client has moved a lot?
		// maybe we can handle this with client-side logic...

		// Send an initial state snapshot
		snapshot := s.board.GetStateForPosition(sub.Client.position)
		sub.Client.SendStateSnapshot(snapshot)
	}
}

type CurrentClients struct {
	response chan map[*Client]struct{}
}

func (s *Server) handleClientRegistrations() {
	for {
		select {
			case client := <-s.register:
				s.clients[client] = struct{}{}
				log.Printf("Client registered, total: %d", len(s.clients))
				go client.Run()
			case client := <-s.unregister:
				delete(s.clients, client)
				log.Printf("Client unregistered, total: %d", len(s.clients))
				go func() {
					s.zoneMap.RemoveClientFromZones(client)
					client.Close()
				}()
			case req := <-s.getClients:
				clientsCopy := make(map[*Client]struct{}, len(s.clients))
				for client := range s.clients {
					clientsCopy[client] = struct{}{}
				}
				req.response <- clientsCopy
		}
	}
}

// ServeWs handles websocket requests from clients
func (s *Server) ServeWs(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	
	// Create a new client
	client := NewClient(conn, s)
	
	// Register the client
	s.register <- client
}

// ServeHTTP serves the static HTML/JS/CSS files
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request, staticDir string) {
	if r.URL.Path == "/ws" {
		s.ServeWs(w, r)
		return
	}
	
	// Serve static files
	http.FileServer(http.Dir(staticDir)).ServeHTTP(w, r)
}

// InitializeBoards sets up a number of random boards for testing
// func (s *Server) InitializeBoards(count int) {
// 	// Initialize some random boards for testing
// 	for i := range count {
// 		boardX := uint16(i % 100)
// 		boardY := uint16(i / 100)
// 		s.board.ResetBoardSection(boardX, boardY, false, false)
// 	}
// }

func (s *Server) InitializeBoard() {
	// startX := uint16(40)
	// startY := uint16(40)
	// for dx := range 30 {
	// 	for dy := range 30 {
	// 		s.board.ResetBoardSection(startX + uint16(dx), startY + uint16(dy), false, false)
	// 	}
	// }
	startX := uint16(0)
	startY := uint16(0)
	for dx := range 1000 {
		for dy := range 1000 {
			random := rand.Intn(1500)
			includeWhite := random > dy;
			includeBlack := random > dx;
			// includeWhite := random < 50
			// includeBlack := random >= 50
			s.board.ResetBoardSection(startX + uint16(dx), startY + uint16(dy), includeWhite, includeBlack)
		}
	}
}

func (s *Server) Testing_GetPiece(x, y uint16) *Piece {
	return s.board.GetPiece(x, y)
}
