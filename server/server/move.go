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

// IsValidMove checks if a move is valid
// For now, we just do basic bounds checking
func IsValidMove(board *Board, move Move) bool {
	// Check bounds
	if move.FromX >= BOARD_SIZE || move.FromY >= BOARD_SIZE ||
		move.ToX >= BOARD_SIZE || move.ToY >= BOARD_SIZE {
		return false
	}

	if (move.FromX < 0 || move.FromY < 0 || move.ToX < 0 || move.ToY < 0) {
		return false
	}
	
	// Check if there's a piece at the from position
	piece := board.GetPiece(move.FromX, move.FromY)
	if piece == nil {
		return false
	}
	
	// Check if piece ID matches
	if piece.ID != move.PieceID {
		return false
	}
	
	// For now, all moves are allowed
	return true
}

// PieceMove represents a move update to send to clients
type PieceMove struct {
	PieceID   uint64
	FromX     uint16
	FromY     uint16
	ToX       uint16
	ToY       uint16
	PieceType PieceType
	IsWhite   bool
	MoveState MoveState
}

// PieceCapture represents a capture update to send to clients
type PieceCapture struct {
	CapturedPieceID  uint64
	X                uint16
	Y                uint16
	CapturedType     PieceType
	WasWhite         bool
	CapturingPieceID uint64
}

// MoveUpdates contains batched move updates to send to clients
type MoveUpdates struct {
	Moves    []PieceMove
	Captures []PieceCapture
	Timestamp uint64
}
