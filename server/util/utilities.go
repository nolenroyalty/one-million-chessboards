package main

import (
	"flag"
	"fmt"
	"os"

	"one-million-chessboards/server"
)

var (
	requestsFile = flag.String("read-requests", "", "Requests to read")
)

func main() {
	flag.Parse()
	switch {
	case *requestsFile != "":
		err := server.ReadAndPrintRequestsFromFile(*requestsFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Println("%s", flag.ErrHelp)
		os.Exit(1)
	}
}
