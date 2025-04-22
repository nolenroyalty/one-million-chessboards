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

const (
	MaxMoveCount    = 4000 // 2**12 = 4096
	MaxCaptureCount = 4000 // 2**12 = 4096
)

type Piece struct {
	ID              uint32
	Type            PieceType
	IsWhite         bool
	JustDoubleMoved bool
	KingKiller      bool
	KingPawner      bool
	MoveCount       uint16
	CaptureCount    uint16
}

type EncodedPiece uint64

const EmptyEncodedPiece = EncodedPiece(0)

// CR nroyalty: when serializing this for protobuffs, we may just want to
// encode each piece as two uint32s, one for piece id and one for metadata. It seems
// like maybe protobuffs use a surprising amount of space for bools.
//
// If we encode starting location in PieceId we can get rid of double move here
// by just checking movecount and starting location. It's not super clear to me
// that this is worth it (maybe we want to encode the starting location for other
// reasons, but the complexity of double-moved detection gets higher for minor
// savings, since JustDoubleMoved is default false so we don't have to encode it often)
const (
	PieceIdShift         = 0  // 2**25 = 33,554,432 > 32,000,001
	PieceTypeShift       = 25 // give it 4 bits (7 piece types)
	IsWhiteShift         = 29 // only 1 bit ever
	JustDoubleMovedShift = 30 // 1 bit (only needed for pawns)
	KingKillerShift      = 31 // 1 bit
	KingPawnerShift      = 32 // 1 bit
	MoveCountShift       = 40 // 12 bits
	CaptureCountShift    = 52 // 12 bits

	idMask              = 0x1FFFFFF
	typeMask            = 0xF << PieceTypeShift
	isWhiteMask         = 1 << IsWhiteShift
	justDoubleMovedMask = 1 << JustDoubleMovedShift
	kingKillerMask      = 1 << KingKillerShift
	kingPawnerMask      = 1 << KingPawnerShift
	moveCountMask       = 0xFFF << MoveCountShift
	captureCountMask    = 0xFFF << CaptureCountShift
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
			KingKiller:      false,
			KingPawner:      false,
			MoveCount:       0,
			CaptureCount:    0,
		}
	}
	var p Piece
	p.ID = uint32((raw & idMask) >> PieceIdShift)
	p.Type = PieceType((raw & typeMask) >> PieceTypeShift)
	p.IsWhite = ((raw & isWhiteMask) >> IsWhiteShift) != 0
	p.JustDoubleMoved = ((raw & justDoubleMovedMask) >> JustDoubleMovedShift) != 0
	p.KingKiller = ((raw & kingKillerMask) >> KingKillerShift) != 0
	p.KingPawner = ((raw & kingPawnerMask) >> KingPawnerShift) != 0
	p.MoveCount = uint16((raw & moveCountMask) >> MoveCountShift)
	p.CaptureCount = uint16((raw & captureCountMask) >> CaptureCountShift)
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
	kingKillerInt := 0
	if p.KingKiller {
		kingKillerInt = 1
	}
	kingPawnerInt := 0
	if p.KingPawner {
		kingPawnerInt = 1
	}
	raw := uint64(p.ID)<<PieceIdShift |
		uint64(p.Type)<<PieceTypeShift |
		uint64(whiteInt)<<IsWhiteShift |
		uint64(justDoubleMovedInt)<<JustDoubleMovedShift |
		uint64(kingKillerInt)<<KingKillerShift |
		uint64(kingPawnerInt)<<KingPawnerShift |
		uint64(p.MoveCount)<<MoveCountShift |
		uint64(p.CaptureCount)<<CaptureCountShift
	return EncodedPiece(raw)
}

func (p *Piece) IncrementMoveCount() {
	if p.MoveCount < MaxMoveCount {
		p.MoveCount++
	}
}

func (p *Piece) IncrementCaptureCount() {
	if p.CaptureCount < MaxCaptureCount {
		p.CaptureCount++
	}
}

func NewPiece(id uint32, pieceType PieceType, isWhite bool) Piece {
	return Piece{
		ID:              id,
		Type:            pieceType,
		IsWhite:         isWhite,
		JustDoubleMoved: false,
		KingKiller:      false,
		KingPawner:      false,
		MoveCount:       0,
		CaptureCount:    0,
	}
}
