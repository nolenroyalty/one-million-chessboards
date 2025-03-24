package server

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	PeriodicUpdateInterval = time.Second * 2
)

// Client represents a connected websocket client
type Client struct {
	conn             *websocket.Conn
	server           *Server
	send             chan []byte
	position         Position
	lastSnapshotTime time.Time
	currentZones     map[ZoneCoord]struct{}
	moveBuffer       []PieceMove
	captureBuffer    []PieceCapture
	bufferMu         sync.Mutex
	done             chan struct{}
	closeMu          sync.Mutex
	isClosed         bool
}

// SubscriptionRequest represents a client request to subscribe to a position
type SubscriptionRequest struct {
	Client *Client
	Zone   ZoneCoord
}

// NewClient creates a new client instance
func NewClient(conn *websocket.Conn, server *Server) *Client {
	return &Client{
		conn:             conn,
		server:           server,
		send:             make(chan []byte, 256),
		position:         Position{X: 0, Y: 0},
		currentZones:     make(map[ZoneCoord]struct{}),
		moveBuffer:       make([]PieceMove, 0, 400),
		captureBuffer:    make([]PieceCapture, 0, 100),
		done:             make(chan struct{}),
		isClosed:         false,
		bufferMu:         sync.Mutex{},
		closeMu:          sync.Mutex{},
		lastSnapshotTime: time.Now().Add(-30 * time.Second), // Allow immediate snapshot
	}
}

func (c *Client) Run() {
	go c.ReadPump()
	go c.WritePump()
	go c.SendPeriodicUpdates()
	go c.ProcessMoveUpdates()
}

// ReadPump handles incoming messages from the client
func (c *Client) ReadPump() {
	defer func() {
		c.server.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(8192) // 8KB max message size
	c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		log.Printf("Received pong")
		c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
		if err != nil {
			if websocket.IsUnexpectedCloseError(err) {
				log.Printf("client disconnected: %v", err)
			}
			break
		}

		c.handleMessage(message)
	}
}


func CoordInBounds(coord float64) bool {
	return coord >= 0 && uint16(coord) < BOARD_SIZE
}

// handleMessage processes incoming messages from clients
func (c *Client) handleMessage(message []byte) {
	// Parse the JSON message
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		c.SendError("Invalid message format")
		return
	}

	// Get the message type
	msgType, ok := msg["type"].(string)
	if !ok {
		c.SendError("Missing message type")
		return
	}

	switch msgType {
	case "move":
		// Extract move parameters
		pieceID, _ := msg["pieceId"].(float64)
		fromX, _ := msg["fromX"].(float64)
		fromY, _ := msg["fromY"].(float64)
		toX, _ := msg["toX"].(float64)
		toY, _ := msg["toY"].(float64)

		log.Printf("Received move: %v", msg)

		// Basic bounds checking
		if !CoordInBounds(fromX) || !CoordInBounds(fromY) ||
			!CoordInBounds(toX) || !CoordInBounds(toY) {
			c.SendError("Invalid coordinates")
			return
		}

		log.Printf("Submitting move request")

		// Submit the move request
		c.server.moveRequests <- MoveRequest{
			Move: Move{
				PieceID: uint64(pieceID),
				FromX:   uint16(fromX),
				FromY:   uint16(fromY),
				ToX:     uint16(toX),
				ToY:     uint16(toY),
			},
			Client: c,
		}

	case "subscribe":
		// Extract subscription parameters
		centerX, _ := msg["centerX"].(float64)
		centerY, _ := msg["centerY"].(float64)

		// Basic bounds checking
		if !CoordInBounds(centerX) || !CoordInBounds(centerY) {
			c.SendError("Invalid coordinates")
			return
		}

		// Submit the subscription request
		c.server.subscriptions <- SubscriptionRequest{
			Client: c,
			Zone:      ZoneCoord{X: uint16(centerX), Y: uint16(centerY)},
		}

	case "requestSnapshot":
		// Rate limit snapshot requests
		if c.canRequestSnapshot() {
			snapshot := c.server.board.GetStateForPosition(c.position)
			c.SendStateSnapshot(snapshot)
		}

	case "app-ping":
		log.Printf("Received app ping")
		type AppPong struct {
			Type string `json:"type"`
			Time int64 `json:"time"`
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
		c.conn.Close()
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
			log.Printf("Sending ping")
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
			if len(c.currentZones) > 0 {
				log.Printf("Sending periodic update")
				snapshot := c.server.board.GetStateForPosition(c.position)
				c.SendStateSnapshot(snapshot)
			} else {
				log.Printf("No zones to update")
			}
		case <-c.done:
			log.Printf("Stopping periodic updates")
			return
		}
	}
}

// ProcessMoveUpdates sends pending move updates to the client
func (c *Client) ProcessMoveUpdates() {
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.bufferMu.Lock()
			if len(c.moveBuffer) > 0 || len(c.captureBuffer) > 0 {
				// Copy buffers and clear
				moves := make([]PieceMove, len(c.moveBuffer))
				captures := make([]PieceCapture, len(c.captureBuffer))

				copy(moves, c.moveBuffer)
				copy(captures, c.captureBuffer)

				c.moveBuffer = c.moveBuffer[:0]
				c.captureBuffer = c.captureBuffer[:0]

				c.bufferMu.Unlock()

				// Send the updates
				c.SendMoveUpdates(moves, captures)
			} else {
				c.bufferMu.Unlock()
			}

		case <-c.done:
			return
		}
	}
}


// AddMoveToBuffer adds a move to the client's move buffer
func (c *Client) AddMoveToBuffer(move PieceMove) {
	c.bufferMu.Lock()
	defer c.bufferMu.Unlock()

	c.moveBuffer = append(c.moveBuffer, move)

	// Send immediately if buffer gets large
	if len(c.moveBuffer) >= 400 {
		moves := make([]PieceMove, len(c.moveBuffer))
		copy(moves, c.moveBuffer)
		c.moveBuffer = c.moveBuffer[:0]

		captures := make([]PieceCapture, len(c.captureBuffer))
		copy(captures, c.captureBuffer)
		c.captureBuffer = c.captureBuffer[:0]

		// Launch goroutine to avoid blocking
		go c.SendMoveUpdates(moves, captures)
	}
}

// AddCaptureToBuffer adds a capture to the client's capture buffer
func (c *Client) AddCaptureToBuffer(capture PieceCapture) {
	c.bufferMu.Lock()
	defer c.bufferMu.Unlock()

	c.captureBuffer = append(c.captureBuffer, capture)
}

// SendStateSnapshot sends a state snapshot to the client
func (c *Client) SendStateSnapshot(snapshot StateSnapshot) {
	// Create JSON message for state snapshot
	type PieceData struct {
		ID        uint64    `json:"id"`
		X         uint16    `json:"x"`
		Y         uint16    `json:"y"`
		Type      PieceType `json:"type"`
		IsWhite   bool      `json:"isWhite"`
		MoveState MoveState `json:"moveState"`
	}

	type SnapshotMessage struct {
		Type      string      `json:"type"`
		Pieces    []PieceData `json:"pieces"`
		AreaMinX  uint16      `json:"areaMinX"`
		AreaMinY  uint16      `json:"areaMinY"`
		AreaMaxX  uint16      `json:"areaMaxX"`
		AreaMaxY  uint16      `json:"areaMaxY"`
		StartingSeqNum uint64 `json:"startingSeqNum"`
		EndingSeqNum uint64 `json:"endingSeqNum"`
	}

	// Convert pieces to the message format
	pieces := make([]PieceData, len(snapshot.Pieces))
	for i, piece := range snapshot.Pieces {
		pieces[i] = PieceData{
			ID:        piece.Piece.ID,
			X:         piece.X,
			Y:         piece.Y,
			Type:      piece.Piece.Type,
			IsWhite:   piece.Piece.IsWhite,
			MoveState: piece.Piece.MoveState,
		}
	}

	message := SnapshotMessage{
		Type:      "stateSnapshot",
		Pieces:    pieces,
		AreaMinX:  snapshot.AreaMinX,
		AreaMinY:  snapshot.AreaMinY,
		AreaMaxX:  snapshot.AreaMaxX,
		AreaMaxY:  snapshot.AreaMaxY,
		StartingSeqNum: snapshot.StartingSeqNum,
		EndingSeqNum: snapshot.EndingSeqNum,
	}

	// Marshal to JSON
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling snapshot: %v", err)
		return
	}

	// Send through the channel
	select {
	case <-c.done:
		return
	case c.send <- data:
		// Sent successfully
	default:
		// Buffer full, client might be slow or disconnected
		c.server.unregister <- c
	}
}

// SendMoveUpdates sends move and capture updates to the client
func (c *Client) SendMoveUpdates(moves []PieceMove, captures []PieceCapture) {
	// Create a proper JSON message structure
	type MoveUpdateMessage struct {
		Type      string         `json:"type"`
		Moves     []PieceMove    `json:"moves"`
		Captures  []PieceCapture `json:"captures"`
	}

	message := MoveUpdateMessage{
		Type:      "moveUpdates",
		Moves:     moves,
		Captures:  captures,
	}

	// Marshal to JSON
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling move updates: %v", err)
		return
	}

	// Send through the channel
	select {
	case <-c.done:
		return
	case c.send <- data:
		// Sent successfully
	default:
		// Buffer full, client might be slow or disconnected
		c.server.unregister <- c
	}
}

// SendError sends an error message to the client
func (c *Client) SendError(errorMessage string) {
	// Create a simple error message using JSON
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

	// Marshal to JSON
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling error message: %v", err)
		return
	}

	// Send through the channel
	select {
	case <-c.done:
		return
	case c.send <- data:
		// Sent successfully
	default:
		// Buffer full, client might be slow or disconnected
		c.server.unregister <- c
	}
}

// canRequestSnapshot checks if the client can request a snapshot (rate limiting)
func (c *Client) canRequestSnapshot() bool {
	return true
	//now := time.Now()
	//if now.Sub(c.lastSnapshotTime) < 5*time.Second {
	//return false
	//}
	//c.lastSnapshotTime = now
	//return true
}

// Close closes the client connection
func (c *Client) Close() {
	c.closeMu.Lock()
	defer c.closeMu.Unlock()

	if c.isClosed {
		return
	}

	close(c.done)
	c.conn.Close()
	c.isClosed = true
}
