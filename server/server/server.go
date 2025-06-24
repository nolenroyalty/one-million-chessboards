package server

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net"
	"net/http"
	"net/http/pprof"
	"one-million-chessboards/protocol"
	"os"
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
	"google.golang.org/protobuf/proto"
)

var json = jsoniter.ConfigCompatibleWithStandardLibrary
var internalPass = flag.String("internal-pass", "TEST", "dumb pw for internal APIs (does not really matter tbh)")
var bannedIPsConfig = flag.String("banned-ips", "", "Path to JSON file containing banned IPs")

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
	SOFT_MAX_CONNECTIONS_PER_IP   = 20 * TESTING_MULTIPLIER_CHANGE_YOU_LITTLE_SHIT
	SOFT_MAX_CONNECTIONS_PER_IPV6 = 15 * TESTING_MULTIPLIER_CHANGE_YOU_LITTLE_SHIT
	HARD_MAX_CONNECTIONS_PER_IP   = SOFT_MAX_CONNECTIONS_PER_IP * 4
	HARD_MAX_CONNECTIONS_PER_IPV6 = SOFT_MAX_CONNECTIONS_PER_IPV6 * 4

	MAX_CONS_PER_SECOND_IPV4   = 3 * TESTING_MULTIPLIER_CHANGE_YOU_LITTLE_SHIT
	MAX_CONS_PER_SECOND_IPV6   = 4 * TESTING_MULTIPLIER_CHANGE_YOU_LITTLE_SHIT
	BURST_CONS_PER_SECOND_IPV4 = 8 * TESTING_MULTIPLIER_CHANGE_YOU_LITTLE_SHIT
	BURST_CONS_PER_SECOND_IPV6 = 5 * TESTING_MULTIPLIER_CHANGE_YOU_LITTLE_SHIT
)

type Server struct {
	board                     *Board
	boardToDiskHandler        *BoardToDiskHandler
	clientManager             *ClientManager
	minimapAggregator         *MinimapAggregator
	moveRequests              chan MoveRequest
	adoptionRequests          chan adoptionRequest
	bulkCaptureRequests       chan bulkCaptureRequest
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
	backgroundJobCtx          context.Context
	backgroundJobCancel       context.CancelFunc
	backgroundJobWg           *sync.WaitGroup
	processMovesCtx           context.Context
	processMovesCancel        context.CancelFunc
	clientWg                  *sync.WaitGroup
	rootClientCtx             context.Context
	rootClientCancel          context.CancelFunc
	shutdownBegan             atomic.Bool
	gameOver                  atomic.Bool
	bannedIpsMutex            sync.RWMutex
	bannedIps                 map[string]bool
}

func NewServer(stateDir string) *Server {
	boardToDiskHandler, err := NewBoardToDiskHandler(stateDir)
	if err != nil {
		panic(fmt.Sprintf("Error getting btd: %s", err))
	}
	backgroundJobCtx, backgroundJobCancel := context.WithCancel(context.Background())
	backgroundJobWg := &sync.WaitGroup{}

	rootClientCtx, rootClientCancel := context.WithCancel(context.Background())
	clientWg := &sync.WaitGroup{}

	processMovesCtx, processMovesCancel := context.WithCancel(backgroundJobCtx)

	board := boardToDiskHandler.GetLiveBoard()
	httpLogger := NewCoreLogger().With().Str("kind", "http").Logger()
	s := &Server{
		board:               board,
		boardToDiskHandler:  boardToDiskHandler,
		clientManager:       NewClientManager(),
		minimapAggregator:   NewMinimapAggregator(),
		moveRequests:        make(chan MoveRequest, 1024),
		adoptionRequests:    make(chan adoptionRequest, 128),
		bulkCaptureRequests: make(chan bulkCaptureRequest, 16),
		recentCaptures:      NewRecentCaptures(),
		httpLogger:          httpLogger,
		coreLogger:          NewCoreLogger(),
		limits:              xsync.NewMap[string, *limitingBucket](),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true // Allow direct connections (like from curl)
				}

				// Allow localhost for development
				if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "https://localhost:") {
					return true
				}

				// Allow the production domain
				if strings.HasPrefix(origin, "https://onemillionchessboards.com") {
					return true
				}

				return false
			},
		},
		backgroundJobCtx:    backgroundJobCtx,
		backgroundJobCancel: backgroundJobCancel,
		backgroundJobWg:     backgroundJobWg,
		processMovesCtx:     processMovesCtx,
		processMovesCancel:  processMovesCancel,
		rootClientCtx:       rootClientCtx,
		rootClientCancel:    rootClientCancel,
		clientWg:            clientWg,
		gameOver:            atomic.Bool{},
	}
	s.gameOver.Store(false)
	return s
}

func (s *Server) Run() {
	s.minimapAggregator.Initialize(s.board)
	go s.ClearOldLimits()
	go s.processMoves()
	go s.refreshMinimapPeriodically()
	s.refreshStatsPeriodically()
	s.refreshRecentCapturesPeriodically()
	go s.boardToDiskHandler.RunForever()
	go s.refreshBannedIPsPeriodically()
}

func (s *Server) loadBannedIPOnce() {
	if *bannedIPsConfig == "" {
		return
	}

	jsonFile, err := os.Open(*bannedIPsConfig)
	if err != nil {
		log.Printf("Error opening banned IPs file: %v", err)
		return
	}

	type BannedIPs struct {
		IPs []string `json:"ips"`
	}

	var bannedIPs BannedIPs
	err = json.NewDecoder(jsonFile).Decode(&bannedIPs)
	if err != nil {
		log.Printf("Error decoding banned IPs file: %v", err)
		return
	}

	s.bannedIpsMutex.Lock()
	defer s.bannedIpsMutex.Unlock()
	s.bannedIps = make(map[string]bool)
	for _, ip := range bannedIPs.IPs {
		s.bannedIps[ip] = true
	}

	log.Printf("Loaded %d banned IPs", len(s.bannedIps))
}

func (s *Server) refreshBannedIPsPeriodically() {
	if *bannedIPsConfig == "" {
		return
	}

	ticker := time.NewTicker(1 * time.Minute)
	s.backgroundJobWg.Add(1)
	defer func() {
		s.backgroundJobWg.Done()
		ticker.Stop()
	}()

	s.loadBannedIPOnce()

	for {
		select {
		case <-s.backgroundJobCtx.Done():
			return
		case <-ticker.C:
			s.loadBannedIPOnce()
		}
	}
}

func (s *Server) isIPBanned(ipString string) bool {
	s.bannedIpsMutex.RLock()
	defer s.bannedIpsMutex.RUnlock()
	_, ok := s.bannedIps[ipString]
	return ok
}

// https://stackoverflow.com/questions/32840687/timeout-for-waitgroup-wait
func waitTimeout(wg *sync.WaitGroup, timeout time.Duration) bool {
	c := make(chan struct{})
	go func() {
		defer close(c)
		wg.Wait()
	}()
	select {
	case <-c:
		return false // completed normally
	case <-time.After(timeout):
		return true // timed out
	}
}

func (s *Server) GracefulShutdown() {
	if s.shutdownBegan.CompareAndSwap(false, true) {
		log.Printf("GRACEFUL SHUTDOWN: Waiting for clients to finish")
		s.rootClientCancel()
		if waitTimeout(s.clientWg, 5*time.Second) {
			log.Printf("GRACEFUL SHUTDOWN: Clients did not finish in time, continuing")
		} else {
			log.Printf("GRACEFUL SHUTDOWN: Clients finished")
		}

		log.Printf("GRACEFUL SHUTDOWN: Waiting for background jobs to finish")
		s.backgroundJobCancel()
		s.backgroundJobWg.Wait()
		log.Printf("GRACEFUL SHUTDOWN: 	Background jobs finished, shutting down BTD")
		s.boardToDiskHandler.GracefulShutdown()
	}
}

func (s *Server) ClearOldLimits() {
	ticker := time.NewTicker(1 * time.Minute)
	s.backgroundJobWg.Add(1)
	defer func() {
		ticker.Stop()
		s.backgroundJobWg.Done()
	}()

	for {
		select {
		case <-s.backgroundJobCtx.Done():
			return
		case <-ticker.C:
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
		s.backgroundJobWg.Add(1)
		defer func() {
			ticker.Stop()
			s.backgroundJobWg.Done()
		}()

		for {
			select {
			case <-s.backgroundJobCtx.Done():
				return
			case <-ticker.C:
				s.refreshRecentCapturesOnce()
			}
		}
	}()
}

func (s *Server) refreshMinimapPeriodically() {
	ticker := time.NewTicker(MINIMAP_REFRESH_INTERVAL)
	s.backgroundJobWg.Add(1)
	defer func() {
		ticker.Stop()
		s.backgroundJobWg.Done()
	}()

	for {
		select {
		case <-s.backgroundJobCtx.Done():
			return
		case <-ticker.C:
			s.minimapAggregator.createAndStoreAggregation()
		}
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
		Winner               string `json:"winner"`
	}

	boardStats := s.board.GetStats()
	winner := ""
	noWhiteKings := boardStats.WhiteKingsRemaining == 0
	noBlackKings := boardStats.BlackKingsRemaining == 0
	onlyWhiteKings := boardStats.WhitePiecesRemaining == boardStats.WhiteKingsRemaining
	onlyBlackKings := boardStats.BlackPiecesRemaining == boardStats.BlackKingsRemaining

	gameOver := false
	if noWhiteKings && noBlackKings {
		gameOver = true
		winner = "draw"
	} else if noWhiteKings {
		gameOver = true
		winner = "black"
	} else if noBlackKings {
		gameOver = true
		winner = "white"
	} else if onlyWhiteKings && onlyBlackKings {
		gameOver = true
		winner = "draw"
	}

	if gameOver && s.gameOver.CompareAndSwap(false, true) {
		log.Printf("Detected game over from refreshStatsOnce - winner: %s", winner)
		s.processMovesCancel()
		go func() {
			for req := range s.moveRequests {
				req.Client.SendInvalidMove(req.Move.MoveToken)
			}
		}()
	}

	allStats := StatsUpdate{
		Type:                 "globalStats",
		TotalMoves:           boardStats.TotalMoves,
		WhitePiecesRemaining: boardStats.WhitePiecesRemaining,
		BlackPiecesRemaining: boardStats.BlackPiecesRemaining,
		WhiteKingsRemaining:  boardStats.WhiteKingsRemaining,
		BlackKingsRemaining:  boardStats.BlackKingsRemaining,
		ConnectedUsers:       uint32(s.clientManager.GetClientCount()),
		Seqnum:               boardStats.Seqnum,
		Winner:               winner,
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
		s.backgroundJobWg.Add(1)
		defer func() {
			ticker.Stop()
			s.backgroundJobWg.Done()
		}()

		for {
			select {
			case <-s.backgroundJobCtx.Done():
				return
			case <-ticker.C:
				s.refreshStatsOnce()
			}
		}
	}()
}

func (s *Server) processMoves() {
	s.backgroundJobWg.Add(1)
	defer s.backgroundJobWg.Done()

	for {
		select {
		case <-s.processMovesCtx.Done():
			log.Printf("processMoves: context done")
			return
		case moveReq := <-s.moveRequests:
			if s.processMovesCtx.Err() != nil {
				log.Printf("processMoves: context done")
				return
			}

			moveResult := s.board.ValidateAndApplyMove__NOTTHREADSAFE(moveReq.Move)
			if !moveResult.Valid {
				moveReq.Client.SendInvalidMove(moveReq.Move.MoveToken)
				continue
			}

			if moveResult.WinningMove {
				log.Printf("Received the winning move!")
				s.gameOver.Store(true)
				s.processMovesCancel()
			}

			s.boardToDiskHandler.AddMove(&moveReq.Move)

			if moveResult.CapturedPiece.Piece.IsEmpty() {
				moveMetadata := MoveMetadata{
					DidCapture: false,
					Internal:   false,
				}
				if len(moveResult.MovedPieces) > 0 {
					moveMetadata.PieceType = moveResult.MovedPieces[0].Piece.Type
				}
				moveReq.Client.SendValidMove(moveReq.Move.MoveToken,
					moveResult.Seqnum,
					moveMetadata,
					0)
			} else {
				moveMetadata := MoveMetadata{
					DidCapture:        true,
					Internal:          false,
					CapturedPieceType: moveResult.CapturedPiece.Piece.Type,
				}
				if len(moveResult.MovedPieces) > 0 {
					moveMetadata.PieceType = moveResult.MovedPieces[0].Piece.Type
				}
				moveReq.Client.SendValidMove(moveReq.Move.MoveToken,
					moveResult.Seqnum,
					moveMetadata,
					moveResult.CapturedPiece.Piece.ID)
			}

			// CR-someday nroyalty: is there a way we can avoid the overhead of re-serializing a move
			// for each client here? It's annoying that we might end up doing the same serialization
			// for 100 different clients if they're looking at the same zones.
			//
			// CR-someday nroyalty: I THINK this can't actually matter, but there's a bug here where
			// you castle queenside and that results in us moving a rook that's on the edge
			// of your vision, but the king isn't in your vision and so we don't tell you about it
			// I think this is fine...but I need to think about it some more.
			//
			// nroyalty: lol I found a funny client rendering bug (or set of bugs) as a result
			// of testing this, but I failed to actually test it. Let's not worry about it.
			//
			// Ok I think this doesn't matter in practice regardless but since our zones
			// are slightly bigger than our snapshots it super doesn't matter
			go func() {
				numMoved := len(moveResult.MovedPieces)
				if numMoved < 1 {
					log.Printf("IMPOSSIBLE? moveResult length < 1")
					return
				}
				s.minimapAggregator.UpdateForMoveResult(moveResult)
				capturedPiece := moveResult.CapturedPiece
				movedPiecesProto := make([]*protocol.PieceDataForMove, 0, numMoved)
				for _, movedPiece := range moveResult.MovedPieces {
					piece := movedPiece.Piece

					movedPiecesProto = append(movedPiecesProto, &protocol.PieceDataForMove{
						X:      uint32(movedPiece.ToX),
						Y:      uint32(movedPiece.ToY),
						Seqnum: moveResult.Seqnum,
						Piece:  piece.ToProtocolAlloc(),
					})
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
				// Each zone is 50x50 and a client is typically in 9 of them, so we
				// offer them each move in a 150x150 zone that is not necessarily centered
				// exactly on where they are. Depending on their position within their
				// central zone, plenty of moves aren't going to be relevant to them
				// (outside of their current snapshot window)
				//
				// I suppose it depends on access patterns in some way, but I think
				// in practice checking before sending a move to a client is just gonna
				// be faster than slamming out every move, given that I think we should
				// drop a reasonable amount of moves with this check.
				//
				// potential bug around castle notification again here?
				for client := range interestedClients {
					if client.IsInterestedInMove(moveReq.Move) {
						client.AddMovesToBuffer(movedPiecesProto, pieceCapture)
					}
				}
				s.clientManager.ReturnClientMap(interestedClients)
			}()

		case adoptionReq := <-s.adoptionRequests:
			adoptionResult, err := s.board.Adopt(&adoptionReq)
			if err != nil || adoptionResult == nil {
				continue
			}
			s.boardToDiskHandler.AddAdoption(&adoptionReq)

			go func() {
				affectedZones := s.clientManager.AffectedZonesForAdoption(&adoptionReq)
				interestedClients := s.clientManager.GetClientsForZones(affectedZones)
				m := &protocol.ServerMessage{
					Payload: &protocol.ServerMessage_Adoption{
						Adoption: &protocol.ServerAdoption{
							AdoptedIds: adoptionResult.AdoptedPieces,
						},
					},
				}
				message, err := proto.Marshal(m)
				if err != nil {
					log.Printf("Error marshalling adoption: %v", err)
					return
				}

				for client := range interestedClients {
					client.SendAdoption(message)
				}
				s.clientManager.ReturnClientMap(interestedClients)
			}()

		case bulkCaptureReq := <-s.bulkCaptureRequests:
			bulkCaptureMsg, err := s.board.DoBulkCapture(&bulkCaptureReq)
			if err != nil || bulkCaptureMsg == nil {
				continue
			}
			s.boardToDiskHandler.AddBulkCapture(&bulkCaptureReq)

			go func() {
				m := &protocol.ServerMessage{
					Payload: &protocol.ServerMessage_BulkCapture{
						BulkCapture: bulkCaptureMsg,
					},
				}
				message, err := proto.Marshal(m)
				if err != nil {
					log.Printf("Error marshalling bulk capture: %v", err)
					return
				}
				affectedZones := s.clientManager.AffectedZonesForBulkCapture(&bulkCaptureReq)
				interestedClients := s.clientManager.GetClientsForZones(affectedZones)
				for client := range interestedClients {
					client.SendBulkCapture(message)
				}
				s.clientManager.ReturnClientMap(interestedClients)
			}()
		}
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

// nroyalty: I *think* doing this is actually a bad idea, since these zones
// would get cleared out quickly over time. Let's just rely on active client
// positions (which we could also serve up as an endpoint?)
// var DEFAULT_COORD_ARRAY = [][]int{
// 	{500, 500},
// 	{2000, 2000},
// 	{4500, 4500},
// 	{3000, 1500},
// 	{1000, 2000},
// 	{2000, 1000},
// }

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

func (s *Server) GetDefaultCoords(playingWhite bool) Position {
	if pos, ok := s.clientManager.GetRandomActiveClientPosition(); ok {
		pos.X = IncrOrDecrPosition(pos.X)
		pos.Y = IncrOrDecrPosition(pos.Y)
		return pos
	}

	if pos, ok := s.recentCaptures.RandomCapture(playingWhite); ok {
		return pos
	}

	x := 500 + rand.Intn(BOARD_SIZE-1000)
	y := 500 + rand.Intn(BOARD_SIZE-1000)
	return Position{X: uint16(x), Y: uint16(y)}
}

func (s *Server) GetMaybeRequestedCoords(requestedXCoord, requestedYCoord int16, playingWhite bool) Position {
	if requestedXCoord == -1 || requestedYCoord == -1 {
		ret := s.GetDefaultCoords(playingWhite)
		return ret
	}
	if requestedXCoord < 0 || requestedXCoord >= BOARD_SIZE || requestedYCoord < 0 || requestedYCoord >= BOARD_SIZE {
		ret := s.GetDefaultCoords(playingWhite)
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
	if s.shutdownBegan.Load() {
		http.Error(w, "Server is shutting down", http.StatusServiceUnavailable)
		return
	}

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
	client := NewClient(conn, s, ipString, softLimited, s.clientWg, s.rootClientCtx)
	playingWhite := s.DetermineColor(colorPref)
	pos := s.GetMaybeRequestedCoords(requestedXCoord, requestedYCoord, playingWhite)
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
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=2, s-maxage=3")
	s.currentStatsMutex.RLock()
	defer s.currentStatsMutex.RUnlock()
	w.Write(s.currentStats)
}

func (s *Server) ServeRecentCaptures(w http.ResponseWriter, r *http.Request, white bool) {
	// s.httpLogger.Info().
	// 	Str("rpc", "ServeRecentCaptures").
	// 	Send()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=2, s-maxage=3")
	s.recentCapturesMutex.RLock()
	defer s.recentCapturesMutex.RUnlock()
	if white {
		w.Write(s.recentWhiteCapturesResult)
	} else {
		w.Write(s.recentBlackCapturesResult)
	}

}

func (s *Server) ServeAdoption(w http.ResponseWriter, r *http.Request) {
	s.httpLogger.Info().
		Str("rpc", "ServeAdoption").
		Send()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type AdoptionRequest struct {
		X         uint16 `json:"x"`
		Y         uint16 `json:"y"`
		OnlyColor string `json:"onlyColor"`
		Pass      string `json:"pass"`
	}

	var req AdoptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Pass != *internalPass {
		http.Error(w, "no", http.StatusNotFound)
		return
	}

	oc := OnlyColorFromString(req.OnlyColor)

	if req.X >= BOARD_SIZE || req.Y >= BOARD_SIZE {
		http.Error(w, "Coordinates out of bounds", http.StatusBadRequest)
		return
	}

	adoptionReq := NewAdoptionRequest(req.X, req.Y, oc)
	s.adoptionRequests <- *adoptionReq

	w.WriteHeader(http.StatusOK)
}

func (s *Server) ServeBulkCapture(w http.ResponseWriter, r *http.Request) {
	s.httpLogger.Info().
		Str("rpc", "ServeBulkCapture").
		Send()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type BulkCaptureRequest struct {
		X         uint16 `json:"x"`
		Y         uint16 `json:"y"`
		OnlyColor string `json:"onlyColor"`
		Pass      string `json:"pass"`
	}

	var req BulkCaptureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Pass != *internalPass {
		http.Error(w, "no", http.StatusNotFound)
		return
	}

	if req.X >= BOARD_SIZE || req.Y >= BOARD_SIZE {
		http.Error(w, "Coordinates out of bounds", http.StatusBadRequest)
		return
	}

	oc := OnlyColorFromString(req.OnlyColor)

	bulkCaptureReq := NewBulkCaptureRequest(req.X, req.Y, oc)
	s.bulkCaptureRequests <- *bulkCaptureReq

	w.WriteHeader(http.StatusOK)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request, staticDir string) {
	if s.shutdownBegan.Load() {
		http.Error(w, "Server is shutting down", http.StatusServiceUnavailable)
		return
	}

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
	} else if r.URL.Path == "/internal/adoption" {
		s.ServeAdoption(w, r)
		return
	} else if r.URL.Path == "/internal/bulk-capture" {
		s.ServeBulkCapture(w, r)
		return
	}

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
