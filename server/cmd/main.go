package main

import (
	"flag"
	"log"
	"net/http"
	"one-million-chessboards/server"
	"unsafe"
)

var (
	addr      = flag.String("addr", ":8080", "HTTP service address")
	staticDir = flag.String("static", "./static", "Directory for static files")
	stateDir  = flag.String("state", "state", "Directory for state files")
)

func main() {
	flag.Parse()

	s := server.NewServer(*stateDir)
	piece := s.Testing_GetPiece(500, 496)
	log.Printf("Piece at (500, 496): %v", piece)
	log.Printf("Size of piece: %d", unsafe.Sizeof(piece))

	// CR nroyalty: maybe we can block until the server is ready here.
	go s.Run()

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
