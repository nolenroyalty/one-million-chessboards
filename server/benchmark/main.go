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

func (c *MainCounter) RunClient(serverDone chan struct{}) {
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

const NUM_CLIENTS = 250
const TEST_RUN_TIME = 60 * time.Second

func (c *MainCounter) runRandomSubscribe() {
	doneChans := make([]chan struct{}, NUM_CLIENTS)
	for i := 0; i < NUM_CLIENTS; i++ {
		doneChans[i] = make(chan struct{})
		go c.RunClient(doneChans[i])
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

func main() {
	counter := MainCounter{}
	// counter.ConnectAndLogSizes()
	counter.runRandomSubscribe()
}
