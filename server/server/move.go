package server

import (
	"math"
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
	dx := int32(move.ToX) - int32(move.FromX)
	dy := int32(move.ToY) - int32(move.FromY)
	return math.Abs(float64(dx)) > MAX_MOVE_DISTANCE || math.Abs(float64(dy)) > MAX_MOVE_DISTANCE
}

type PieceMove struct {
	Piece  PieceDataForMove `json:"piece"`
	Seqnum uint64           `json:"seqnum"`
}

// PieceCapture represents a capture update to send to clients
// CR nroyalty: WAIT! We don't ever need to include seqnum in a piece capture!
// We can always process piece captures because a piece can never be un-captured so they can't
// be stale! So we never need to include this!!!
type PieceCapture struct {
	CapturedPieceID uint32 `json:"capturedPieceId"`
	Seqnum          uint64 `json:"seqnum"`
}
