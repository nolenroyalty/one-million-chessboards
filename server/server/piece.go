package server

type PieceType int

const (
	Pawn PieceType = iota
	Knight
	Bishop
	Rook
	Queen
	King
	PromotedPawn
)

type Piece struct {
	ID              uint32
	Type            PieceType
	IsWhite         bool
	JustDoubleMoved bool
	MoveCount       uint8
	CaptureCount    uint8
}

type EncodedPiece uint64

const EmptyEncodedPiece = EncodedPiece(0)

// If we encode starting location in PieceId we can get rid of double move here
// by just checking movecount and starting location. It's not super clear to me
// that this is worth it (maybe we want to encode the starting location for other
// reasons, but the complexity of double-moved detection gets higher for minor
// savings, since JustDoubleMoved is default false so we don't have to encode it often)
const (
	PieceIdShift         = 0  // always 32 bits
	PieceTypeShift       = 32 // give it 4 bits (7 piece types)
	IsWhiteShift         = 36 // only 1 bit ever
	JustDoubleMovedShift = 37 // 1 bit (only needed for pawns)
	MoveCountShift       = 38 // 8 bits
	CaptureCountShift    = 46 // 8 bits

	idMask              = uint64(^uint32(0))
	typeMask            = 0xF << PieceTypeShift
	isWhiteMask         = 1 << IsWhiteShift
	justDoubleMovedMask = 1 << JustDoubleMovedShift
	moveCountMask       = 0xFF << MoveCountShift
	captureCountMask    = 0xFF << CaptureCountShift
)

func EncodedIsEmpty(encodedPiece EncodedPiece) bool {
	return encodedPiece == EmptyEncodedPiece
}

func PieceOfEncodedPiece(encodedPiece EncodedPiece) Piece {
	raw := uint64(encodedPiece)
	id := raw & idMask
	empty := id == 0

	if empty {
		return Piece{
			ID:              0,
			Type:            Pawn,
			IsWhite:         false,
			JustDoubleMoved: false,
			MoveCount:       0,
			CaptureCount:    0,
		}
	}
	var p Piece
	p.ID = uint32((raw & idMask) >> PieceIdShift)
	p.Type = PieceType((raw & typeMask) >> PieceTypeShift)
	p.IsWhite = ((raw & isWhiteMask) >> IsWhiteShift) != 0
	p.JustDoubleMoved = ((raw & justDoubleMovedMask) >> JustDoubleMovedShift) != 0
	p.MoveCount = uint8((raw & moveCountMask) >> MoveCountShift)
	p.CaptureCount = uint8((raw & captureCountMask) >> CaptureCountShift)
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
	justDoubleMovedInt := 0
	if p.JustDoubleMoved {
		justDoubleMovedInt = 1
	}
	raw := uint64(p.ID)<<PieceIdShift |
		uint64(p.Type)<<PieceTypeShift |
		uint64(whiteInt)<<IsWhiteShift |
		uint64(justDoubleMovedInt)<<JustDoubleMovedShift |
		uint64(p.MoveCount)<<MoveCountShift |
		uint64(p.CaptureCount)<<CaptureCountShift
	return EncodedPiece(raw)
}

func (p *Piece) IncrementMoveCount() {
	if p.MoveCount < 250 {
		p.MoveCount++
	}
}

func (p *Piece) IncrementCaptureCount() {
	if p.CaptureCount < 250 {
		p.CaptureCount++
	}
}

func NewPiece(id uint32, pieceType PieceType, isWhite bool) Piece {
	return Piece{
		ID:              id,
		Type:            pieceType,
		IsWhite:         isWhite,
		JustDoubleMoved: false,
		MoveCount:       0,
		CaptureCount:    0,
	}
}
