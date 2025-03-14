package main

import (
	"flag"
	"log"
	"net/http"
	"one-million-chessboards/server"
)

var (
	addr       = flag.String("addr", ":8080", "HTTP service address")
	staticDir  = flag.String("static", "./static", "Directory for static files")
)

func main() {
	flag.Parse()


	
	// Create the server
	s := server.NewServer()
	s.InitializeBoards(100)
	
	// Start the server in a goroutine
	go s.Run()
	
	// Set up HTTP routes
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		s.ServeWs(w, r)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		s.ServeHTTP(w, r, *staticDir)
	})
	
	// Start the HTTP server
	log.Printf("Starting server on %s", *addr)
	log.Printf("Access web client at http://localhost%s", *addr)
	
	err := http.ListenAndServe(*addr, nil)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
