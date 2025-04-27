package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"one-million-chessboards/server"
	"os"
	"os/signal"
	"syscall"
	"time"
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
	// ctx, cancel := context.WithCancel(context.Background())
	// defer cancel()
	// var wg sync.WaitGroup
	s := server.NewServer(*stateDir)

	s.Run()

	mux := http.NewServeMux()

	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		s.ServeWs(w, r)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		s.ServeHTTP(w, r, *staticDir)
	})

	httpServer := &http.Server{
		Addr:    *addr,
		Handler: mux,
	}

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	done := make(chan bool, 1)

	go func() {
		sig := <-sigs
		log.Printf("Received signal: %s. Initiating graceful shutdown...", sig)

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		s.GracefulShutdown()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			log.Printf("Failed to shutdown HTTP server: %v", err)
		}
		log.Printf("Graceful shutdown complete")
		done <- true
	}()

	log.Printf("Starting server on %s", *addr)
	log.Printf("Access web client at http://localhost%s", *addr)

	go func() {
		err := httpServer.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Server stopped: %v", err)
		}
	}()

	log.Printf("Waiting for shutdown signal")
	<-done
}
