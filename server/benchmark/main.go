package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"sync/atomic"
	"time"

	"github.com/dustin/go-humanize"
	"github.com/gorilla/websocket"
)

const (
	localURL = "ws://localhost:8080/ws"
	prodURL  = "wss://onemillionchessboards.com/ws"
	useProd  = true
)

func getUrl() string {
	if useProd {
		return prodURL
	}
	return localURL
}

type MainCounter struct {
	numberOfSnapshots atomic.Int64
	numberOfMoves     atomic.Int64
	numberOfCaptures  atomic.Int64
	receivedBytes     atomic.Int64
}

func (c *MainCounter) logStats() {
	log.Printf("BYTES: %s", humanize.Bytes(uint64(c.receivedBytes.Load())))
	log.Printf("SNAPSHOTS: %d", c.numberOfSnapshots.Load())
	log.Printf("MOVES: %d", c.numberOfMoves.Load())
	log.Printf("CAPTURES: %d", c.numberOfCaptures.Load())
}

func (c *MainCounter) RunClient() {
	for {
		sleepTime := 10 + rand.Intn(20)
		time.Sleep(time.Duration(sleepTime) * time.Millisecond)
		ws, _, err := websocket.DefaultDialer.Dial(getUrl(), nil)
		if err != nil {
			log.Fatal(err)
		}
		// log.Printf("Connected to server")

		timer := time.NewTimer(time.Duration(sleepTime) * time.Second)

		done := make(chan struct{})

		go func() {
			<-timer.C
			close(done)
			ws.Close()
			// log.Printf("Disconnected from server")
		}()

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
				var parsed map[string]any
				err = json.Unmarshal(message, &parsed)
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

func main() {
	counter := MainCounter{}
	for i := 0; i < 1000; i++ {
		go counter.RunClient()
		time.Sleep(10 * time.Millisecond)
	}
	// go counter.ConnectAndLogSizes()
	ticker := time.NewTicker(5 * time.Second)
	counter.logStats()
	for range ticker.C {
		counter.logStats()
	}
}
