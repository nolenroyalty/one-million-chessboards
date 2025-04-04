package server

import (
	"log"
	"os"
	"time"
)

// CR nroyalty: be careful with sequence numbers...
const (
	snapshotInterval = time.Second * 60
)

type PersistentBoard struct {
	board *Board
	movesToApply chan Move
}


func NewPersistentBoard(filename string) *PersistentBoard {
	board := NewBoard()
	// check if file exists
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		log.Printf("File %s does not exist, creating new board", filename)
		board.InitializeRandom()
		board.SaveToFile(filename)
	} else {
		board.LoadFromFile(filename)
	}
	return &PersistentBoard{board: board, movesToApply: make(chan Move, 1024)}
}

func (pb *PersistentBoard) GetBoardCopy() *Board {
	board := NewBoard()
	board.nextID = pb.board.nextID
	board.seqNum.Store(pb.board.seqNum.Load())
	board.totalMoves.Store(pb.board.totalMoves.Load())
	board.whitePiecesCaptured.Store(pb.board.whitePiecesCaptured.Load())
	board.blackPiecesCaptured.Store(pb.board.blackPiecesCaptured.Load())
	board.whiteKingsCaptured.Store(pb.board.whiteKingsCaptured.Load())
	board.blackKingsCaptured.Store(pb.board.blackKingsCaptured.Load())
	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			board.pieces[y][x].Store(pb.board.pieces[y][x].Load())
		}
	}
	return board
}

func (pb *PersistentBoard) ApplyMove(move Move) {
	pb.movesToApply <- move
}

func (pb *PersistentBoard) Run() {
	snapshotTicker := time.NewTicker(snapshotInterval)
	for {
		select {
		case move := <-pb.movesToApply:
			res := pb.board.ValidateAndApplyMove(move)
			if !res.Valid {
				log.Printf("TRIED TO APPLY INVALID MOVE: %v", move)
				continue
			} 
		case <-snapshotTicker.C:
			pb.board.SaveToFile("state/TEST.bin")
		}
	}
}