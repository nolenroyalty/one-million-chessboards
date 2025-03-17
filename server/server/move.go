package server

// Move represents a chess piece move
type Move struct {
	PieceID uint64
	FromX   uint16
	FromY   uint16
	ToX     uint16
	ToY     uint16
}

// MoveRequest combines a move with the client that requested it
type MoveRequest struct {
	Move   Move
	Client *Client
}

// ValidatedMove represents a move that has been validated
type ValidatedMove struct {
	Move   Move
	Client *Client
}

func BoundsCheck(move Move) bool {
	if move.FromX >= BOARD_SIZE || move.FromY >= BOARD_SIZE ||
		move.ToX >= BOARD_SIZE || move.ToY >= BOARD_SIZE {
		return false
	}
	return true
}

// IsValidMove checks if a move is valid
// For now, we just do basic bounds checking
func SatisfiesBasicMoveRules(board *Board, move Move) bool {
	// For now, all moves are allowed
	return true
}

// PieceMove represents a move update to send to clients
type PieceMove struct {
	PieceID   uint64 `json:"pieceId"`
	FromX     uint16 `json:"fromX"`
	FromY     uint16 `json:"fromY"`
	ToX       uint16 `json:"toX"`
	ToY       uint16 `json:"toY"`
	PieceType PieceType `json:"pieceType"`
	IsWhite   bool      `json:"isWhite"`
	MoveState MoveState `json:"moveState"`
	SeqNum    uint64    `json:"seqNum"`
}

// PieceCapture represents a capture update to send to clients
type PieceCapture struct {
	CapturedPieceID  uint64 `json:"capturedPieceId"`
	X                uint16 `json:"x"`
	Y                uint16 `json:"y"`
	CapturedType     PieceType `json:"capturedType"`
	WasWhite         bool      `json:"wasWhite"`
	CapturingPieceID uint64    `json:"capturingPieceId"`
	SeqNum           uint64    `json:"seqNum"`
}

// MoveUpdates contains batched move updates to send to clients
type MoveUpdates struct {
	Moves    []PieceMove
	Captures []PieceCapture
}
