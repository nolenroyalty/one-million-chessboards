package main

import (
	"flag"
	"log"
	"net/http"
	"one-million-chessboards/server"
)

var (
	addr      = flag.String("addr", ":8080", "HTTP service address")
	staticDir = flag.String("static", "./static", "Directory for static files")
	stateDir  = flag.String("state", "state", "Directory for state files")
	udpAddr   = flag.String("udp-addr", "127.0.0.1", "UDP address to send logs to")
)

func main() {
	flag.Parse()

	server.SetUDPAddress(*udpAddr)
	s := server.NewServer(*stateDir)
	s.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		s.ServeWs(w, r)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		s.ServeHTTP(w, r, *staticDir)
	})

	log.Printf("Starting server on %s", *addr)
	log.Printf("Access web client at http://localhost%s", *addr)

	err := http.ListenAndServe(*addr, nil)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
