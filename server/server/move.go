package server

import (
	"fmt"
	"one-million-chessboards/protocol"
)

const MAX_MOVE_DISTANCE = 36

type Move struct {
	PieceID              uint32
	FromX                uint16
	FromY                uint16
	ToX                  uint16
	ToY                  uint16
	MoveType             protocol.MoveType
	MoveToken            uint32
	ClientIsPlayingWhite bool
}

func (m *Move) ToString() string {
	typeString := "MOVETYPE-UNKNOWN"
	switch {
	case m.MoveType == protocol.MoveType_MOVE_TYPE_CASTLE:
		typeString = "CASTLE"
	case m.MoveType == protocol.MoveType_MOVE_TYPE_EN_PASSANT:
		typeString = "ENPASSANT"
	case m.MoveType == protocol.MoveType_MOVE_TYPE_NORMAL:
		typeString = "NORMAL"
	}
	colorString := "BLACK"
	if m.ClientIsPlayingWhite {
		colorString = "WHITE"
	}
	idMod := (m.PieceID - 1) % 16
	kindString := "KIND-UNKNOWN"
	// gross
	if idMod <= 7 {
		kindString = "PAWN"
	} else if idMod == 8 || idMod == 15 {
		kindString = "ROOK"
	} else if idMod == 9 || idMod == 14 {
		kindString = "KNIGHT"
	} else if idMod == 10 || idMod == 13 {
		kindString = "BISHOP"
	} else if idMod == 11 {
		kindString = "QUEEN"
	} else if idMod == 12 {
		kindString = "KING"
	}

	return fmt.Sprintf("MO: %s %s [%s] (%d, %d) -> (%d %d)",
		colorString,
		kindString,
		typeString,
		m.FromX, m.FromY, m.ToX, m.ToY)
}

type MoveRequest struct {
	Move   Move
	Client *Client
}

func (move *Move) BoundsCheck() bool {
	if move.FromX >= BOARD_SIZE || move.FromY >= BOARD_SIZE ||
		move.ToX >= BOARD_SIZE || move.ToY >= BOARD_SIZE {
		return false
	}
	return true
}

func (move *Move) ExceedsMaxMoveDistance() bool {
	dx := AbsDiffUint16(move.ToX, move.FromX)
	dy := AbsDiffUint16(move.ToY, move.FromY)
	return dx > MAX_MOVE_DISTANCE || dy > MAX_MOVE_DISTANCE
}
