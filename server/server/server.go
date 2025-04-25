package server

import (
	"log"
	"math"
	"math/rand"
	"net"
	"net/http"
	"net/http/pprof"
	"one-million-chessboards/protocol"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	jsoniter "github.com/json-iterator/go"
	"github.com/puzpuzpuz/xsync/v4"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

var json = jsoniter.ConfigCompatibleWithStandardLibrary

type ColorPreference int

const (
	ColorPreferenceWhite ColorPreference = iota
	ColorPreferenceBlack
	ColorPreferenceRandom
)

type limitingBucket struct {
	count            atomic.Int32
	limiter          *rate.Limiter
	lastActionTimeNs atomic.Int64
}

const (
	SOFT_MAX_CONNECTIONS_PER_IP   = 40
	SOFT_MAX_CONNECTIONS_PER_IPV6 = 10
	HARD_MAX_CONNECTIONS_PER_IP   = SOFT_MAX_CONNECTIONS_PER_IP * 3
	HARD_MAX_CONNECTIONS_PER_IPV6 = SOFT_MAX_CONNECTIONS_PER_IPV6 * 3

	MAX_CONS_PER_SECOND_IPV4   = 5
	MAX_CONS_PER_SECOND_IPV6   = 5
	BURST_CONS_PER_SECOND_IPV4 = 10
	BURST_CONS_PER_SECOND_IPV6 = 5
)

type Server struct {
	board                     *Board
	persistentBoard           *PersistentBoard
	clientManager             *ClientManager
	minimapAggregator         *MinimapAggregator
	moveRequests              chan MoveRequest
	upgrader                  websocket.Upgrader
	currentStats              jsoniter.RawMessage
	currentStatsMutex         sync.RWMutex
	recentCaptures            *RecentCaptures
	recentWhiteCapturesResult jsoniter.RawMessage
	recentBlackCapturesResult jsoniter.RawMessage
	recentCapturesMutex       sync.RWMutex
	httpLogger                zerolog.Logger
	coreLogger                zerolog.Logger
	limits                    *xsync.Map[string, *limitingBucket]
}

func NewServer(stateDir string) *Server {
	persistentBoard := NewPersistentBoard(stateDir)
	board := persistentBoard.GetBoardCopy()
	httpLogger := NewCoreLogger().With().Str("kind", "http").Logger()
	s := &Server{
		board:             board,
		persistentBoard:   persistentBoard,
		clientManager:     NewClientManager(),
		minimapAggregator: NewMinimapAggregator(),
		moveRequests:      make(chan MoveRequest, 1024),
		recentCaptures:    NewRecentCaptures(),
		httpLogger:        httpLogger,
		coreLogger:        NewCoreLogger(),
		limits:            xsync.NewMap[string, *limitingBucket](),
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
	go s.ClearOldLimits()
	go s.processMoves()
	go s.refreshMinimapPeriodically()
	s.refreshStatsPeriodically()
	s.refreshRecentCapturesPeriodically()
	go s.persistentBoard.Run()
}

func (s *Server) ClearOldLimits() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		atLeastOneMinuteAgo := time.Now().Add(-1 * time.Minute).UnixNano()
		s.limits.Range(func(key string, value *limitingBucket) bool {
			if value.count.Load() > 0 {
				return true
			}

			if value.lastActionTimeNs.Load() < atLeastOneMinuteAgo {
				s.limits.Delete(key)
			}
			return true
		})
	}
}

func (s *Server) refreshRecentCapturesOnce() {
	type res struct {
		Captures []Position `json:"captures"`
	}
	recentCapturesResult := s.recentCaptures.GetRecentCaptures()
	s.recentCapturesMutex.Lock()
	defer s.recentCapturesMutex.Unlock()
	whiteSerialized, err := json.Marshal(res{Captures: recentCapturesResult.WhiteCaptures})
	if err != nil {
		log.Printf("Error marshalling recent captures: %v", err)
	} else {
		s.recentWhiteCapturesResult = whiteSerialized
	}
	blackSerialized, err := json.Marshal(res{Captures: recentCapturesResult.BlackCaptures})
	if err != nil {
		log.Printf("Error marshalling recent captures: %v", err)
	} else {
		s.recentBlackCapturesResult = blackSerialized
	}
}

func (s *Server) refreshRecentCapturesPeriodically() {
	s.refreshRecentCapturesOnce()
	go func() {
		ticker := time.NewTicker(CAPTURE_REFRESH_INTERVAL)
		defer ticker.Stop()

		for range ticker.C {
			s.refreshRecentCapturesOnce()
		}
	}()
}

func (s *Server) refreshMinimapPeriodically() {
	ticker := time.NewTicker(MINIMAP_REFRESH_INTERVAL)
	defer ticker.Stop()

	for range ticker.C {
		s.minimapAggregator.createAndStoreAggregation()
	}
}

func (s *Server) refreshStatsOnce() {
	type StatsUpdate struct {
		Type                 string `json:"type"`
		TotalMoves           uint64 `json:"totalMoves"`
		WhitePiecesRemaining uint32 `json:"whitePiecesRemaining"`
		BlackPiecesRemaining uint32 `json:"blackPiecesRemaining"`
		WhiteKingsRemaining  uint32 `json:"whiteKingsRemaining"`
		BlackKingsRemaining  uint32 `json:"blackKingsRemaining"`
		ConnectedUsers       uint32 `json:"connectedUsers"`
		Seqnum               uint64 `json:"seqnum"`
	}
	boardStats := s.board.GetStats()
	allStats := StatsUpdate{
		Type:                 "globalStats",
		TotalMoves:           boardStats.TotalMoves,
		WhitePiecesRemaining: boardStats.WhitePiecesRemaining,
		BlackPiecesRemaining: boardStats.BlackPiecesRemaining,
		WhiteKingsRemaining:  boardStats.WhiteKingsRemaining,
		BlackKingsRemaining:  boardStats.BlackKingsRemaining,
		ConnectedUsers:       uint32(s.clientManager.GetClientCount()),
		Seqnum:               boardStats.Seqnum,
	}
	serialized, err := json.Marshal(allStats)
	if err != nil {
		log.Printf("Error marshalling stats: %v", err)
		return
	}
	s.currentStatsMutex.Lock()
	s.currentStats = serialized
	s.currentStatsMutex.Unlock()
}

func (s *Server) refreshStatsPeriodically() {
	s.refreshStatsOnce()
	go func() {
		ticker := time.NewTicker(STATS_REFRESH_INTERVAL)
		defer ticker.Stop()

		for range ticker.C {
			s.refreshStatsOnce()
		}
	}()
}

func (s *Server) processMoves() {
	for moveReq := range s.moveRequests {
		moveResult := s.board.ValidateAndApplyMove__NOTTHREADSAFE(moveReq.Move)
		if !moveResult.Valid {
			moveReq.Client.SendInvalidMove(moveReq.Move.MoveToken)
			continue
		}
		s.persistentBoard.ApplyMove(moveReq.Move, moveResult.Seqnum)

		if moveResult.CapturedPiece.Piece.IsEmpty() {
			moveReq.Client.SendValidMove(moveReq.Move.MoveToken, moveResult.Seqnum, 0)
		} else {
			moveReq.Client.SendValidMove(moveReq.Move.MoveToken, moveResult.Seqnum, moveResult.CapturedPiece.Piece.ID)
		}

		// CR nroyalty: is there a way we can avoid the overhead of re-serializing a move
		// for each client here? It's annoying that we might end up doing the same serialization
		// for 100 different clients if they're looking at the same zones.
		//
		// CR nroyalty: I THINK this can't actually matter, but there's a bug here where
		// you castle queenside and that results in us moving a rook that's on the edge
		// of your vision, but the king isn't in your vision and so we don't tell you about it
		// I think this is fine...but I need to think about it some more.
		go func() {
			s.minimapAggregator.UpdateForMoveResult(moveResult)
			capturedPiece := moveResult.CapturedPiece
			movedPieces := make([]*protocol.PieceDataForMove, moveResult.Length)
			for i := 0; i < int(moveResult.Length); i++ {
				piece := moveResult.MovedPieces[i].Piece

				movedPieces[i] = &protocol.PieceDataForMove{
					X:      uint32(moveResult.MovedPieces[i].ToX),
					Y:      uint32(moveResult.MovedPieces[i].ToY),
					Seqnum: moveResult.Seqnum,
					Piece:  piece.ToProtocol(),
				}
			}

			var pieceCapture *protocol.PieceCapture = nil
			if !capturedPiece.Piece.IsEmpty() {
				s.recentCaptures.AddCapture(&moveResult.CapturedPiece)
				pieceCapture = &protocol.PieceCapture{
					CapturedPieceId: capturedPiece.Piece.ID,
					Seqnum:          moveResult.Seqnum,
				}
			}
			affectedZones := s.clientManager.GetAffectedZones(moveReq.Move)
			interestedClients := s.clientManager.GetClientsForZones(affectedZones)
			for client := range interestedClients {
				client.AddMovesToBuffer(movedPieces, pieceCapture)
			}
			s.clientManager.ReturnClientMap(interestedClients)
		}()
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

func (s *Server) GetIPString(r *http.Request) (string, bool) {
	realIp := ""
	if cfIP := r.Header.Get("CF-Connecting-IP"); cfIP != "" {
		realIp = cfIP
	} else if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		xffParts := strings.Split(xff, ",")
		if len(xffParts) > 0 {
			realIp = xffParts[0]
		}
	} else {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			realIp = "UNKNOWN"
		} else {
			realIp = ip
		}
	}

	rateLimitIP := realIp
	ipv6 := false
	if ip := net.ParseIP(realIp); ip != nil && ip.To4() == nil {
		ipv6 = true
		ipv6PrefixLength := 48
		mask := net.CIDRMask(ipv6PrefixLength, 128)
		networkAddress := ip.Mask(mask)
		rateLimitIP = networkAddress.String()
	}

	return rateLimitIP, ipv6
}

type AddIpResult int

const (
	AddIpResultSuccess AddIpResult = iota
	AddIpResultHardLimitExceeded
	AddIpResultSoftLimitExceeded
)

func (s *Server) maybeAddNewIp(ipString string, ipv6 bool) AddIpResult {
	bucket, _ := s.limits.LoadOrCompute(ipString, func() (*limitingBucket, bool) {
		limit := MAX_CONS_PER_SECOND_IPV4
		burst := BURST_CONS_PER_SECOND_IPV4
		if ipv6 {
			limit = MAX_CONS_PER_SECOND_IPV6
			burst = BURST_CONS_PER_SECOND_IPV6
		}
		limiter := rate.NewLimiter(rate.Limit(limit), burst)
		bucket := &limitingBucket{
			count:            atomic.Int32{},
			lastActionTimeNs: atomic.Int64{},
			limiter:          limiter}

		bucket.count.Store(0)
		bucket.lastActionTimeNs.Store(time.Now().UnixNano())
		return bucket, false
	})

	if !bucket.limiter.Allow() {
		return AddIpResultHardLimitExceeded
	}

	count := bucket.count.Add(1)
	softLimit := int32(SOFT_MAX_CONNECTIONS_PER_IP)
	hardLimit := int32(HARD_MAX_CONNECTIONS_PER_IP)
	if ipv6 {
		softLimit = int32(SOFT_MAX_CONNECTIONS_PER_IPV6)
		hardLimit = int32(HARD_MAX_CONNECTIONS_PER_IPV6)
	}
	if count > hardLimit {
		bucket.count.Add(-1)
		return AddIpResultHardLimitExceeded
	}
	if count > softLimit {
		return AddIpResultSoftLimitExceeded
	}
	return AddIpResultSuccess

}

// Called by client when it disconnects
func (s *Server) DecrementCountForIp(ipString string) {
	s.limits.Compute(ipString,
		func(bucket *limitingBucket, loaded bool) (*limitingBucket, xsync.ComputeOp) {
			if !loaded {
				log.Printf("Bug? decrement ip count but bucket didn't exist?")
				return bucket, xsync.CancelOp
			}
			bucket.count.Add(-1)
			bucket.lastActionTimeNs.Store(time.Now().UnixNano())
			return bucket, xsync.UpdateOp
		})
}

func (s *Server) ServeWs(w http.ResponseWriter, r *http.Request) {
	ipString, ipv6 := s.GetIPString(r)
	limitResult := s.maybeAddNewIp(ipString, ipv6)
	if limitResult == AddIpResultHardLimitExceeded {
		s.coreLogger.Info().Str("reject", "connection-limit").Str("ip", ipString).Send()
		http.Error(w, "Too many connections", http.StatusTooManyRequests)
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

	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	softLimited := limitResult == AddIpResultSoftLimitExceeded
	client := NewClient(conn, s, ipString, softLimited)
	pos := s.GetMaybeRequestedCoords(requestedXCoord, requestedYCoord)
	playingWhite := s.DetermineColor(colorPref)
	s.clientManager.RegisterClient(client, pos, playingWhite)
	go client.Run(playingWhite, pos)
}

func (s *Server) ServeMinimap(w http.ResponseWriter, r *http.Request) {
	s.httpLogger.Info().
		Str("rpc", "ServeMinimap").
		Send()
	aggregation := s.minimapAggregator.GetLastAggregation()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Encoding", "zstd")
	w.Header().Set("Cache-Control", "public, max-age=2, s-maxage=25")
	w.Write(aggregation)
}

func (s *Server) ServeGlobalStats(w http.ResponseWriter, r *http.Request) {
	s.httpLogger.Info().
		Str("rpc", "ServeGlobalStats").
		Send()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=2, s-maxage=4")
	s.currentStatsMutex.RLock()
	defer s.currentStatsMutex.RUnlock()
	w.Write(s.currentStats)
}

func (s *Server) ServeRecentCaptures(w http.ResponseWriter, r *http.Request, white bool) {
	s.httpLogger.Info().
		Str("rpc", "ServeRecentCaptures").
		Send()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=2, s-maxage=4")
	s.recentCapturesMutex.RLock()
	defer s.recentCapturesMutex.RUnlock()
	if white {
		w.Write(s.recentWhiteCapturesResult)
	} else {
		w.Write(s.recentBlackCapturesResult)
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request, staticDir string) {
	if r.URL.Path == "/ws" {
		s.ServeWs(w, r)
		return
	} else if r.URL.Path == "/api/minimap" {
		s.ServeMinimap(w, r)
		return
	} else if r.URL.Path == "/api/global-game-stats" {
		s.ServeGlobalStats(w, r)
		return
	} else if r.URL.Path == "/api/recently-captured/white" {
		s.ServeRecentCaptures(w, r, true)
		return
	} else if r.URL.Path == "/api/recently-captured/black" {
		s.ServeRecentCaptures(w, r, false)
		return
	}

	// CR nroyalty: remove later
	switch r.URL.Path {
	case "/debug/pprof/":
		pprof.Index(w, r)
	case "/debug/pprof/cmdline":
		pprof.Cmdline(w, r)
	case "/debug/pprof/profile":
		pprof.Profile(w, r)
	case "/debug/pprof/symbol":
		pprof.Symbol(w, r)
	case "/debug/pprof/trace":
		pprof.Trace(w, r)
	default:
		http.FileServer(http.Dir(staticDir)).ServeHTTP(w, r)
	}
}
