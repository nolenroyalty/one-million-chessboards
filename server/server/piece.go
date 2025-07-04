package server

import (
	"one-million-chessboards/protocol"
	"sync"
)

var pieceDataForSnapshotPool = sync.Pool{
	New: func() any {
		return &protocol.PieceDataForSnapshot{}
	},
}

func ReturnPieceDataFromSnapshotToPool(snapshot *protocol.ServerStateSnapshot) {
	if snapshot == nil {
		return
	}

	for _, piece := range snapshot.Pieces {
		if piece != nil {
			pieceDataForSnapshotPool.Put(piece)
		}
	}
}

const (
	Pawn         = protocol.PieceType_PIECE_TYPE_PAWN
	Knight       = protocol.PieceType_PIECE_TYPE_KNIGHT
	Bishop       = protocol.PieceType_PIECE_TYPE_BISHOP
	Rook         = protocol.PieceType_PIECE_TYPE_ROOK
	Queen        = protocol.PieceType_PIECE_TYPE_QUEEN
	King         = protocol.PieceType_PIECE_TYPE_KING
	PromotedPawn = protocol.PieceType_PIECE_TYPE_PROMOTED_PAWN
)

const (
	MaxMoveCount    = 4000 // 2**12 = 4096
	MaxCaptureCount = 4000 // 2**12 = 4096
)

type Piece struct {
	ID                               uint32
	Type                             protocol.PieceType
	IsWhite                          bool
	JustDoubleMoved                  bool
	KingKiller                       bool
	KingPawner                       bool
	QueenKiller                      bool
	QueenPawner                      bool
	AdoptedKiller                    bool
	HasCapturedPieceTypeOtherThanOwn bool
	Adopted                          bool
	MoveCount                        uint16
	CaptureCount                     uint16
}

type EncodedPiece uint64

const EmptyEncodedPiece = EncodedPiece(0)

const (
	PieceIdShift                          = 0  // 2**25 = 33,554,432 > 32,000,001
	PieceTypeShift                        = 25 // 4 bits (7 piece types)
	IsWhiteShift                          = 29 // only 1 bit ever
	JustDoubleMovedShift                  = 30 // 1 bit (only needed for pawns)
	KingKillerShift                       = 31 // 1 bit
	KingPawnerShift                       = 32 // 1 bit
	QueenKillerShift                      = 33 // 1 bit
	QueenPawnerShift                      = 34 // 1 bit
	AdoptedKillerShift                    = 35 // 1 bit
	HasCapturedPieceTypeOtherThanOwnShift = 36 // 1 bit
	AdoptedShift                          = 39 // 1 bit
	MoveCountShift                        = 40 // 12 bits
	CaptureCountShift                     = 52 // 12 bits

	idMask                               = 0x1FFFFFF
	typeMask                             = 0xF << PieceTypeShift
	isWhiteMask                          = 1 << IsWhiteShift
	justDoubleMovedMask                  = 1 << JustDoubleMovedShift
	kingKillerMask                       = 1 << KingKillerShift
	kingPawnerMask                       = 1 << KingPawnerShift
	queenKillerMask                      = 1 << QueenKillerShift
	queenPawnerMask                      = 1 << QueenPawnerShift
	adoptedKillerMask                    = 1 << AdoptedKillerShift
	hasCapturedPieceTypeOtherThanOwnMask = 1 << HasCapturedPieceTypeOtherThanOwnShift
	adoptedMask                          = 1 << AdoptedShift
	moveCountMask                        = 0xFFF << MoveCountShift
	captureCountMask                     = 0xFFF << CaptureCountShift
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
			ID:                               0,
			Type:                             Pawn,
			IsWhite:                          false,
			JustDoubleMoved:                  false,
			KingKiller:                       false,
			KingPawner:                       false,
			QueenKiller:                      false,
			QueenPawner:                      false,
			AdoptedKiller:                    false,
			HasCapturedPieceTypeOtherThanOwn: false,
			Adopted:                          false,
			MoveCount:                        0,
			CaptureCount:                     0,
		}
	}
	var p Piece
	p.ID = uint32((raw & idMask) >> PieceIdShift)
	p.Type = protocol.PieceType((raw & typeMask) >> PieceTypeShift)
	p.IsWhite = ((raw & isWhiteMask) >> IsWhiteShift) != 0
	p.JustDoubleMoved = ((raw & justDoubleMovedMask) >> JustDoubleMovedShift) != 0
	p.KingKiller = ((raw & kingKillerMask) >> KingKillerShift) != 0
	p.KingPawner = ((raw & kingPawnerMask) >> KingPawnerShift) != 0
	p.QueenKiller = ((raw & queenKillerMask) >> QueenKillerShift) != 0
	p.QueenPawner = ((raw & queenPawnerMask) >> QueenPawnerShift) != 0
	p.AdoptedKiller = ((raw & adoptedKillerMask) >> AdoptedKillerShift) != 0
	p.Adopted = ((raw & adoptedMask) >> AdoptedShift) != 0
	p.HasCapturedPieceTypeOtherThanOwn = ((raw & hasCapturedPieceTypeOtherThanOwnMask) >> HasCapturedPieceTypeOtherThanOwnShift) != 0
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
	raw := uint64(p.ID) << PieceIdShift
	raw |= uint64(p.Type) << PieceTypeShift
	if p.IsWhite {
		raw |= 1 << IsWhiteShift
	}
	if p.JustDoubleMoved {
		raw |= 1 << JustDoubleMovedShift
	}
	if p.KingKiller {
		raw |= 1 << KingKillerShift
	}
	if p.KingPawner {
		raw |= 1 << KingPawnerShift
	}
	if p.QueenKiller {
		raw |= 1 << QueenKillerShift
	}
	if p.QueenPawner {
		raw |= 1 << QueenPawnerShift
	}
	if p.HasCapturedPieceTypeOtherThanOwn {
		raw |= 1 << HasCapturedPieceTypeOtherThanOwnShift
	}
	if p.AdoptedKiller {
		raw |= 1 << AdoptedKillerShift
	}
	if p.Adopted {
		raw |= 1 << AdoptedShift
	}
	raw |= uint64(p.MoveCount) << MoveCountShift
	raw |= uint64(p.CaptureCount) << CaptureCountShift
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

func NewPiece(id uint32, pieceType protocol.PieceType, isWhite bool) Piece {
	return Piece{
		ID:                               id,
		Type:                             pieceType,
		IsWhite:                          isWhite,
		JustDoubleMoved:                  false,
		KingKiller:                       false,
		KingPawner:                       false,
		QueenKiller:                      false,
		QueenPawner:                      false,
		AdoptedKiller:                    false,
		Adopted:                          false,
		HasCapturedPieceTypeOtherThanOwn: false,
		MoveCount:                        0,
		CaptureCount:                     0,
	}
}

func (p *Piece) FillProtocolData(shared *protocol.PieceDataShared) {
	shared.Id = p.ID
	shared.Type = p.Type
	shared.IsWhite = p.IsWhite
	shared.JustDoubleMoved = p.JustDoubleMoved
	shared.KingKiller = p.KingKiller
	shared.KingPawner = p.KingPawner
	shared.QueenKiller = p.QueenKiller
	shared.QueenPawner = p.QueenPawner
	shared.AdoptedKiller = p.AdoptedKiller
	shared.Adopted = p.Adopted
	shared.MoveCount = uint32(p.MoveCount)
	shared.CaptureCount = uint32(p.CaptureCount)
	shared.HasCapturedPieceTypeOtherThanOwn = p.HasCapturedPieceTypeOtherThanOwn
}

// It's really hard to manage the lifecycle of piecedatas that we send to many clients,
// so we just allocate and let the GC handle it. Hopefully that's ok.
func (p *Piece) ToProtocolAlloc() *protocol.PieceDataShared {
	shared := &protocol.PieceDataShared{}
	p.FillProtocolData(shared)
	return shared
}

// A snapshot has an obvious lifecycle and is tied to a single client, and a single
// snapshot involves many allocations, so using a pool here is prety nice.
func (p *Piece) ToProtocolForSnapshot(dx, dy int32) *protocol.PieceDataForSnapshot {
	snapshot := pieceDataForSnapshotPool.Get().(*protocol.PieceDataForSnapshot)
	if snapshot.Piece == nil {
		snapshot.Piece = &protocol.PieceDataShared{}
	}
	p.FillProtocolData(snapshot.Piece)
	snapshot.Dx = dx
	snapshot.Dy = dy
	return snapshot
}
