package main

import (
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

func main() {
	ws, _, err := websocket.DefaultDialer.Dial("ws://localhost:8080/ws", nil)
	if err != nil {
		log.Fatal(err)
	}
	defer ws.Close()
	for {
		_, message, err := ws.ReadMessage()
		if err != nil {
			log.Fatal(err)
			return
		}
		// parse message json
		var parsed map[string]interface{}
		err = json.Unmarshal(message, &parsed)
		if err != nil {
			log.Fatal(err)
			return
		}
		log.Printf("Parsed message: %v", parsed["type"])
		log.Printf("Received message size: %d bytes", len(message))
	}
}
