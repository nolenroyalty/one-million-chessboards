package server

// PieceType represents the type of chess piece
type PieceType int

const (
	Pawn PieceType = iota
	Knight
	Bishop
	Rook
	Queen
	King
)

// MoveState tracks special move conditions
type MoveState int

const (
	Unmoved MoveState = iota
	Moved
	DoubleMoved // For pawns that just made a two-square move (for en passant)
)

// Piece represents a chess piece
type Piece struct {
	ID        uint32
	Type      PieceType
	IsWhite   bool
	MoveState MoveState
}

// NewPiece creates a new piece with default values
func NewPiece(id uint32, pieceType PieceType, isWhite bool) *Piece {
	return &Piece{
		ID:        id,
		Type:      pieceType,
		IsWhite:   isWhite,
		MoveState: Unmoved,
	}
}
