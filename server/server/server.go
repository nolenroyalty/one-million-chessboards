package server

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// Server is the main game server coordinator
type Server struct {
	// Game state
	board      *Board
	zoneMap    *ZoneMap
	clients    map[*Client]struct{}
	clientsMu  sync.RWMutex
	
	// Communication channels
	register       chan *Client
	unregister     chan *Client
	moveRequests   chan MoveRequest
	subscriptions  chan SubscriptionRequest
	
	// HTTP server components
	upgrader   websocket.Upgrader
}

/* CR nroyalty: remove clientsMu lock, rework to use channels */


// ZoneMap tracks which clients are interested in which zones
type ZoneMap struct {
	// Map from zone IDs to sets of clients
	clientsByZone [ZONE_COUNT][ZONE_COUNT]map[*Client]struct{}
	mu            sync.RWMutex
}

// NewZoneMap creates a new zone map
func NewZoneMap() *ZoneMap {
	zm := &ZoneMap{}
	
	// Initialize each map in the 2D array
	for i := range ZONE_COUNT {
		for j := range ZONE_COUNT {
			zm.clientsByZone[i][j] = make(map[*Client]struct{})
		}
	}
	
	return zm
}

// AddClient adds a client to the specified zones
func (zm *ZoneMap) AddClient(client *Client, zones map[ZoneCoord]struct{}) {
	zm.mu.Lock()
	defer zm.mu.Unlock()

	for zone, _ := range client.currentZones {
		log.Printf("Removing client from zone: %v", zone)
		delete(zm.clientsByZone[zone.X][zone.Y], client)
	}

	for zone, _ := range zones {
		log.Printf("Adding client to zone: %v", zone)
		zm.clientsByZone[zone.X][zone.Y][client] = struct{}{}
	}
}

// RemoveClient removes a client from all zones
func (zm *ZoneMap) RemoveClient(client *Client) {
	zm.mu.Lock()
	defer zm.mu.Unlock()
	
	for zone, _ := range client.currentZones {
		delete(zm.clientsByZone[zone.X][zone.Y], client)
	}
}

// GetClientsForZones returns all clients interested in any of the specified zones
func (zm *ZoneMap) GetClientsForZones(zones map[ZoneCoord]struct{}) map[*Client]struct{} {
	zm.mu.RLock()
	defer zm.mu.RUnlock()
	
	result := make(map[*Client]struct{})
	
	for zone, _ := range zones {
		for client := range zm.clientsByZone[zone.X][zone.Y] {
			result[client] = struct{}{}
		}
	}
	
	return result
}

// GetAffectedZones returns all zones affected by a move
func (zm *ZoneMap) GetAffectedZones(move Move) map[ZoneCoord]struct{} {
	// Get zones for both the source and destination positions
	fromZone := GetZoneCoord(move.FromX, move.FromY)
	toZone := GetZoneCoord(move.ToX, move.ToY)
	
	// If they're the same, return a single zone
	if fromZone == toZone {
		return map[ZoneCoord]struct{}{fromZone: {}}
	}
	
	// Otherwise return both
	return map[ZoneCoord]struct{}{fromZone: {}, toZone: {}}
}

// ZoneCoord represents a zone coordinate pair
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
		clients:       make(map[*Client]struct{}),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		moveRequests:  make(chan MoveRequest),
		subscriptions: make(chan SubscriptionRequest),
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
	
	// Start the specialized processing goroutines
	go s.processMoves()
	go s.handleSubscriptions()
	
	// Main goroutine handles client registration/disconnection
	for {
		select {
		case client := <-s.register:
			s.registerClient(client)
			
		case client := <-s.unregister:
			s.unregisterClient(client)
		}
	}
}

// processMoves handles move validation and application
// PERFORMANCE: there are a few allocations here; if we're running into
// issues we could avoid allocations
func (s *Server) processMoves() {
	for moveReq := range s.moveRequests {
		log.Printf("Processing move request")
		// Validate the move
		moveResult := s.board.ValidateAndApplyMove(moveReq.Move)
		if !moveResult.Valid {
			log.Printf("Move request invalid")
			moveReq.Client.SendError("Invalid move")
			continue
		}
		log.Printf("Move request validated")
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
		}(interestedClients, pieceMove, captureMove)
	}
}


// handleSubscriptions processes client subscription requests
func (s *Server) handleSubscriptions() {
	for sub := range s.subscriptions {
		// Update the client's position
		sub.Client.position = Position{X: sub.Zone.X, Y: sub.Zone.Y}
		
		// Calculate which zones the client should be subscribed to
		zones := GetRelevantZones(sub.Client.position)

		log.Printf("Client subscribed to zones: %v", zones)
		
		// Update the zone map
		s.zoneMap.AddClient(sub.Client, zones)
		
		// Update the client's record of its zones
		sub.Client.currentZones = zones
		
		// Send an initial state snapshot
		snapshot := s.board.GetStateForPosition(sub.Client.position)
		sub.Client.SendStateSnapshot(snapshot)
	}
}

// registerClient adds a new client to the server
func (s *Server) registerClient(client *Client) {
	s.clientsMu.Lock()
	s.clients[client] = struct{}{}
	s.clientsMu.Unlock()

	go client.Run()

	log.Printf("Client connected, total: %d", len(s.clients))
}

// unregisterClient removes a client from the server
func (s *Server) unregisterClient(client *Client) {
	s.clientsMu.Lock()
	delete(s.clients, client)
	s.clientsMu.Unlock()
	// Remove from zone mapping
	s.zoneMap.RemoveClient(client)

	client.Close()
	
	log.Printf("Client disconnected, total: %d", len(s.clients))
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
			s.board.ResetBoardSection(startX + uint16(dx), startY + uint16(dy), false, false)
		}
	}
}

func (s *Server) Testing_GetPiece(x, y uint16) *Piece {
	return s.board.GetPiece(x, y)
}
