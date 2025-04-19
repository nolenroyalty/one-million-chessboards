package server

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strconv"
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

// Server is the main game server coordinator
type Server struct {
	// Game state
	board             *Board
	persistentBoard   *PersistentBoard
	clientManager     *ClientManager
	minimapAggregator *MinimapAggregator
	moveRequests      chan MoveRequest
	upgrader          websocket.Upgrader
}

func NewServer(stateDir string) *Server {
	persistentBoard := NewPersistentBoard(stateDir)
	board := persistentBoard.GetBoardCopy()
	s := &Server{
		board:             board,
		persistentBoard:   persistentBoard,
		clientManager:     NewClientManager(),
		minimapAggregator: NewMinimapAggregator(),
		// clients:           make(map[*Client]struct{}),
		// register:   make(chan *RegistrationRequest, 512),
		// unregister: make(chan *Client, 512),
		// getClients:        make(chan CurrentClients, 128),
		moveRequests: make(chan MoveRequest, 1024),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
	}
	return s
}

func (s *Server) Run() {
	s.minimapAggregator.Initialize(s.board)
	go s.processMoves()
	go s.minimapAggregator.Run()
	go s.sendPeriodicAggregations()
	go s.sendPeriodicStats()
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
		clients := s.clientManager.GetAllClients()
		for client := range clients {
			client.SendMinimapUpdate(response)
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
		ConnectedUsers:       uint32(s.clientManager.GetClientCount()),
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
		clients := s.clientManager.GetAllClients()
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

			pieceData := PieceData{
				ID:              moveResult.MovedPieces[i].Piece.ID,
				X:               moveResult.MovedPieces[i].ToX,
				Y:               moveResult.MovedPieces[i].ToY,
				Type:            moveResult.MovedPieces[i].Piece.Type,
				JustDoubleMoved: moveResult.MovedPieces[i].Piece.JustDoubleMoved,
				IsWhite:         moveResult.MovedPieces[i].Piece.IsWhite,
				MoveCount:       moveResult.MovedPieces[i].Piece.MoveCount,
				CaptureCount:    moveResult.MovedPieces[i].Piece.CaptureCount,
			}

			movedPieces[i] = PieceMove{
				Piece:  pieceData,
				Seqnum: moveResult.Seqnum,
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

		// CR nroyalty: is there a way we can avoid the overhead of re-serializing a move
		// for each client here? It's annoying that we might end up doing the same serialization
		// for 100 different clients if they're looking at the same zones.
		go func(moves []PieceMove, capture *PieceCapture) {
			affectedZones := s.clientManager.GetAffectedZones(moveReq.Move)
			interestedClients := s.clientManager.GetClientsForZones(affectedZones)
			for client := range interestedClients {
				client.AddMovesToBuffer(moves, capture)
			}
			s.clientManager.ReturnClientMap(interestedClients)
		}(movedPieces, captureMove)
	}
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
	whiteCount := s.clientManager.GetWhiteCount()
	blackCount := s.clientManager.GetBlackCount()
	if whiteCount < 0 {
		log.Printf("BUG? whiteCount is negative: %d", whiteCount)
		whiteCount = 0
		s.clientManager.whiteCount.Store(0)
	}
	if blackCount < 0 {
		log.Printf("BUG? blackCount is negative: %d", blackCount)
		blackCount = 0
		s.clientManager.blackCount.Store(0)
	}
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
	activeClientPositions := s.clientManager.GetSomeActiveClientPositions(100)

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

	pos := s.GetMaybeRequestedCoords(requestedXCoord, requestedYCoord)
	playingWhite := s.DetermineColor(colorPref)
	s.clientManager.RegisterClient(client, pos, playingWhite)
	go client.Run(playingWhite, pos)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request, staticDir string) {
	if r.URL.Path == "/ws" {
		s.ServeWs(w, r)
		return
	}

	http.FileServer(http.Dir(staticDir)).ServeHTTP(w, r)
}

func (s *Server) Testing_GetPiece(x, y uint16) *Piece {
	return s.board.GetPiece(x, y)
}
