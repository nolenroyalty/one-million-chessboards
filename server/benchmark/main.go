package main

import (
	"errors"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"one-million-chessboards/protocol"

	jsoniter "github.com/json-iterator/go"
	"github.com/klauspost/compress/zstd"
	"google.golang.org/protobuf/proto"

	"github.com/dustin/go-humanize"
	"github.com/gorilla/websocket"
)

var json = jsoniter.ConfigCompatibleWithStandardLibrary

var zstdMagic = [4]byte{0x28, 0xB5, 0x2F, 0xFD}

var decPool = sync.Pool{
	New: func() any {
		dec, _ := zstd.NewReader(nil) // no window limit; fine for ≤16 MB frames
		return dec
	},
}

const (
	localURL = "ws://localhost:8080/ws"
	prodURL  = "wss://onemillionchessboards.com/ws"
	useProd  = false
)

func getUrl() string {
	if useProd {
		return prodURL
	}
	return localURL
}

type MainCounter struct {
	numberOfSnapshots   atomic.Int64
	numberOfMoveUpdates atomic.Int64
	numberOfMoves       atomic.Int64
	numberOfCaptures    atomic.Int64
	receivedBytes       atomic.Int64
}

func (c *MainCounter) logStats() {
	log.Printf("BYTES: %s", humanize.Bytes(uint64(c.receivedBytes.Load())))
	log.Printf("SNAPSHOTS: %d", c.numberOfSnapshots.Load())
	log.Printf("MOVE UPDATES: %d", c.numberOfMoveUpdates.Load())
	log.Printf("MOVES: %d", c.numberOfMoves.Load())
	log.Printf("CAPTURES: %d", c.numberOfCaptures.Load())
}

func writeSubscribe(ws *websocket.Conn, boardX int, boardY int) {
	m := &protocol.ClientMessage{
		Payload: &protocol.ClientMessage_Subscribe{
			Subscribe: &protocol.ClientSubscribe{
				CenterX: uint32(4 + boardX*8),
				CenterY: uint32(4 + boardY*8),
			},
		},
	}
	message, err := proto.Marshal(m)
	if err != nil {
		log.Printf("Error marshalling subscribe: %v", err)
		return
	}
	ws.WriteMessage(websocket.BinaryMessage, message)
}

func writeMove(ws *websocket.Conn, pieceID int, fromX int, fromY int, toX int, toY int, moveType protocol.MoveType, moveToken int) {
	m := &protocol.ClientMessage{
		Payload: &protocol.ClientMessage_Move{
			Move: &protocol.ClientMove{
				PieceId:   uint32(pieceID),
				FromX:     uint32(fromX),
				FromY:     uint32(fromY),
				ToX:       uint32(toX),
				ToY:       uint32(toY),
				MoveType:  moveType,
				MoveToken: uint32(moveToken),
			},
		},
	}
	message, err := proto.Marshal(m)
	if err != nil {
		log.Printf("Error marshalling move: %v", err)
		return
	}
	ws.WriteMessage(websocket.BinaryMessage, message)
}

func ParseFrame(buf []byte) (*protocol.ServerMessage, error) {
	if len(buf) < 4 {
		return nil, errors.New("frame too small")
	}

	if buf[0] == zstdMagic[0] && buf[1] == zstdMagic[1] &&
		buf[2] == zstdMagic[2] && buf[3] == zstdMagic[3] {
		dec := decPool.Get().(*zstd.Decoder)
		var err error
		buf, err = dec.DecodeAll(buf, nil)
		decPool.Put(dec)
		if err != nil {
			return nil, err
		}
	}
	var out protocol.ServerMessage
	if err := proto.Unmarshal(buf, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CR nroyalty: instead of randomly disconnecting, maybe we should just
// resub to a new area?
func (c *MainCounter) randomlySubscribe(doReconnects bool) {
	for {
		ws, _, err := websocket.DefaultDialer.Dial(getUrl(), nil)
		done := make(chan struct{})

		if err != nil {
			time.Sleep(time.Millisecond * 300)
			goto restart
		}

		if doReconnects {
			sleepTimeJitter := time.Duration(rand.Intn(3000)) * time.Millisecond
			sleepTime := (time.Second * 1) + sleepTimeJitter

			go func() {
				time.Sleep(sleepTime)
				ws.Close()
				done <- struct{}{}
			}()
		}

		for {
			select {
			case <-done:
				goto restart
			default:
				_, message, err := ws.ReadMessage()
				if err != nil {
					goto restart
				}
				c.receivedBytes.Add(int64(len(message)))
				parsed, err := ParseFrame(message)

				if err != nil {
					goto restart
				}
				switch p := parsed.Payload.(type) {
				case *protocol.ServerMessage_InitialState:
					c.numberOfSnapshots.Add(1)
					// position := parsed["position"].(map[string]any)
					// x := int(position["x"].(float64))
					// y := int(position["y"].(float64))
					// log.Printf("Initial position: %d, %d", x, y)
				case *protocol.ServerMessage_MovesAndCaptures:
					c.numberOfMoveUpdates.Add(1)
					numberOfMoves := len(p.MovesAndCaptures.Moves)
					c.numberOfMoves.Add(int64(numberOfMoves))
					numberOfCaptures := len(p.MovesAndCaptures.Captures)
					c.numberOfCaptures.Add(int64(numberOfCaptures))
				case *protocol.ServerMessage_Snapshot:
					c.numberOfSnapshots.Add(1)
				}
			}
		}
	restart:
		continue
	}
}

func (c *MainCounter) ConnectAndLogSizes() {
	ws, _, err := websocket.DefaultDialer.Dial(getUrl(), nil)
	if err != nil {
		log.Fatal(err)
	}
	defer ws.Close()

	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			log.Fatal(err)
		}
		parsed, err := ParseFrame(message)
		if err != nil {
			log.Fatal(err)
		}
		var parsedType string
		switch parsed.Payload.(type) {
		case *protocol.ServerMessage_InitialState:
			parsedType = "initialState"
		case *protocol.ServerMessage_MovesAndCaptures:
			parsedType = "moveUpdates"
		case *protocol.ServerMessage_Snapshot:
			parsedType = "snapshot"
		}
		size := len(message)
		log.Printf("Type: %s, Size: %s", parsedType, humanize.Bytes(uint64(size)))
	}
}

const NUM_RANDOM_SUBSCRIPTIONS = 200
const NUM_RANDOM_MOVERS = 1000
const NUMBER_OF_MOVES = 1000
const TEST_RUN_TIME = 60 * time.Second

func (c *MainCounter) runRandomSubscribe(doReconnects bool) {
	var wg sync.WaitGroup
	wg.Add(NUM_RANDOM_SUBSCRIPTIONS)

	// Start all the random subscription goroutines
	for i := 0; i < NUM_RANDOM_SUBSCRIPTIONS; i++ {
		go func() {
			defer wg.Done()
			c.randomlySubscribe(doReconnects)
		}()
		time.Sleep(5 * time.Millisecond)
	}

	// Set up tickers
	statsTicker := time.NewTicker(5 * time.Second)
	doneTicker := time.NewTicker(TEST_RUN_TIME)
	defer statsTicker.Stop()
	defer doneTicker.Stop()

	// Log initial stats
	c.logStats()

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	for {
		select {
		case <-doneTicker.C:
			log.Printf("Test time completed")
			log.Printf("\n\nFINAL STATS\n")
			c.logStats()
			return
		case <-done:
			log.Printf("All goroutines completed")
			log.Printf("\n\nFINAL STATS\n")
			c.logStats()
			return
		case <-statsTicker.C:
			c.logStats()
		}
	}
}

type RandomMover struct {
	ws           *websocket.Conn
	boardX       int
	boardY       int
	pawnCount    int
	playingWhite bool
}

func newRandomMover(boardX int) *RandomMover {
	ws, _, err := websocket.DefaultDialer.Dial(getUrl(), nil)
	if err != nil {
		log.Printf("Error dialing: %v", err)
		return nil
	}
	rm := &RandomMover{
		ws:           ws,
		boardX:       boardX,
		boardY:       0,
		pawnCount:    0,
		playingWhite: false,
	}
	ready := make(chan struct{})
	go func() {

		_, message, err := rm.ws.ReadMessage()
		if err != nil {
			log.Printf("Error reading message: %v", err)
			return
		}

		parsed, err := ParseFrame(message)
		if err != nil {
			log.Printf("Error unmarshalling: %v", err)
			return
		}
		switch p := parsed.Payload.(type) {
		case *protocol.ServerMessage_InitialState:
			// log.Printf("Initial state")
			playingWhite := p.InitialState.PlayingWhite
			// log.Printf("Playing white: %v", playingWhite)
			rm.playingWhite = playingWhite
			close(ready)
		case *protocol.ServerMessage_Snapshot:
			log.Printf("State snapshot")
		}
	}()
	<-ready
	return rm
}

func (rm *RandomMover) subscribe() {
	writeSubscribe(rm.ws, rm.boardX, rm.boardY)
}

func (rm *RandomMover) movePawn() {
	idOffset := 17
	yOffset := 1
	if rm.playingWhite {
		idOffset = 1
		yOffset = 6
	}
	pawnX := 8*rm.boardX + (rm.pawnCount % 8)
	pawnY := 8*rm.boardY + yOffset

	targetY := pawnY + 2
	if rm.playingWhite {
		targetY = pawnY - 2
	}

	pawnID := rm.boardX*32000 + 32*rm.boardY + (rm.pawnCount % 8) + idOffset
	writeMove(rm.ws, pawnID, pawnX, pawnY, pawnX, targetY, protocol.MoveType_MOVE_TYPE_NORMAL, rm.pawnCount+1)
	rm.pawnCount++
	if (rm.pawnCount % 8) == 0 {
		rm.boardY++
	}
}

func (c *MainCounter) runRandomMover(boardX int) {
	rm := newRandomMover(boardX)
	if rm == nil {
		return
	}
	rm.subscribe()
	for i := 0; i < NUMBER_OF_MOVES; i++ {
		rm.movePawn()
		time.Sleep(6 * time.Millisecond)
	}
}

func (c *MainCounter) runAllRandomMovers() {
	wg := sync.WaitGroup{}
	wg.Add(NUM_RANDOM_MOVERS)
	for boardX := 0; boardX < NUM_RANDOM_MOVERS; boardX++ {
		go func(boardX int) {
			defer wg.Done()
			c.runRandomMover(boardX)
		}(boardX)
		time.Sleep(2 * time.Millisecond)
	}
	wg.Wait()
}

const DO_SUBSCRIBE = true
const DO_MOVE = true
const DO_RECONNECTS = true

func main() {
	counter := MainCounter{}
	wg := sync.WaitGroup{}
	if DO_SUBSCRIBE {
		wg.Add(1)
		go func() {
			defer wg.Done()
			counter.runRandomSubscribe(DO_RECONNECTS)
		}()
	}
	if DO_MOVE {
		wg.Add(1)
		go func() {
			defer wg.Done()
			counter.runAllRandomMovers()
		}()
	}
	wg.Wait()
}
