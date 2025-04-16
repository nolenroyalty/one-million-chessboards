package server

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

const (
	aggregationInterval = time.Second * 30
	statsUpdateInterval = time.Second * 5
)

type ColorPreference int

const (
	ColorPreferenceWhite ColorPreference = iota
	ColorPreferenceBlack
	ColorPreferenceRandom
)

type RegistrationRequest struct {
	Client          *Client
	ColorPreference ColorPreference
	RequestedXCoord int16
	RequestedYCoord int16
}

// Server is the main game server coordinator
type Server struct {
	// Game state
	board             *Board
	persistentBoard   *PersistentBoard
	zoneMap           *ZoneMap
	minimapAggregator *MinimapAggregator
	clients           map[*Client]struct{}

	// Communication channels
	register       chan *RegistrationRequest
	unregister     chan *Client
	getClients     chan CurrentClients
	moveRequests   chan MoveRequest
	subscriptions  chan SubscriptionRequest
	whiteCount     atomic.Uint32
	blackCount     atomic.Uint32
	connectedUsers atomic.Uint32
	// HTTP server components
	upgrader websocket.Upgrader
}
type zoneOperation struct {
	client   *Client
	oldZones map[ZoneCoord]struct{}
	newZones map[ZoneCoord]struct{}
	done     chan struct{}
}
type zoneQuery struct {
	zones    map[ZoneCoord]struct{}
	response chan map[*Client]struct{}
}

// ZoneMap tracks which clients are interested in which zones
type ZoneMap struct {
	clientsByZone [ZONE_COUNT][ZONE_COUNT]map[*Client]struct{}
	operations    chan zoneOperation
	queries       chan zoneQuery
	resultPool    sync.Pool
}

func NewZoneMap() *ZoneMap {
	zm := &ZoneMap{
		operations: make(chan zoneOperation, 1024),
		queries:    make(chan zoneQuery, 1024),
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
			if op.done != nil {
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
		client:   client,
		oldZones: client.currentZones,
		newZones: newZones,
		done:     make(chan struct{}),
	}
	zm.operations <- op
}

func (zm *ZoneMap) RemoveClientFromZones(client *Client) {
	op := zoneOperation{
		client:   client,
		oldZones: client.currentZones,
		newZones: make(map[ZoneCoord]struct{}),
		done:     make(chan struct{}),
	}
	zm.operations <- op
}

// GetClientsForZones returns all clients interested in any of the specified zones
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
			zone := GetZoneCoord(pos.X+uint16(dx)*ZONE_SIZE, pos.Y+uint16(dy)*ZONE_SIZE)
			relevantZones[zone] = struct{}{}

		}
	}

	return relevantZones
}

// NewServer creates a new game server
func NewServer(stateDir string) *Server {
	persistentBoard := NewPersistentBoard(stateDir)
	board := persistentBoard.GetBoardCopy()
	s := &Server{
		board:             board,
		persistentBoard:   persistentBoard,
		zoneMap:           NewZoneMap(),
		minimapAggregator: NewMinimapAggregator(),
		clients:           make(map[*Client]struct{}),
		register:          make(chan *RegistrationRequest, 512),
		unregister:        make(chan *Client, 512),
		getClients:        make(chan CurrentClients, 128),
		moveRequests:      make(chan MoveRequest, 1024),
		subscriptions:     make(chan SubscriptionRequest, 1024),
		whiteCount:        atomic.Uint32{},
		blackCount:        atomic.Uint32{},
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
	}
	s.whiteCount.Store(0)
	s.blackCount.Store(0)
	return s
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
	go s.persistentBoard.Run()
	select {}
}

func (s *Server) sendPeriodicAggregations() {
	log.Printf("beginning periodic aggregations")
	ticker := time.NewTicker(aggregationInterval)
	defer ticker.Stop()

	for range ticker.C {
		aggregation := s.minimapAggregator.RequestAggregation()
		response := <-aggregation
		clientsReq := CurrentClients{response: make(chan map[*Client]struct{})}
		s.getClients <- clientsReq
		clients := <-clientsReq.response
		if response != nil {
			for client := range clients {
				client.SendMinimapUpdate(response)
			}
		}
	}
}

type StatsUpdate struct {
	Type                 string `json:"type"`
	TotalMoves           uint64 `json:"totalMoves"`
	WhitePiecesRemaining uint32 `json:"whitePiecesRemaining"`
	BlackPiecesRemaining uint32 `json:"blackPiecesRemaining"`
	WhiteKingsRemaining  uint32 `json:"whiteKingsRemaining"`
	BlackKingsRemaining  uint32 `json:"blackKingsRemaining"`
	ConnectedUsers       uint32 `json:"connectedUsers"`
}

func (s *Server) createStatsUpdate() StatsUpdate {
	stats := s.board.GetStats()
	return StatsUpdate{
		Type:                 "globalStats",
		TotalMoves:           stats.TotalMoves,
		WhitePiecesRemaining: stats.WhitePiecesRemaining,
		BlackPiecesRemaining: stats.BlackPiecesRemaining,
		WhiteKingsRemaining:  stats.WhiteKingsRemaining,
		BlackKingsRemaining:  stats.BlackKingsRemaining,
		ConnectedUsers:       s.connectedUsers.Load(),
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

func (s *Server) processMoves() {
	for moveReq := range s.moveRequests {
		// Validate the move
		moveResult := s.board.ValidateAndApplyMove(moveReq.Move)
		if !moveResult.Valid {
			moveReq.Client.SendInvalidMove(moveReq.Move.MoveToken)
			continue
		}
		if moveResult.CapturedPiece.Piece.IsEmpty() {
			moveReq.Client.SendValidMove(moveReq.Move.MoveToken, moveResult.Seqnum, 0)
		} else {
			moveReq.Client.SendValidMove(moveReq.Move.MoveToken, moveResult.Seqnum, moveResult.CapturedPiece.Piece.ID)
		}

		capturedPiece := moveResult.CapturedPiece
		movedPieces := make([]PieceMove, moveResult.Length)
		for i := 0; i < int(moveResult.Length); i++ {
			s.minimapAggregator.UpdateForMove(moveResult.MovedPieces[i].FromX,
				moveResult.MovedPieces[i].FromY,
				moveResult.MovedPieces[i].ToX,
				moveResult.MovedPieces[i].ToY,
				moveResult.MovedPieces[i].Piece)
			movedPieces[i] = PieceMove{
				PieceID:      moveResult.MovedPieces[i].Piece.ID,
				ToX:          moveResult.MovedPieces[i].ToX,
				ToY:          moveResult.MovedPieces[i].ToY,
				PieceType:    moveResult.MovedPieces[i].Piece.Type,
				IsWhite:      moveResult.MovedPieces[i].Piece.IsWhite,
				MoveCount:    moveResult.MovedPieces[i].Piece.MoveCount,
				CaptureCount: moveResult.MovedPieces[i].Piece.CaptureCount,
				Seqnum:       moveResult.Seqnum,
			}
		}

		var captureMove *PieceCapture = nil
		if !capturedPiece.Piece.IsEmpty() {
			s.minimapAggregator.UpdateForCapture(capturedPiece.X,
				capturedPiece.Y, capturedPiece.Piece)

			captureMove = &PieceCapture{
				CapturedPieceID: capturedPiece.Piece.ID,
				Seqnum:          moveResult.Seqnum,
			}
		}

		s.persistentBoard.ApplyMove(moveReq.Move, moveResult.Seqnum)

		// CR nroyalty: this could block; move it to the background goroutine instead
		// More generally, think about the buffers we have here
		affectedZones := s.zoneMap.GetAffectedZones(moveReq.Move)
		interestedClients := s.zoneMap.GetClientsForZones(affectedZones)

		// CR nroyalty: is there a way we can avoid the overhead of re-serializing a move
		// for each client here? It's annoying that we might end up doing the same serialization
		// for 100 different clients if they're looking at the same zones.
		go func(clients map[*Client]struct{}, moves []PieceMove, capture *PieceCapture) {
			for client := range clients {
				client.AddMovesToBuffer(moves, capture)
			}
			s.zoneMap.ReturnClientMap(interestedClients)
		}(interestedClients, movedPieces, captureMove)
	}
}

func (s *Server) handleSubscriptions() {
	for sub := range s.subscriptions {
		pos := sub.Position
		zones := GetRelevantZones(pos)
		s.zoneMap.AddClientToZones(sub.Client, zones)
		sub.Client.UpdatePositionAndMaybeSnapshot(zones, pos)
	}
}

type CurrentClients struct {
	response chan map[*Client]struct{}
}

func applyColorPref(colorPref ColorPreference) bool {
	switch colorPref {
	case ColorPreferenceWhite:
		return true
	case ColorPreferenceBlack:
		return false
	default:
		return rand.Intn(2) == 0
	}
}

func (s *Server) DetermineColor(colorPref ColorPreference) bool {
	whiteCount := s.whiteCount.Load()
	blackCount := s.blackCount.Load()
	total := whiteCount + blackCount
	if total == 0 {
		return applyColorPref(colorPref)
	}
	diff := math.Abs(float64(int(whiteCount) - int(blackCount)))
	pct := diff / float64(total)
	if pct > 0.1 {
		if whiteCount > blackCount {
			return false
		} else {
			return true
		}
	}
	return applyColorPref(colorPref)
}

var DEFAULT_COORD_ARRAY = [][]int{
	{500, 500},
	{2000, 2000},
	{4500, 4500},
	{3000, 1500},
	{1000, 2000},
	{2000, 1000},
}

const (
	BOARD_EDGE_BUFFER = 20
	BOARD_MAX_COORD   = BOARD_SIZE - BOARD_EDGE_BUFFER - 1
	BOARD_MIN_COORD   = BOARD_EDGE_BUFFER
	POSITION_JITTER   = 4
)

func IncrOrDecrPosition(n uint16) uint16 {
	if rand.Intn(2) == 0 {
		if n < BOARD_MAX_COORD {
			return n + POSITION_JITTER
		}
	} else {
		if n > BOARD_MIN_COORD {
			return n - POSITION_JITTER
		}
	}
	return n
}

func (s *Server) GetDefaultCoords() Position {
	activeClientPositions := make([]Position, 0, 100)
	count := 0
	for client := range s.clients {
		if count > 100 {
			break
		}
		if client.IsActive() {
			pos := client.position.Load().(Position)
			activeClientPositions = append(activeClientPositions, pos)
			count++
		}
	}

	if len(activeClientPositions) == 0 {
		idx := rand.Intn(len(DEFAULT_COORD_ARRAY))
		return Position{X: uint16(DEFAULT_COORD_ARRAY[idx][0]), Y: uint16(DEFAULT_COORD_ARRAY[idx][1])}
	}

	idx := rand.Intn(len(activeClientPositions))
	pos := activeClientPositions[idx]
	pos.X = IncrOrDecrPosition(pos.X)
	pos.Y = IncrOrDecrPosition(pos.Y)
	return pos
}

func (s *Server) GetMaybeRequestedCoords(requestedXCoord int16, requestedYCoord int16) Position {
	if requestedXCoord == -1 || requestedYCoord == -1 {
		ret := s.GetDefaultCoords()
		return ret
	}
	if requestedXCoord < 0 || requestedXCoord >= BOARD_SIZE || requestedYCoord < 0 || requestedYCoord >= BOARD_SIZE {
		ret := s.GetDefaultCoords()
		return ret
	}
	return Position{X: uint16(requestedXCoord), Y: uint16(requestedYCoord)}
}

func (s *Server) handleClientRegistrations() {
	for {
		select {
		case req := <-s.register:
			pos := s.GetMaybeRequestedCoords(req.RequestedXCoord, req.RequestedYCoord)
			playingWhite := s.DetermineColor(req.ColorPreference)
			req.Client.InitializeFromPreferences(playingWhite, pos)
			s.clients[req.Client] = struct{}{}
			log.Printf("Client registered, total: %d", len(s.clients))
			s.connectedUsers.Store(uint32(len(s.clients)))
			go req.Client.Run()
			subscribeReq := SubscriptionRequest{
				Client:   req.Client,
				Position: pos,
			}
			log.Printf("subscribing client to position: %v", pos)
			s.subscriptions <- subscribeReq
		case client := <-s.unregister:
			delete(s.clients, client)
			log.Printf("Client unregistered, total: %d", len(s.clients))
			s.connectedUsers.Store(uint32(len(s.clients)))
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

	requestedXCoord := int16(-1)
	requestedYCoord := int16(-1)
	if xCoord, err := strconv.Atoi(r.URL.Query().Get("x")); err == nil {
		if xCoord >= 0 && xCoord < 8000 {
			requestedXCoord = int16(xCoord)
		}
	}
	if yCoord, err := strconv.Atoi(r.URL.Query().Get("y")); err == nil {
		if yCoord >= 0 && yCoord < 8000 {
			requestedYCoord = int16(yCoord)
		}
	}
	if requestedXCoord == -1 || requestedYCoord == -1 {
		requestedXCoord = -1
		requestedYCoord = -1
	}

	colorPref := ColorPreferenceRandom
	if colorPrefStr := r.URL.Query().Get("colorPref"); colorPrefStr != "" {
		switch colorPrefStr {
		case "white":
			colorPref = ColorPreferenceWhite
		case "black":
			colorPref = ColorPreferenceBlack
		default:
			colorPref = ColorPreferenceRandom
		}
	}

	client := NewClient(conn, s)

	req := RegistrationRequest{
		Client:          client,
		ColorPreference: colorPref,
		RequestedXCoord: requestedXCoord,
		RequestedYCoord: requestedYCoord,
	}

	s.register <- &req
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request, staticDir string) {
	if r.URL.Path == "/ws" {
		s.ServeWs(w, r)
		return
	}

	// Serve static files
	http.FileServer(http.Dir(staticDir)).ServeHTTP(w, r)
}

func (s *Server) Testing_GetPiece(x, y uint16) *Piece {
	return s.board.GetPiece(x, y)
}
