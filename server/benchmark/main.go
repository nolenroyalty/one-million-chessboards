package main

import (
	"encoding/json"
	"log"
	"sync/atomic"
	"time"

	"github.com/dustin/go-humanize"
	"github.com/gorilla/websocket"
)

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

func (c *MainCounter) randomlySubscribe(serverDone chan struct{}) {
	for {
		// sleepTime := 5 + rand.Intn(13)
		// time.Sleep(time.Duration(sleepTime) * time.Millisecond)
		ws, _, err := websocket.DefaultDialer.Dial(getUrl(), nil)
		// timer := time.NewTimer(time.Duration(sleepTime) * time.Second)
		done := make(chan struct{})

		if err != nil {
			// now := time.Now()
			// log.Printf("connection error: %v, %v", err, now)
			goto restart
		}

		// go func() {
		// 	<-timer.C
		// 	close(done)
		// }()

		for {
			select {
			case <-done:
				ws.Close()
				goto restart
			case <-serverDone:
				log.Printf("Server done")
				ws.Close()
				return
			default:
				_, message, err := ws.ReadMessage()
				if err != nil {
					log.Printf("Error reading message: %v", err)
					goto restart
				}
				c.receivedBytes.Add(int64(len(message)))
				var parsed map[string]any
				err = json.Unmarshal(message, &parsed)
				if err != nil {
					goto restart
				}
				if parsed["type"] == "initialState" {
					c.numberOfSnapshots.Add(1)
					position := parsed["position"].(map[string]any)
					x := int(position["x"].(float64))
					y := int(position["y"].(float64))
					log.Printf("Initial position: %d, %d", x, y)
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
		var parsed map[string]any
		err = json.Unmarshal(message, &parsed)
		if err != nil {
			log.Fatal(err)
		}
		parsedType := parsed["type"].(string)
		size := len(message)
		log.Printf("Type: %s, Size: %s", parsedType, humanize.Bytes(uint64(size)))
	}
}

const NUM_RANDOM_SUBSCRIPTIONS = 20
const NUM_RANDOM_MOVERS = 1000
const NUMBER_OF_MOVES = 1000
const TEST_RUN_TIME = 60 * time.Second

func (c *MainCounter) runRandomSubscribe() {
	doneChans := make([]chan struct{}, NUM_RANDOM_SUBSCRIPTIONS)
	for i := 0; i < NUM_RANDOM_SUBSCRIPTIONS; i++ {
		doneChans[i] = make(chan struct{})
		go c.randomlySubscribe(doneChans[i])
		time.Sleep(5 * time.Millisecond)
	}
	statsTicker := time.NewTicker(5 * time.Second)
	doneTicker := time.NewTicker(TEST_RUN_TIME)
	c.logStats()
	for {
		select {
		case <-doneTicker.C:
			log.Printf("Done ticker fired")
			for _, doneChan := range doneChans {
				close(doneChan)
			}
			statsTicker.Stop()
			doneTicker.Stop()
			log.Printf("Done")
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
		var parsed map[string]any
		err = json.Unmarshal(message, &parsed)
		if err != nil {
			log.Printf("Error unmarshalling: %v", err)
			return
		}
		if parsed["type"] == "initialState" {
			log.Printf("Initial state")
			playingWhite := parsed["playingWhite"].(bool)
			log.Printf("Playing white: %v", playingWhite)
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
	err := rm.ws.WriteJSON(map[string]any{
		"type":    "subscribe",
		"centerX": 4 + rm.boardX*8,
		"centerY": 4 + rm.boardY*8,
	})
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
	err := rm.ws.WriteJSON(map[string]any{
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
		log.Printf("Error moving pawn: %v", err)
	}
	rm.pawnCount++
	if (rm.pawnCount % 8) == 0 {
		rm.boardY++
	}
}

func (c *MainCounter) runRandomMover(boardX int, doneChan chan struct{}) {
	rm := newRandomMover(boardX)
	if rm == nil {
		doneChan <- struct{}{}
		return
	}
	rm.subscribe()
	for i := 0; i < NUMBER_OF_MOVES; i++ {
		rm.movePawn()
		time.Sleep(5 * time.Millisecond)
	}
	doneChan <- struct{}{}
}

func (c *MainCounter) runAllRandomMovers() {
	doneChan := make(chan struct{})
	for boardX := 0; boardX < NUM_RANDOM_MOVERS; boardX++ {
		time.Sleep(2 * time.Millisecond)
		go c.runRandomMover(boardX, doneChan)
	}
	doneCount := 0
	for {
		select {
		case <-doneChan:
			doneCount++
			if doneCount == NUM_RANDOM_MOVERS {
				return
			}
		}
	}
}

func main() {
	counter := MainCounter{}
	// counter.ConnectAndLogSizes()
	// go counter.runRandomSubscribe()
	// counter.runRandomMover(0)
	counter.runAllRandomMovers()
}
