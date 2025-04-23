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
	"google.golang.org/protobuf/proto"
)

var zstdPool = sync.Pool{
	New: func() any {
		enc, _ := zstd.NewWriter(
			nil,
			zstd.WithEncoderLevel(zstd.SpeedFastest),
			zstd.WithEncoderConcurrency(1),
		)
		return enc
	},
}

// CR nroyalty: send seqnum with global stats and then updating global stats is
// pretty easy.
// CR nroyalty: standardize on a function for sending a message to the client or unsubbing

const (
	// CR nroyalty: MAKE SURE THIS IS NOT BELOW 60 AND MAYBE MAKE IT HIGHER
	PeriodicUpdateInterval = time.Second * 60
	activityThreshold      = time.Second * 20
	// CR nroyalty: remove before release
	simulatedLatency          = 1 * time.Millisecond
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
	moveBuffer                                     []PieceMove
	captureBuffer                                  []PieceCapture
	bufferMu                                       sync.Mutex
	done                                           chan struct{}
	isClosed                                       atomic.Bool
	lastActionTime                                 atomic.Int64
	playingWhite                                   atomic.Bool
}

// CR nroyalty: think HARD about your send channel and how big it should be.
// it should probably be smaller than 2048, but it's nice for it to be this size
// for benchmarking purposes.
func NewClient(conn *websocket.Conn, server *Server) *Client {
	c := &Client{
		conn:   conn,
		server: server,
		send_DO_NOT_DO_RAW_WRITES_OR_YOU_WILL_BE_FIRED: make(chan []byte, 2048),
		position:       atomic.Value{},
		moveBuffer:     make([]PieceMove, 0, MOVE_BUFFER_SIZE),
		captureBuffer:  make([]PieceCapture, 0, CAPTURE_BUFFER_SIZE),
		done:           make(chan struct{}),
		isClosed:       atomic.Bool{},
		bufferMu:       sync.Mutex{},
		lastActionTime: atomic.Int64{},
		playingWhite:   atomic.Bool{},
	}
	c.isClosed.Store(false)
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

func (c *Client) compresAndSend(raw []byte, onDrop string) {
	var payload []byte
	if len(raw) < minCompressBytes {
		payload = raw
	} else {
		enc := zstdPool.Get().(*zstd.Encoder)
		enc.Reset(nil)
		payload = enc.EncodeAll(raw, make([]byte, 0, len(raw)))
		zstdPool.Put(enc)
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

type InitialInfo struct {
	Type         string         `json:"type"`
	Position     Position       `json:"position"`
	PlayingWhite bool           `json:"playingWhite"`
	Snapshot     *StateSnapshot `json:"snapshot"`
}

func (c *Client) sendInitialState() {
	currentPosition := c.position.Load().(Position)
	snapshot := c.server.board.GetBoardSnapshot(currentPosition)

	initialInfo := InitialInfo{
		Type:         "initialState",
		Position:     currentPosition,
		PlayingWhite: c.playingWhite.Load(),
		Snapshot:     snapshot,
	}
	data, err := json.Marshal(&initialInfo)
	if err != nil {
		log.Printf("Error marshaling initial info: %v", err)
		return
	}
	c.compresAndSend(data, "sendInitialState")
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

const SNAPSHOT_THRESHOLD = 15

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
		if err != nil {
			// log.Printf("Error reading message: %v", err)
			break
		}
		var msg protocol.ClientMessage
		if err := proto.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshalling message: %v", err)
			continue
		}
		c.conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		// if err != nil {
		// 	// log.Printf("Error reading message: %v", err)
		// 	// if websocket.IsUnexpectedCloseError(err) {
		// 	// 	now := time.Now().UnixNano()
		// 	// 	log.Printf("client disconnected: %v, %d", err, now)
		// 	// }
		// 	break
		// }

		// c.handleMessage(msg)
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

		if !CoordInBoundsInt(fromX) || !CoordInBoundsInt(fromY) ||
			!CoordInBoundsInt(toX) || !CoordInBoundsInt(toY) {
			log.Printf("Invalid move: %v", p)
			return
		}

		if moveType != protocol.MoveType_MOVE_TYPE_NORMAL &&
			moveType != protocol.MoveType_MOVE_TYPE_CASTLE &&
			moveType != protocol.MoveType_MOVE_TYPE_ENPASSANT {
			log.Printf("Invalid move type: %v", moveType)
			return
		}

		c.BumpActive()

		move := Move{
			PieceID:   pieceID,
			FromX:     uint16(fromX),
			FromY:     uint16(fromY),
			ToX:       uint16(toX),
			ToY:       uint16(toY),
			MoveType:  moveType,
			MoveToken: moveToken,
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
		c.BumpActive()
		c.UpdatePositionAndMaybeSnapshot(Position{X: uint16(centerX), Y: uint16(centerY)})
	case *protocol.ClientMessage_Ping:
		type AppPong struct {
			Type string `json:"type"`
		}
		appPong := AppPong{
			Type: "app-pong",
		}
		data, err := json.Marshal(appPong)
		if err != nil {
			log.Printf("Error marshaling app pong: %v", err)
			return
		}
		c.compresAndSend(data, "app-ping")
	default:
		log.Printf("Unknown message type: %v", p)
	}
}

// func (c *Client) handleMessage(message []byte) {
// 	var msg map[string]interface{}
// 	if err := json.Unmarshal(message, &msg); err != nil {
// 		return
// 	}

// 	msgType, ok := msg["type"].(string)
// 	if !ok {
// 		return
// 	}

// 	switch msgType {
// 	case "move":
// 		// CR nroyalty: validate that the move is somewhere that the player
// 		// is currently looking at
// 		pieceID, _ := msg["pieceId"].(float64)
// 		fromX, _ := msg["fromX"].(float64)
// 		fromY, _ := msg["fromY"].(float64)
// 		toX, _ := msg["toX"].(float64)
// 		toY, _ := msg["toY"].(float64)
// 		moveType, _ := msg["moveType"].(float64)
// 		moveTypeEnum := MoveType(int(moveType))
// 		moveToken, _ := msg["moveToken"].(float64)

// 		// Basic bounds checking
// 		if !CoordInBounds(fromX) || !CoordInBounds(fromY) ||
// 			!CoordInBounds(toX) || !CoordInBounds(toY) {
// 			return
// 		}
// 		c.BumpActive()

// 		move := Move{
// 			PieceID:              uint32(pieceID),
// 			FromX:                uint16(fromX),
// 			FromY:                uint16(fromY),
// 			ToX:                  uint16(toX),
// 			ToY:                  uint16(toY),
// 			MoveType:             moveTypeEnum,
// 			MoveToken:            uint32(moveToken),
// 			ClientIsPlayingWhite: c.playingWhite.Load(),
// 		}

// 		// CR nroyalty: maybe we don't want to block here? We could just
// 		// reject the move
// 		c.server.moveRequests <- MoveRequest{
// 			Move:   move,
// 			Client: c,
// 		}

// 	case "subscribe":
// 		centerX, ok := msg["centerX"].(float64)
// 		if !ok {
// 			return
// 		}
// 		centerY, ok := msg["centerY"].(float64)
// 		if !ok {
// 			return
// 		}

// 		// Basic bounds checking
// 		if !CoordInBounds(centerX) || !CoordInBounds(centerY) {
// 			return
// 		}
// 		centerXInt := uint16(centerX)
// 		centerYInt := uint16(centerY)

// 		if centerXInt == c.position.Load().(Position).X && centerYInt == c.position.Load().(Position).Y {
// 			return
// 		}

// 		c.BumpActive()
// 		c.UpdatePositionAndMaybeSnapshot(Position{X: centerXInt, Y: centerYInt})

// 	case "app-ping":
// 		type AppPong struct {
// 			Type string `json:"type"`
// 		}
// 		appPong := AppPong{
// 			Type: "app-pong",
// 		}
// 		data, err := json.Marshal(appPong)
// 		if err != nil {
// 			log.Printf("Error marshaling app pong: %v", err)
// 			return
// 		}
// 		c.compresAndSend(data, "app-ping")
// 	}
// }

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

func (c *Client) AddMovesToBuffer(moves []PieceMove, capture *PieceCapture) {
	if c.isClosed.Load() {
		return
	}
	c.bufferMu.Lock()
	defer c.bufferMu.Unlock()

	c.moveBuffer = append(c.moveBuffer, moves...)
	if capture != nil {
		c.captureBuffer = append(c.captureBuffer, *capture)
	}

	// Send immediately if buffer gets large
	if len(c.moveBuffer) >= MOVE_BUFFER_SIZE || len(c.captureBuffer) >= CAPTURE_BUFFER_SIZE {
		go c.MaybeSendMoveUpdates()
	}
}

func (c *Client) SendStateSnapshot() {
	pos := c.position.Load().(Position)
	snapshot := c.server.board.GetBoardSnapshot(pos)
	data, err := json.Marshal(snapshot)
	if err != nil {
		log.Printf("Error marshaling snapshot: %v", err)
		return
	}
	c.lastSnapshotPosition.Store(pos)
	c.compresAndSend(data, "SendStateSnapshot")
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
	moves := make([]PieceMove, len(c.moveBuffer))
	captures := make([]PieceCapture, len(c.captureBuffer))
	copy(moves, c.moveBuffer)
	copy(captures, c.captureBuffer)
	c.moveBuffer = c.moveBuffer[:0]
	c.captureBuffer = c.captureBuffer[:0]
	c.bufferMu.Unlock()

	type MoveUpdateMessage struct {
		Type     string         `json:"type"`
		Moves    []PieceMove    `json:"moves"`
		Captures []PieceCapture `json:"captures"`
	}

	message := MoveUpdateMessage{
		Type:     "moveUpdates",
		Moves:    moves,
		Captures: captures,
	}

	data, err := json.Marshal(&message)
	if err != nil {
		log.Printf("Error marshaling move updates: %v", err)
		return
	}

	c.compresAndSend(data, "SendMoveUpdates")
}

func (c *Client) SendInvalidMove(moveToken uint32) {
	message := struct {
		Type      string `json:"type"`
		MoveToken uint32 `json:"moveToken"`
	}{
		Type:      "invalidMove",
		MoveToken: moveToken,
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling invalid move: %v", err)
		return
	}

	c.compresAndSend(data, "SendInvalidMove")
}

func (c *Client) SendValidMove(moveToken uint32, asOfSeqnum uint64, capturedPieceId uint32) {
	message := struct {
		Type            string `json:"type"`
		MoveToken       uint32 `json:"moveToken"`
		AsOfSeqnum      uint64 `json:"asOfSeqnum"`
		CapturedPieceID uint32 `json:"capturedPieceId"`
	}{
		Type:            "validMove",
		MoveToken:       moveToken,
		AsOfSeqnum:      asOfSeqnum,
		CapturedPieceID: capturedPieceId,
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling validated move: %v", err)
		return
	}

	c.compresAndSend(data, "SendValidMove")
}

func (c *Client) Close(why string) {
	if !c.isClosed.CompareAndSwap(false, true) {
		return
	}
	// log.Printf("Closing client: %s", why)

	close(c.done)
	c.server.clientManager.UnregisterClient(c)
	c.conn.Close()
}
