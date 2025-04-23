package main

import (
	"errors"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	jsoniter "github.com/json-iterator/go"
	"github.com/klauspost/compress/zstd"

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

func ParseFrame(buf []byte) (map[string]interface{}, error) {
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

	var out map[string]interface{}
	if err := json.Unmarshal(buf, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *MainCounter) randomlySubscribe(doReconnects bool) {
	for {
		ws, _, err := websocket.DefaultDialer.Dial(getUrl(), nil)
		done := make(chan struct{})

		if doReconnects {
			sleepTimeJitter := time.Duration(rand.Intn(3000)) * time.Millisecond
			sleepTime := (time.Second * 1) + sleepTimeJitter

			go func() {
				time.Sleep(sleepTime)
				ws.Close()
				done <- struct{}{}
			}()
		}

		if err != nil {
			goto restart
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
				if parsed["type"] == "initialState" {
					c.numberOfSnapshots.Add(1)
					// position := parsed["position"].(map[string]any)
					// x := int(position["x"].(float64))
					// y := int(position["y"].(float64))
					// log.Printf("Initial position: %d, %d", x, y)
				}
				if parsed["type"] == "moveUpdates" {
					c.numberOfMoveUpdates.Add(1)
					numberOfMoves := len(parsed["moves"].([]any))
					c.numberOfMoves.Add(int64(numberOfMoves))
					numberOfCaptures := len(parsed["captures"].([]any))
					c.numberOfCaptures.Add(int64(numberOfCaptures))
				}
				if parsed["type"] == "snapshot" {
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
		parsedType := parsed["type"].(string)
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
		if parsed["type"] == "initialState" {
			// log.Printf("Initial state")
			playingWhite := parsed["playingWhite"].(bool)
			// log.Printf("Playing white: %v", playingWhite)
			rm.playingWhite = playingWhite
			close(ready)
		} else if parsed["type"] == "stateSnapshot" {
			log.Printf("State snapshot")
		}
	}()
	<-ready
	return rm
}

func (rm *RandomMover) subscribe() {
	message, err := json.Marshal(map[string]any{
		"type":    "subscribe",
		"centerX": 4 + rm.boardX*8,
		"centerY": 4 + rm.boardY*8,
	})
	if err != nil {
		log.Printf("Error marshalling subscribe: %v", err)
		return
	}
	err = rm.ws.WriteMessage(websocket.TextMessage, message)
	if err != nil {
		log.Printf("Error subscribing: %v", err)
	}
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
	message, err := json.Marshal(map[string]any{
		"type":      "move",
		"pieceId":   pawnID,
		"fromX":     pawnX,
		"fromY":     pawnY,
		"toX":       pawnX,
		"toY":       targetY,
		"moveType":  0,
		"moveToken": rm.pawnCount + 1,
	})
	if err != nil {
		log.Printf("Error marshalling move: %v", err)
		return
	}
	err = rm.ws.WriteMessage(websocket.TextMessage, message)
	if err != nil {
		log.Printf("Error moving pawn: %v", err)
	}
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
		time.Sleep(4 * time.Millisecond)
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

const DO_SUBSCRIBE = false
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
