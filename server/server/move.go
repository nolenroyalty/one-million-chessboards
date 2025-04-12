package server

import "math"

const MAX_MOVE_DISTANCE = 36

type MoveType int

const (
	MoveTypeNormal MoveType = iota
	MoveTypeCastle
	MoveTypeEnPassant
)

// Move represents a chess piece move
type Move struct {
	PieceID   uint32
	FromX     uint16
	FromY     uint16
	ToX       uint16
	ToY       uint16
	MoveType  MoveType
	MoveToken uint32
}

// MoveRequest combines a move with the client that requested it
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

// CR nroyalty: can we remove piece type, iswhite, etc from these? it'd be nice.
// I think we can remove piece type and such, but we need to keep around x and y in
// captured piece because it's handy for figuring out invalidation

// PieceMove represents a move update to send to clients
// CR nroyalty: let's avoid including a seqNum for each move, and instead let's just provide a seqnum
// for the starting move in a batch (when serializing); clients can increment the seqnum as needed
// This assumes that we order our moves correctly on the server but I think that is a safe assumption
// and it lets us save a bunch of bytes on serialization.
type PieceMove struct {
	PieceID      uint32    `json:"pieceId"`
	FromX        uint16    `json:"fromX"`
	FromY        uint16    `json:"fromY"`
	ToX          uint16    `json:"toX"`
	ToY          uint16    `json:"toY"`
	PieceType    PieceType `json:"pieceType"`
	IsWhite      bool      `json:"isWhite"`
	MoveCount    uint8     `json:"moveCount"`
	CaptureCount uint8     `json:"captureCount"`
	SeqNum       uint64    `json:"seqNum"`
}

// PieceCapture represents a capture update to send to clients
// CR nroyalty: WAIT! We don't ever need to include seqnum in a piece capture!
// We can always process piece captures because a piece can never be un-captured so they can't
// be stale! So we never need to include this!!!
type PieceCapture struct {
	CapturedPieceID uint32 `json:"capturedPieceId"`
	X               uint16 `json:"x"`
	Y               uint16 `json:"y"`
	SeqNum          uint64 `json:"seqNum"`
}

// MoveUpdates contains batched move updates to send to clients
type MoveUpdates struct {
	Moves    []PieceMove
	Captures []PieceCapture
}
