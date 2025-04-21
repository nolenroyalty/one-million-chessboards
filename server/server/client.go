package server

// CR nroyalty: it would be nice if we ran all of our to-client actions through a
// queue that let us guarantee better ordering of the messages that they receive...

// CR nroyalty: figure out how to debounce snapshot requests to the degree that we can;
// also make sure when we move to a read-lock approach that we use our latest position
// after getting the lock, instead of the position from when we tried to take the lock.

// CR nroyalty: we need to specify whether the client is playing white or black
// and then use that to determine which pieces they can move.
import (
	"fmt"
	"log"
	"math"
	"sync"
	"sync/atomic"
	"time"

	jsoniter "github.com/json-iterator/go"

	"github.com/gorilla/websocket"
)

// CR nroyalty: send seqnum with global stats and then updating global stats is
// pretty easy.
// CR nroyalty: standardize on a function for sending a message to the client or unsubbing
// CR nroyalty: look for places where we can pass pointers for serialization instead of copying

const (
	// CR nroyalty: MAKE SURE THIS IS NOT BELOW 60 AND MAYBE MAKE IT HIGHER
	PeriodicUpdateInterval = time.Second * 60
	activityThreshold      = time.Second * 20
	// CR nroyalty: remove before release
	simulatedLatency          = 1 * time.Millisecond
	simulatedJitterMs         = 1
	moveBufferSize            = 200
	captureBufferSize         = 100
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

// CR nroyalty: removing starting and ending seqnum (we'll use a mutex to make this safe)
type SnapshotMessage struct {
	Type           string      `json:"type"`
	Pieces         []PieceData `json:"pieces"`
	StartingSeqnum uint64      `json:"startingSeqnum"`
	EndingSeqnum   uint64      `json:"endingSeqnum"`
	Seqnum         uint64      `json:"seqnum"`
	XCoord         uint16      `json:"xCoord"`
	YCoord         uint16      `json:"yCoord"`
}

func (snapshot *StateSnapshot) ToSnapshotMessage() SnapshotMessage {
	pieces := make([]PieceData, len(snapshot.Pieces))
	for i, piece := range snapshot.Pieces {
		pieces[i] = PieceData{
			ID:              piece.Piece.ID,
			X:               piece.X,
			Y:               piece.Y,
			Type:            piece.Piece.Type,
			IsWhite:         piece.Piece.IsWhite,
			JustDoubleMoved: piece.Piece.JustDoubleMoved,
			MoveCount:       piece.Piece.MoveCount,
			CaptureCount:    piece.Piece.CaptureCount,
		}
	}

	message := SnapshotMessage{
		Type:   "stateSnapshot",
		Pieces: pieces,
		Seqnum: snapshot.Seqnum,
		XCoord: snapshot.XCoord,
		YCoord: snapshot.YCoord,
	}

	return message
}

type Client struct {
	conn                 *websocket.Conn
	server               *Server
	send                 chan []byte
	position             atomic.Value
	lastSnapshotPosition atomic.Value
	moveBuffer           []PieceMove
	captureBuffer        []PieceCapture
	bufferMu             sync.Mutex
	done                 chan struct{}
	isClosed             atomic.Bool
	lastActionTime       atomic.Int64
	playingWhite         atomic.Bool
}

// CR nroyalty: think HARD about your send channel and how big it should be.
// it should probably be smaller than 2048, but it's nice for it to be this size
// for benchmarking purposes.
func NewClient(conn *websocket.Conn, server *Server) *Client {
	c := &Client{
		conn:           conn,
		server:         server,
		send:           make(chan []byte, 2048),
		position:       atomic.Value{},
		moveBuffer:     make([]PieceMove, 0, moveBufferSize),
		captureBuffer:  make([]PieceCapture, 0, captureBufferSize),
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
	// c.server.clientManager.AddClientToZones(c, pos)
	go c.ReadPump()
	go c.WritePump()
	go c.SendPeriodicUpdates()
	go c.ProcessMoveUpdates()
	// CR nroyalty: this should be one update that includes an initial state
	// snapshot when we move to protobuffs
	c.sendInitialState()
}

type InitialInfo struct {
	Type               string              `json:"type"`
	MinimapAggregation jsoniter.RawMessage `json:"minimapAggregation"`
	GlobalStats        jsoniter.RawMessage `json:"globalStats"`
	Position           Position            `json:"position"`
	PlayingWhite       bool                `json:"playingWhite"`
	Snapshot           SnapshotMessage     `json:"snapshot"`
	ConnectedUsers     uint32              `json:"connectedUsers"`
}

func (c *Client) sendInitialState() {
	aggregation := c.server.minimapAggregator.GetLastAggregation()
	stats := c.server.GetCurrentStats()
	currentPosition := c.position.Load().(Position)
	snapshot := c.server.board.GetBoardSnapshot(currentPosition)

	initialInfo := InitialInfo{
		Type:               "initialState",
		ConnectedUsers:     uint32(c.server.clientManager.GetClientCount()),
		MinimapAggregation: aggregation,
		GlobalStats:        stats,
		Position:           currentPosition,
		PlayingWhite:       c.playingWhite.Load(),
		Snapshot:           snapshot.ToSnapshotMessage(),
	}
	data, err := json.Marshal(initialInfo)
	if err != nil {
		log.Printf("Error marshaling initial info: %v", err)
		return
	}
	select {
	case c.send <- data:
	case <-c.done:
		return
	default:
		c.Close("send full: sendInitialState")
	}
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
		snapshot := c.server.board.GetBoardSnapshot(pos)
		c.SendStateSnapshot(snapshot)
		c.lastSnapshotPosition.Store(pos)
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Close("ReadPump")
	}()

	c.conn.SetReadLimit(8192) // 8KB max message size
	c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
		if err != nil {
			// if websocket.IsUnexpectedCloseError(err) {
			// 	now := time.Now().UnixNano()
			// 	log.Printf("client disconnected: %v, %d", err, now)
			// }
			break
		}

		c.handleMessage(message)
	}
}

func CoordInBounds(coord float64) bool {
	return coord >= 0 && uint16(coord) < BOARD_SIZE
}

// CR nroyalty: RATE LIMITS HERE!!
func (c *Client) handleMessage(message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		c.SendError("Invalid message format")
		return
	}

	msgType, ok := msg["type"].(string)
	if !ok {
		c.SendError("Missing message type")
		return
	}

	switch msgType {
	case "move":
		pieceID, _ := msg["pieceId"].(float64)
		fromX, _ := msg["fromX"].(float64)
		fromY, _ := msg["fromY"].(float64)
		toX, _ := msg["toX"].(float64)
		toY, _ := msg["toY"].(float64)
		moveType, _ := msg["moveType"].(float64)
		moveTypeEnum := MoveType(int(moveType))
		moveToken, _ := msg["moveToken"].(float64)

		// Basic bounds checking
		if !CoordInBounds(fromX) || !CoordInBounds(fromY) ||
			!CoordInBounds(toX) || !CoordInBounds(toY) {
			c.SendError("Invalid coordinates")
			return
		}
		c.BumpActive()

		move := Move{
			PieceID:              uint32(pieceID),
			FromX:                uint16(fromX),
			FromY:                uint16(fromY),
			ToX:                  uint16(toX),
			ToY:                  uint16(toY),
			MoveType:             moveTypeEnum,
			MoveToken:            uint32(moveToken),
			ClientIsPlayingWhite: c.playingWhite.Load(),
		}

		// CR nroyalty: maybe we don't want to block here? We could just
		// reject the move
		c.server.moveRequests <- MoveRequest{
			Move:   move,
			Client: c,
		}

	case "subscribe":
		centerX, ok := msg["centerX"].(float64)
		if !ok {
			c.SendError("Invalid coordinates")
			return
		}
		centerY, ok := msg["centerY"].(float64)
		if !ok {
			c.SendError("Invalid coordinates")
			return
		}

		// Basic bounds checking
		if !CoordInBounds(centerX) || !CoordInBounds(centerY) {
			c.SendError("Invalid coordinates")
			return
		}
		centerXInt := uint16(centerX)
		centerYInt := uint16(centerY)

		if centerXInt == c.position.Load().(Position).X && centerYInt == c.position.Load().(Position).Y {
			return
		}

		c.BumpActive()
		c.UpdatePositionAndMaybeSnapshot(Position{X: centerXInt, Y: centerYInt})

	case "app-ping":
		type AppPong struct {
			Type string `json:"type"`
			Time int64  `json:"time"`
		}
		appPong := AppPong{
			Type: "app-pong",
			Time: time.Now().UnixNano(),
		}
		data, err := json.Marshal(appPong)
		if err != nil {
			log.Printf("Error marshaling app pong: %v", err)
			return
		}
		select {
		case c.send <- data:
		case <-c.done:
			return
		}
	}
}

// WritePump handles sending messages to the client
func (c *Client) WritePump() {
	defer func() {
		c.Close("WritePump")
	}()

	pingTicker := time.NewTicker(time.Second * 10)
	defer pingTicker.Stop()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				// Channel closed, server shutdown
				log.Printf("!!Channel closed, server shutdown!!")
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			// CR nroyalty: change this to binary
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-pingTicker.C:
			pingData := []byte(fmt.Sprintf("ping-%d", time.Now().UnixNano()))
			c.conn.WriteMessage(websocket.PingMessage, pingData)
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
			// log.Printf("Sending periodic update for position: %v", c.position.Load().(Position))
			snapshot := c.server.board.GetBoardSnapshot(c.position.Load().(Position))
			c.SendStateSnapshot(snapshot)
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
			c.bufferMu.Lock()
			if len(c.moveBuffer) > 0 || len(c.captureBuffer) > 0 {
				moves := make([]PieceMove, len(c.moveBuffer))
				captures := make([]PieceCapture, len(c.captureBuffer))

				copy(moves, c.moveBuffer)
				copy(captures, c.captureBuffer)

				c.moveBuffer = c.moveBuffer[:0]
				c.captureBuffer = c.captureBuffer[:0]

				c.bufferMu.Unlock()

				c.SendMoveUpdates(moves, captures)
			} else {
				c.bufferMu.Unlock()
			}

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
	if len(c.moveBuffer) >= moveBufferSize || len(c.captureBuffer) >= captureBufferSize {
		moves := make([]PieceMove, len(c.moveBuffer))
		copy(moves, c.moveBuffer)
		c.moveBuffer = c.moveBuffer[:0]

		captures := make([]PieceCapture, len(c.captureBuffer))
		copy(captures, c.captureBuffer)
		c.captureBuffer = c.captureBuffer[:0]

		go c.SendMoveUpdates(moves, captures)
	}
}

// CR nroyalty: rework this code to avoid so much copying!!!!!
// CR nroyalty: also, this code can do the allocation of the slice, pass it to
// getboardsnapshot, and then return the slice to the pool after parsing it. No need
// to do that work in board I think.
func (c *Client) SendStateSnapshot(snapshot StateSnapshot) {
	message := snapshot.ToSnapshotMessage()
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling snapshot: %v", err)
		return
	}

	select {
	case <-c.done:
		return
	case c.send <- data:
	default:
		c.Close("send full: SendStateSnapshot")
	}
}

// PERFORMANCE nroyalty: To avoid the cost of sending information about each piece
// with our move data, we could compute whether a move JUST entered a client's
// view and send it as a separate "Annotated Move" with the additional info.
// This probably doesn't save us that much (a few bytes) but it could add up
// SendMoveUpdates sends move and capture updates to the client
func (c *Client) SendMoveUpdates(moves []PieceMove, captures []PieceCapture) {
	// Create a proper JSON message structure
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

	select {
	case <-c.done:
		return
	case c.send <- data:
	default:
		c.Close("send full: SendMoveUpdates")
	}
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

	select {
	case <-c.done:
		return
	case c.send <- data:
	default:
		c.Close("send full: SendInvalidMove")
	}
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

	select {
	case <-c.done:
		return
	case c.send <- data:
	default:
		c.Close("send full: SendValidMove")
	}
}

func (c *Client) SendError(errorMessage string) {
	message := struct {
		Type    string `json:"type"`
		Message string `json:"message"`
		Code    int    `json:"code"`
	}{
		Type:    "error",
		Message: errorMessage,
		Code:    1, // Generic error code
	}

	log.Printf("Sending error: %v", message)

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling error message: %v", err)
		return
	}

	select {
	case <-c.done:
		return
	case c.send <- data:
	default:
		c.Close("send full: SendError")
	}
}

func (c *Client) SendMinimapUpdate(aggregation jsoniter.RawMessage) {
	select {
	case <-c.done:
		return
	case c.send <- aggregation:
	default:
		c.Close("send full: SendMinimapUpdate")
	}
}

func (c *Client) SendGlobalStats(stats jsoniter.RawMessage) {
	select {
	case <-c.done:
		return
	case c.send <- stats:
	default:
		c.Close("send full: SendGlobalStats")
	}
}

func (c *Client) Close(why string) {
	if !c.isClosed.CompareAndSwap(false, true) {
		return
	}
	log.Printf("Closing client: %s", why)

	close(c.done)
	c.server.clientManager.UnregisterClient(c)
	c.conn.Close()
}
