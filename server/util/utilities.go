package main

import (
	"flag"
	"fmt"
	"os"

	"one-million-chessboards/server"
)

var (
	requestsFile      = flag.String("read-requests", "", "Requests to read")
	boardFileForStats = flag.String("board-file-for-stats", "", "Board file for most moves and captures")
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
	case *boardFileForStats != "":
		err := server.PrintLivePieceStats(*boardFileForStats)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error finding pieces with most moves and captures: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Println("%s", flag.ErrHelp)
		os.Exit(1)
	}
}
