package server

import (
	"context"
	"log"
	"math"
	"sync"
	"sync/atomic"
	"time"

	"one-million-chessboards/protocol"

	"github.com/gorilla/websocket"
	"github.com/klauspost/compress/zstd"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
	"google.golang.org/protobuf/proto"
)

var marshalOpt = proto.MarshalOptions{Deterministic: false}

// CR-someday nroyalty: large global rate-limiter

const (
	PeriodicUpdateInterval = time.Second * 63
	activityThreshold      = time.Second * 15

	simulatedLatency          = 1551 * time.Millisecond
	simulatedJitterMs         = 1
	maxWaitBeforeSendingMoves = 225 * time.Millisecond

	MAX_SNAPSHOTS_PER_SECOND = 3
	SNAPSHOT_BURST_LIMIT     = 6

	MAX_SNAPSHOTS_PER_SECOND_SOFT = 2
	SNAPSHOT_BURST_LIMIT_SOFT     = 4

	MAX_MOVES_PER_SECOND      = 4
	MOVE_BURST_LIMIT          = 6
	MAX_MOVES_PER_SECOND_SOFT = 2
	MOVE_BURST_LIMIT_SOFT     = 3

	MOVE_REJECTION_RATE_LIMITING_WINDOW         = 5 * time.Second
	MAX_MOVE_REJECTION_MESSAGES_IF_RATE_LIMITED = 5
)

type limits struct {
	snapshotsPerSecond  int
	snapshotsBurstLimit int
	movesPerSecond      int
	movesBurstLimit     int
}

func getLimits(soft bool) limits {
	if soft {
		return limits{
			snapshotsPerSecond:  MAX_SNAPSHOTS_PER_SECOND_SOFT,
			snapshotsBurstLimit: SNAPSHOT_BURST_LIMIT_SOFT,
			movesPerSecond:      MAX_MOVES_PER_SECOND_SOFT,
			movesBurstLimit:     MOVE_BURST_LIMIT_SOFT,
		}
	}
	return limits{
		snapshotsPerSecond:  MAX_SNAPSHOTS_PER_SECOND,
		snapshotsBurstLimit: SNAPSHOT_BURST_LIMIT,
		movesPerSecond:      MAX_MOVES_PER_SECOND,
		movesBurstLimit:     MOVE_BURST_LIMIT,
	}
}

func getSimulatedLatency() time.Duration {
	// jitterInt := rand.Intn(simulatedJitterMs)
	// jitterSign := rand.Intn(2)
	// if jitterSign == 0 {
	// 	jitterInt = -jitterInt
	// }
	// jitter := time.Duration(jitterInt) * time.Millisecond
	return simulatedLatency
}

func sleepSimulatedLatency() {
	time.Sleep(getSimulatedLatency())
}

type Client struct {
	// done                                           chan struct{}
	conn                                           *websocket.Conn
	server                                         *Server
	send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED chan []byte
	position                                       atomic.Value
	lastSnapshotPosition                           atomic.Value
	lastSnapshotTimeMS                             atomic.Int64
	moveBuffer                                     []*protocol.PieceDataForMove
	captureBuffer                                  []*protocol.PieceCapture
	bufferMu                                       sync.Mutex
	isClosed                                       atomic.Bool
	lastActionTime                                 atomic.Int64
	playingWhite                                   atomic.Bool
	moveScratchBuffer                              []byte
	moveScratchMu                                  sync.Mutex
	rpcLogger                                      zerolog.Logger
	ipString                                       string
	snapshotLimiter                                *rate.Limiter
	moveLimiter                                    *rate.Limiter
	hardRejectionWindowNS                          atomic.Int64
	rejectionCount                                 atomic.Int64
	pendingSnapshot                                atomic.Bool
	clientWg                                       *sync.WaitGroup
	clientCtx                                      context.Context
	clientCancel                                   context.CancelFunc
}

func NewClient(
	conn *websocket.Conn,
	server *Server,
	ipString string,
	softLimited bool,
	clientWg *sync.WaitGroup,
	rootClientCtx context.Context,
) *Client {

	limits := getLimits(softLimited)

	snapshotLimiter := rate.NewLimiter(rate.Limit(limits.snapshotsPerSecond), limits.snapshotsBurstLimit)
	moveLimiter := rate.NewLimiter(rate.Limit(limits.movesPerSecond), limits.movesBurstLimit)
	clientCtx, clientCancel := context.WithCancel(rootClientCtx)

	c := &Client{
		conn:   conn,
		server: server,
		send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED: make(chan []byte, 32),
		position:              atomic.Value{},
		moveBuffer:            make([]*protocol.PieceDataForMove, 0, MOVE_BUFFER_SIZE),
		captureBuffer:         make([]*protocol.PieceCapture, 0, CAPTURE_BUFFER_SIZE),
		isClosed:              atomic.Bool{},
		bufferMu:              sync.Mutex{},
		lastActionTime:        atomic.Int64{},
		lastSnapshotTimeMS:    atomic.Int64{},
		playingWhite:          atomic.Bool{},
		rpcLogger:             NewRPCLogger(ipString),
		ipString:              ipString,
		snapshotLimiter:       snapshotLimiter,
		moveLimiter:           moveLimiter,
		hardRejectionWindowNS: atomic.Int64{},
		rejectionCount:        atomic.Int64{},
		pendingSnapshot:       atomic.Bool{},
		clientWg:              clientWg,
		clientCtx:             clientCtx,
		clientCancel:          clientCancel,
	}
	c.rpcLogger.Info().
		Str("rpc", "NewClient").
		Send()
	c.isClosed.Store(false)
	c.pendingSnapshot.Store(false)
	c.hardRejectionWindowNS.Store(0)
	c.rejectionCount.Store(0)
	c.lastActionTime.Store(time.Now().Unix())
	c.position.Store(Position{X: 0, Y: 0})
	c.lastSnapshotPosition.Store(Position{X: 0, Y: 0})
	return c
}

func (c *Client) Run(playingWhite bool, pos Position) {
	c.playingWhite.Store(playingWhite)
	c.position.Store(pos)
	c.lastSnapshotPosition.Store(pos)
	go c.ReadPump()
	go c.WritePump()
	go c.SendPeriodicUpdates()
	go c.ProcessMoveUpdates()
	c.sendInitialState()
}

const minCompressBytes = 64

func (c *Client) compressAndSend(raw []byte, onDrop string, copyIfNoCompress bool) {
	var payload []byte
	if len(raw) < minCompressBytes {
		if copyIfNoCompress {
			payload = make([]byte, len(raw))
			copy(payload, raw)
		} else {
			payload = raw
		}
	} else {
		enc := GLOBAL_zstdPool.Get().(*zstd.Encoder)
		enc.Reset(nil)
		payload = enc.EncodeAll(raw, make([]byte, 0, len(raw)))
		GLOBAL_zstdPool.Put(enc)
	}
	select {
	case c.send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED <- payload:
		return
	case <-c.clientCtx.Done():
		return
	default:
		c.Close("Send full: " + onDrop)
	}
}

func (c *Client) sendInitialState() {
	currentPosition := c.position.Load().(Position)
	snapshot := c.server.board.GetBoardSnapshot_RETURN_TO_POOL_AFTER_YOU_FUCK(currentPosition)
	defer ReturnPieceDataFromSnapshotToPool(snapshot)

	m := &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_InitialState{
			InitialState: &protocol.ServerInitialState{
				Position:     &protocol.Position{X: uint32(currentPosition.X), Y: uint32(currentPosition.Y)},
				PlayingWhite: c.playingWhite.Load(),
				Snapshot:     snapshot,
			},
		},
	}
	message, err := proto.Marshal(m)
	if err != nil {
		log.Printf("Error marshalling initial state: %v", err)
		return
	}
	c.compressAndSend(message, "sendInitialState", false)
}

func (c *Client) IsActive() bool {
	lastActionTime := c.lastActionTime.Load()
	if lastActionTime == 0 {
		return false
	}
	return time.Since(time.Unix(lastActionTime, 0)) < activityThreshold
}

func (c *Client) BumpActive() {
	c.lastActionTime.Store(time.Now().Unix())
}

const SNAPSHOT_THRESHOLD = VIEW_RADIUS - MAX_CLIENT_HALF_VIEW_RADIUS

func shouldSendSnapshot(lastSnapshotPosition Position, currentPosition Position) bool {
	dx := math.Abs(float64(lastSnapshotPosition.X) - float64(currentPosition.X))
	dy := math.Abs(float64(lastSnapshotPosition.Y) - float64(currentPosition.Y))
	return dx > float64(SNAPSHOT_THRESHOLD) || dy > float64(SNAPSHOT_THRESHOLD)
}

func (c *Client) UpdatePositionAndMaybeSnapshot(pos Position) {
	c.position.Store(pos)
	c.server.clientManager.UpdateClientPosition(c, pos)
	if shouldSendSnapshot(c.lastSnapshotPosition.Load().(Position), pos) {
		if c.pendingSnapshot.CompareAndSwap(false, true) {
			c.rpcLogger.Info().
				Str("rpc", "SendSnapshotForSubsscribe").
				Send()

			go func() {
				ctx := context.Background()

				for {
					if err := c.snapshotLimiter.Wait(ctx); err != nil {
						c.pendingSnapshot.Store(false)
						return
					}

					c.SendStateSnapshot()
					c.pendingSnapshot.Store(false)

					if !shouldSendSnapshot(c.lastSnapshotPosition.Load().(Position),
						c.position.Load().(Position)) {
						return
					}

					if !c.pendingSnapshot.CompareAndSwap(false, true) {
						return
					}
				}
			}()
		}
	}
}

func (c *Client) ReadPump() {
	c.clientWg.Add(1)
	defer func() {
		c.Close("ReadPump")
		c.clientWg.Done()
	}()

	c.conn.SetReadLimit(256) // 256 bytes; client messages are small
	c.conn.SetReadDeadline(time.Now().Add(30 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		c.conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		if err != nil {
			// log.Printf("Error reading message: %v", err)
			break
		}
		var msg protocol.ClientMessage
		if err := proto.Unmarshal(message, &msg); err != nil {
			// log.Printf("Error unmarshalling message: %v", err)
			continue
		}
		c.handleProtoMessage(&msg)
	}
}

func CoordInBounds(coord float64) bool {
	return coord >= 0 && uint16(coord) < BOARD_SIZE
}

func CoordInBoundsInt(coord uint32) bool {
	return coord < BOARD_SIZE
}

func (c *Client) handleProtoMessage(msg *protocol.ClientMessage) {
	switch p := msg.Payload.(type) {
	case *protocol.ClientMessage_Move:
		pieceID := p.Move.PieceId
		fromX := p.Move.FromX
		fromY := p.Move.FromY
		toX := p.Move.ToX
		toY := p.Move.ToY
		moveType := p.Move.MoveType
		moveToken := p.Move.MoveToken

		c.rpcLogger.Info().
			Str("rpc", "MovePiece").
			Send()

		if !CoordInBoundsInt(fromX) || !CoordInBoundsInt(fromY) ||
			!CoordInBoundsInt(toX) || !CoordInBoundsInt(toY) {
			return
		}

		if moveType != protocol.MoveType_MOVE_TYPE_NORMAL &&
			moveType != protocol.MoveType_MOVE_TYPE_CASTLE &&
			moveType != protocol.MoveType_MOVE_TYPE_EN_PASSANT {
			return
		}

		c.BumpActive()

		if !c.moveLimiter.Allow() {
			now := time.Now()
			endOfWindow := now.Add(-1 * MOVE_REJECTION_RATE_LIMITING_WINDOW).UnixNano()
			window := c.hardRejectionWindowNS.Load()
			if window < endOfWindow {
				c.hardRejectionWindowNS.Store(now.UnixNano())
				c.rejectionCount.Store(0)
			}
			count := c.rejectionCount.Add(1)
			if count > MAX_MOVE_REJECTION_MESSAGES_IF_RATE_LIMITED {
				return
			} else {
				c.rpcLogger.Info().
					Str("rpc", "RateLimitedMove").
					Send()
				c.SendInvalidMove(moveToken)
				return
			}
		}

		move := Move{
			PieceID:              pieceID,
			FromX:                uint16(fromX),
			FromY:                uint16(fromY),
			ToX:                  uint16(toX),
			ToY:                  uint16(toY),
			MoveType:             moveType,
			MoveToken:            moveToken,
			ClientIsPlayingWhite: c.playingWhite.Load(),
		}

		req := MoveRequest{
			Move:   move,
			Client: c,
		}

		select {
		case c.server.moveRequests <- req:
		case <-c.clientCtx.Done():
			return
		}
	case *protocol.ClientMessage_Subscribe:
		centerX := p.Subscribe.CenterX
		centerY := p.Subscribe.CenterY
		if !CoordInBoundsInt(centerX) || !CoordInBoundsInt(centerY) {
			return
		}
		c.BumpActive()
		c.UpdatePositionAndMaybeSnapshot(Position{X: uint16(centerX), Y: uint16(centerY)})
	case *protocol.ClientMessage_Ping:
		m := &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_Pong{
				Pong: &protocol.ServerPong{},
			},
		}
		message, err := proto.Marshal(m)
		if err != nil {
			log.Printf("Error marshalling app pong: %v", err)
			return
		}
		c.compressAndSend(message, "app-ping", false)
	}
}

func (c *Client) WritePump() {
	c.clientWg.Add(1)
	defer func() {
		c.Close("WritePump")
		c.clientWg.Done()
	}()

	pingTicker := time.NewTicker(time.Second * 10)
	defer pingTicker.Stop()

	for {
		select {
		case message, ok := <-c.send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED:
			if !ok {
				// Channel closed - shouldn't happen?
				log.Printf("!!Send channel unexpectedly closed!!")
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}
		case <-pingTicker.C:
			c.conn.WriteMessage(websocket.PingMessage, nil)
		case <-c.clientCtx.Done():
			return
		}
	}
}

func (c *Client) SendPeriodicUpdates() {
	ticker := time.NewTicker(PeriodicUpdateInterval)
	c.clientWg.Add(1)
	defer func() {
		c.clientWg.Done()
		ticker.Stop()
	}()

	for {
		select {
		case <-ticker.C:
			lastSnapshotTimeMS := time.UnixMilli(c.lastSnapshotTimeMS.Load())
			since := time.Since(lastSnapshotTimeMS)
			if lastSnapshotTimeMS.IsZero() || since > time.Second*5 {
				c.SendStateSnapshot()
			}
		case <-c.clientCtx.Done():
			return
		}
	}
}

func (c *Client) ProcessMoveUpdates() {
	ticker := time.NewTicker(maxWaitBeforeSendingMoves)
	c.clientWg.Add(1)
	defer func() {
		c.clientWg.Done()
		ticker.Stop()
	}()

	for {
		select {
		case <-ticker.C:
			c.MaybeSendMoveUpdates()
		case <-c.clientCtx.Done():
			return
		}
	}
}

func (c *Client) AddMovesToBuffer(moves []*protocol.PieceDataForMove, capture *protocol.PieceCapture) {
	if c.isClosed.Load() {
		return
	}
	c.bufferMu.Lock()
	defer c.bufferMu.Unlock()

	c.moveBuffer = append(c.moveBuffer, moves...)
	if capture != nil {
		c.captureBuffer = append(c.captureBuffer, capture)
	}

	// Send immediately if buffer gets large
	if len(c.moveBuffer) >= MOVE_BUFFER_SIZE || len(c.captureBuffer) >= CAPTURE_BUFFER_SIZE {
		go c.MaybeSendMoveUpdates()
	}
}

func (c *Client) SendStateSnapshot() {
	pos := c.position.Load().(Position)
	snapshot := c.server.board.GetBoardSnapshot_RETURN_TO_POOL_AFTER_YOU_FUCK(pos)
	defer ReturnPieceDataFromSnapshotToPool(snapshot)

	m := &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_Snapshot{
			Snapshot: snapshot,
		},
	}
	message, err := proto.Marshal(m)
	if err != nil {
		log.Printf("Error marshalling snapshot: %v", err)
		return
	}

	c.lastSnapshotPosition.Store(pos)
	c.lastSnapshotTimeMS.Store(time.Now().UnixMilli())

	c.compressAndSend(message, "SendStateSnapshot", false)
}

func (c *Client) MaybeSendMoveUpdates() {
	c.bufferMu.Lock()
	if len(c.moveBuffer) == 0 && len(c.captureBuffer) == 0 {
		c.bufferMu.Unlock()
		return
	}
	// nroyalty: it'd be nice to pool these slices, but it's
	// a pain in the ass because we need to wait until they're
	// actually sent to the client before we can return them
	// which means managing state inside our send goroutine
	moves := make([]*protocol.PieceDataForMove, len(c.moveBuffer))
	captures := make([]*protocol.PieceCapture, len(c.captureBuffer))
	copy(moves, c.moveBuffer)
	copy(captures, c.captureBuffer)
	c.moveBuffer = c.moveBuffer[:0]
	c.captureBuffer = c.captureBuffer[:0]
	c.bufferMu.Unlock()

	m := &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_MovesAndCaptures{
			MovesAndCaptures: &protocol.ServerMovesAndCaptures{
				Moves:    moves,
				Captures: captures,
			},
		},
	}
	c.moveScratchMu.Lock()
	defer c.moveScratchMu.Unlock()
	buf := c.moveScratchBuffer[:0]
	buf, err := marshalOpt.MarshalAppend(buf, m)
	if err != nil {
		log.Printf("Error marshalling move updates: %v", err)
		return
	}

	// if we don't compress, we should copy the buffer because we
	// may reuse it for the next send
	c.compressAndSend(buf, "SendMoveUpdates", true)
}

func (c *Client) SendInvalidMove(moveToken uint32) {
	m := &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_InvalidMove{
			InvalidMove: &protocol.ServerInvalidMove{
				MoveToken: moveToken,
			},
		},
	}
	message, err := proto.Marshal(m)
	if err != nil {
		log.Printf("Error marshalling invalid move: %v", err)
		return
	}
	c.rpcLogger.Info().
		Str("rpc", "InvalidMove").
		Send()

	c.compressAndSend(message, "SendInvalidMove", false)
}

func (c *Client) SendValidMove(moveToken uint32, asOfSeqnum uint64, capturedPieceId uint32) {
	m := &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_ValidMove{
			ValidMove: &protocol.ServerValidMove{
				MoveToken:       moveToken,
				AsOfSeqnum:      asOfSeqnum,
				CapturedPieceId: capturedPieceId,
			},
		},
	}
	message, err := proto.Marshal(m)
	if err != nil {
		log.Printf("Error marshalling invalid move: %v", err)
		return
	}

	c.compressAndSend(message, "SendValidMove", false)
}

func (c *Client) SendAdoption(msg []byte) {
	c.compressAndSend(msg, "SendAdoption", false)
}

func (c *Client) SendBulkCapture(msg []byte) {
	c.compressAndSend(msg, "SendBulkCapture", false)
}

func (c *Client) Close(why string) {
	if !c.isClosed.CompareAndSwap(false, true) {
		return
	}
	// log.Printf("Closing client %s: %s", c.ipString, why)
	c.clientCancel()
	c.server.DecrementCountForIp(c.ipString)
	c.server.clientManager.UnregisterClient(c)
	c.conn.Close()
}
