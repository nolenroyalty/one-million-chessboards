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

type EncodedPiece uint64

const EmptyEncodedPiece = EncodedPiece(0)

const (
	PieceIdShift   = 0  // always 32 bits
	PieceTypeShift = 32 // give it 4 bits (6 piece types)
	IsWhiteShift   = 36 // only 1 bit ever
	MoveStateShift = 37 // let's leave 4 bits here (room for more, only 3 right now)
	// plenty of room for extra metadata...

	idMask        = uint64(^uint32(0))
	typeMask      = 0xF << PieceTypeShift
	isWhiteMask   = 1 << IsWhiteShift
	moveStateMask = 0xF << MoveStateShift
)

func NewEncodedPiece(id uint32, pieceType PieceType, isWhite bool, moveState MoveState) EncodedPiece {
	whiteInt := 0
	if isWhite {
		whiteInt = 1
	}
	return EncodedPiece(uint64(id)<<PieceIdShift |
		uint64(pieceType)<<PieceTypeShift |
		uint64(whiteInt)<<IsWhiteShift |
		uint64(moveState)<<MoveStateShift)
}

func EncodedIsEmpty(encodedPiece EncodedPiece) bool {
	return encodedPiece == EmptyEncodedPiece
}

func PieceOfEncodedPiece(encodedPiece EncodedPiece) Piece {
	raw := uint64(encodedPiece)
	id := raw & idMask
	empty := id == 0

	if empty {
		return Piece{
			ID:        0,
			Type:      Pawn,
			IsWhite:   false,
			MoveState: Unmoved,
		}
	}
	var p Piece
	p.ID = uint32((raw & idMask) >> PieceIdShift)
	p.Type = PieceType((raw & typeMask) >> PieceTypeShift)
	p.IsWhite = ((raw & isWhiteMask) >> IsWhiteShift) != 0
	p.MoveState = MoveState((raw & moveStateMask) >> MoveStateShift)
	return p
}

func (p *Piece) IsEmpty() bool {
	return p.ID == 0
}

func (p *Piece) Encode() EncodedPiece {
	if p.IsEmpty() {
		return EmptyEncodedPiece
	}
	whiteInt := 0
	if p.IsWhite {
		whiteInt = 1
	}
	raw := uint64(p.ID)<<PieceIdShift |
		uint64(p.Type)<<PieceTypeShift |
		uint64(whiteInt)<<IsWhiteShift |
		uint64(p.MoveState)<<MoveStateShift
	return EncodedPiece(raw)
}

// NewPiece creates a new piece with default values
func NewPiece(id uint32, pieceType PieceType, isWhite bool) Piece {
	return Piece{
		ID:        id,
		Type:      pieceType,
		IsWhite:   isWhite,
		MoveState: Unmoved,
	}
}
