package server

// CR nroyalty: figure out how to debounce snapshot requests to the degree that we can;
// also make sure when we move to a read-lock approach that we use our latest position
// after getting the lock, instead of the position from when we tried to take the lock.

import (
	"log"
	"math"
	"sync"
	"sync/atomic"
	"time"

	"one-million-chessboards/protocol"

	"github.com/gorilla/websocket"
	"github.com/klauspost/compress/zstd"
	"github.com/rs/zerolog"
	"google.golang.org/protobuf/proto"
)

var marshalOpt = proto.MarshalOptions{Deterministic: false}

const (
	// CR nroyalty: MAKE SURE THIS IS NOT BELOW 60 AND MAYBE MAKE IT HIGHER
	PeriodicUpdateInterval = time.Second * 60
	activityThreshold      = time.Second * 20
	// CR nroyalty: remove before release
	simulatedLatency          = 350 * time.Millisecond
	simulatedJitterMs         = 1
	maxWaitBeforeSendingMoves = 200 * time.Millisecond
)

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
	conn                                           *websocket.Conn
	server                                         *Server
	send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED chan []byte
	position                                       atomic.Value
	lastSnapshotPosition                           atomic.Value
	moveBuffer                                     []*protocol.PieceDataForMove
	captureBuffer                                  []*protocol.PieceCapture
	bufferMu                                       sync.Mutex
	done                                           chan struct{}
	isClosed                                       atomic.Bool
	lastActionTime                                 atomic.Int64
	playingWhite                                   atomic.Bool
	moveScratchBuffer                              []byte
	moveScratchMu                                  sync.Mutex
	rpcLogger                                      zerolog.Logger
}

// CR nroyalty: think HARD about your send channel and how big it should be.
// it needs to be much smaller than the 2048 we used for benchmarking purposes.
// 64 might still be too large (?)
func NewClient(conn *websocket.Conn, server *Server, ipString string) *Client {
	c := &Client{
		conn:   conn,
		server: server,
		send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED: make(chan []byte, 32),
		position:       atomic.Value{},
		moveBuffer:     make([]*protocol.PieceDataForMove, 0, MOVE_BUFFER_SIZE),
		captureBuffer:  make([]*protocol.PieceCapture, 0, CAPTURE_BUFFER_SIZE),
		done:           make(chan struct{}),
		isClosed:       atomic.Bool{},
		bufferMu:       sync.Mutex{},
		lastActionTime: atomic.Int64{},
		playingWhite:   atomic.Bool{},
		rpcLogger:      NewRPCLogger(ipString),
	}
	c.isClosed.Store(false)
	c.lastActionTime.Store(time.Now().Unix())
	c.position.Store(Position{X: 0, Y: 0})
	c.lastSnapshotPosition.Store(Position{X: 0, Y: 0})
	c.rpcLogger.Info().
		Str("rpc", "NewClient").
		Send()
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

func (c *Client) compressAndSend(raw []byte, onDrop string) {
	var payload []byte
	if len(raw) < minCompressBytes {
		payload = raw
	} else {
		enc := GLOBAL_zstdPool.Get().(*zstd.Encoder)
		enc.Reset(nil)
		payload = enc.EncodeAll(raw, make([]byte, 0, len(raw)))
		GLOBAL_zstdPool.Put(enc)
	}
	select {
	case c.send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED <- payload:
		return
	case <-c.done:
		return
	default:
		c.Close("Send full: " + onDrop)
	}
}

func (c *Client) sendInitialState() {
	currentPosition := c.position.Load().(Position)
	snapshot := c.server.board.GetBoardSnapshot(currentPosition)

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
	c.compressAndSend(message, "sendInitialState")
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
	lastSnapshotPosition := c.lastSnapshotPosition.Load().(Position)
	if shouldSendSnapshot(lastSnapshotPosition, pos) {
		c.SendStateSnapshot()
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Close("ReadPump")
	}()

	c.conn.SetReadLimit(4096) // 4KB max message size
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
			log.Printf("Error unmarshalling message: %v", err)
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

// CR nroyalty: RATE LIMITS HERE!!
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
			log.Printf("Invalid move: %v", p)
			return
		}

		if moveType != protocol.MoveType_MOVE_TYPE_NORMAL &&
			moveType != protocol.MoveType_MOVE_TYPE_CASTLE &&
			moveType != protocol.MoveType_MOVE_TYPE_EN_PASSANT {
			log.Printf("Invalid move type: %v", moveType)
			return
		}

		c.BumpActive()

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

		c.server.moveRequests <- MoveRequest{
			Move:   move,
			Client: c,
		}
	case *protocol.ClientMessage_Subscribe:
		centerX := p.Subscribe.CenterX
		centerY := p.Subscribe.CenterY
		if !CoordInBoundsInt(centerX) || !CoordInBoundsInt(centerY) {
			return
		}
		c.rpcLogger.Info().
			Str("rpc", "Subscribe").
			Send()
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
		c.compressAndSend(message, "app-ping")
	default:
		log.Printf("Unknown message type: %v", p)
	}
}

func (c *Client) WritePump() {
	defer func() {
		c.Close("WritePump")
	}()

	pingTicker := time.NewTicker(time.Second * 10)
	defer pingTicker.Stop()

	for {
		select {
		case message, ok := <-c.send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED:
			if !ok {
				// Channel closed, server shutdown
				log.Printf("!!Channel closed, server shutdown!!")
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}
		case <-pingTicker.C:
			c.conn.WriteMessage(websocket.PingMessage, nil)
		case <-c.done:
			return
		}
	}
}

func (c *Client) SendPeriodicUpdates() {
	ticker := time.NewTicker(PeriodicUpdateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// CR nroyalty: we could avoid sending the periodic snapshot if
			// we've recently sent one due to them moving around.
			c.SendStateSnapshot()
		case <-c.done:
			return
		}
	}
}

func (c *Client) ProcessMoveUpdates() {
	ticker := time.NewTicker(maxWaitBeforeSendingMoves)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.MaybeSendMoveUpdates()
		case <-c.done:
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
	snapshot := c.server.board.GetBoardSnapshot(pos)
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
	c.compressAndSend(message, "SendStateSnapshot")
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

	c.compressAndSend(buf, "SendMoveUpdates")
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

	c.compressAndSend(message, "SendInvalidMove")
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

	c.compressAndSend(message, "SendValidMove")
}

func (c *Client) Close(why string) {
	if !c.isClosed.CompareAndSwap(false, true) {
		return
	}
	close(c.done)
	c.server.clientManager.UnregisterClient(c)
	c.conn.Close()
}
