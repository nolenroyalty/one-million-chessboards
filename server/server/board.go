package server

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"one-million-chessboards/protocol"

	"github.com/rs/zerolog"
)

type Board struct {
	sync.RWMutex
	pieces                                    [BOARD_SIZE][BOARD_SIZE]uint64
	rawRowsPool                               sync.Pool
	nextID                                    uint32
	seqNum                                    uint64
	doLogging                                 bool
	totalMoves                                atomic.Uint64
	whitePiecesCaptured                       atomic.Uint32
	blackPiecesCaptured                       atomic.Uint32
	whiteKingsCaptured                        atomic.Uint32
	blackKingsCaptured                        atomic.Uint32
	mutexTimeLogger_USEHELPERS_YOUFUCK        zerolog.Logger
	snapshotDurationLogger_USEHELPERS_YOUFUCK zerolog.Logger
	generalLogger                             zerolog.Logger
}

type GameStats struct {
	TotalMoves           uint64
	WhitePiecesRemaining uint32
	BlackPiecesRemaining uint32
	WhiteKingsRemaining  uint32
	BlackKingsRemaining  uint32
	Seqnum               uint64
}

func NewBoard(doLogging bool) *Board {
	return &Board{
		nextID:              1,
		seqNum:              uint64(1),
		totalMoves:          atomic.Uint64{},
		whitePiecesCaptured: atomic.Uint32{},
		blackPiecesCaptured: atomic.Uint32{},
		whiteKingsCaptured:  atomic.Uint32{},
		blackKingsCaptured:  atomic.Uint32{},
		doLogging:           doLogging,
		rawRowsPool: sync.Pool{
			New: func() any {
				rows := make([][]uint64, VIEW_DIAMETER)
				for i := range rows {
					rows[i] = make([]uint64, VIEW_DIAMETER)
				}
				return &rows
			},
		},
		mutexTimeLogger_USEHELPERS_YOUFUCK:        NewCoreLogger().With().Str("kind", "board").Str("metric", "mutex_time").Logger(),
		snapshotDurationLogger_USEHELPERS_YOUFUCK: NewCoreLogger().With().Str("kind", "board").Str("metric", "snapshot_duration").Logger(),
		generalLogger: NewCoreLogger().With().Str("kind", "board").Logger(),
	}
}

func (b *Board) maybeLogSpecialMutexAction(took int64, kind string) {
	if b.doLogging {
		b.mutexTimeLogger_USEHELPERS_YOUFUCK.Info().
			Int64("took_ns", took).
			Bool(kind, true).
			Send()
	}
}

func (b *Board) maybeLogMutexDuration(took int64) {
	if b.doLogging {
		b.mutexTimeLogger_USEHELPERS_YOUFUCK.Info().
			Int64("took_ns", took).
			Send()
	}
}

func (b *Board) maybeLogSnapshotDuration(lockTook, totalTook int64) {
	if b.doLogging {
		b.snapshotDurationLogger_USEHELPERS_YOUFUCK.Info().
			Int64("snapshot_lock_ns", lockTook).
			Int64("snapshot_total_ns", totalTook).
			Send()
	}
}

type CaptureResult struct {
	Piece Piece
	X     uint16
	Y     uint16
}

type MovedPieceResult struct {
	Piece Piece
	FromX uint16
	FromY uint16
	ToX   uint16
	ToY   uint16
}

type MoveResult struct {
	Valid         bool
	MovedPieces   []MovedPieceResult
	CapturedPiece CaptureResult
	Seqnum        uint64
	WinningMove   bool
}

func (b *Board) crossedSquaresAreEmpty(fromX, fromY, toX, toY uint16) bool {
	dx := int32(0)
	if fromX < toX {
		dx = 1
	} else if fromX > toX {
		dx = -1
	}

	dy := int32(0)
	if fromY < toY {
		dy = 1
	} else if fromY > toY {
		dy = -1
	}

	if dx == 0 && dy == 0 {
		log.Printf("BUG: crossedSquaresAreEmpty: %d %d %d %d", fromX, fromY, toX, toY)
		b.generalLogger.Error().Str("error_kind", "crossed_squares_are_empty").
			Uint16("from_x", fromX).Uint16("from_y", fromY).
			Uint16("to_x", toX).Uint16("to_y", toY).
			Send()
		return false
	}

	x := int32(fromX) + dx
	y := int32(fromY) + dy
	for x != int32(toX) || y != int32(toY) {
		if x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE {
			log.Printf("BUG: crossedSquaresAreEmpty out of bounds: %d %d %d %d", fromX, fromY, toX, toY)
			b.generalLogger.Error().Str("error_kind", "crossed_squares_are_empty_out_of_bounds").
				Uint16("from_x", fromX).Uint16("from_y", fromY).
				Uint16("to_x", toX).Uint16("to_y", toY).
				Send()
			return false
		}
		raw := b.pieces[y][x]
		if !EncodedIsEmpty(EncodedPiece(raw)) {
			return false
		}

		x += dx
		y += dy
	}
	return true
}

func (b *Board) satisfiesPawnMoveRules(movedPiece Piece, capturedPiece Piece, move Move) bool {
	dy := int32(move.ToY) - int32(move.FromY)
	absDy := AbsInt32(dy)

	// at most 2 squares vertically
	if absDy != 1 && absDy != 2 {
		return false
	}
	dx := int32(move.ToX) - int32(move.FromX)
	absDx := AbsInt32(dx)

	// at most 1 square horizontally
	if absDx != 0 && absDx != 1 {
		return false
	}

	if absDx == 1 && capturedPiece.IsEmpty() {
		return false
	} else if absDx == 0 && !capturedPiece.IsEmpty() {
		return false
	}

	// white pawns move up, black pawns move down
	if dy < 0 && !movedPiece.IsWhite || dy > 0 && movedPiece.IsWhite {
		return false
	}

	// pawns can only move 2 squares if they haven't moved yet
	if absDy == 2 && movedPiece.MoveCount != 0 {
		return false
	}

	return b.crossedSquaresAreEmpty(move.FromX, move.FromY, move.ToX, move.ToY)
}

func (b *Board) satisfiesKnightMoveRules(move Move) bool {
	dx := int32(move.ToX) - int32(move.FromX)
	dy := int32(move.ToY) - int32(move.FromY)
	absDx := AbsInt32(dx)
	absDy := AbsInt32(dy)
	if absDx == 2 && absDy == 1 || absDx == 1 && absDy == 2 {
		return true
	}
	return false
}

func (b *Board) satisfiesBishopMoveRules_aux(move Move) bool {
	absDx := AbsDiffUint16(move.ToX, move.FromX)
	absDy := AbsDiffUint16(move.ToY, move.FromY)
	return absDx == absDy
}

func (b *Board) satisfiesBishopMoveRules(move Move) bool {
	return b.satisfiesBishopMoveRules_aux(move) && b.crossedSquaresAreEmpty(move.FromX, move.FromY, move.ToX, move.ToY)
}

func (b *Board) satisfiesRookMoveRules_aux(move Move) bool {
	return move.FromX == move.ToX || move.FromY == move.ToY
}

func (b *Board) satisfiesRookMoveRules(move Move) bool {
	if !b.satisfiesRookMoveRules_aux(move) {
		return false
	}
	return b.crossedSquaresAreEmpty(move.FromX, move.FromY, move.ToX, move.ToY)
}

func (b *Board) satisfiesQueenMoveRules(move Move) bool {
	if !b.satisfiesBishopMoveRules_aux(move) && !b.satisfiesRookMoveRules_aux(move) {
		return false
	}
	return b.crossedSquaresAreEmpty(move.FromX, move.FromY, move.ToX, move.ToY)
}

func (b *Board) satisfiesKingMoveRules(move Move) bool {
	absDx := AbsDiffUint16(move.ToX, move.FromX)
	absDy := AbsDiffUint16(move.ToY, move.FromY)
	if absDx > 1 || absDy > 1 {
		return false
	}
	startBoardX := move.FromX / 8
	startBoardY := move.FromY / 8
	endBoardX := move.ToX / 8
	endBoardY := move.ToY / 8
	if startBoardX != endBoardX || startBoardY != endBoardY {
		return false
	}
	return true
}

func (b *Board) satisfiesMoveRules(movedPiece Piece, capturedPiece Piece, move Move) bool {
	switch movedPiece.Type {
	case Pawn:
		return b.satisfiesPawnMoveRules(movedPiece, capturedPiece, move)
	case Knight:
		return b.satisfiesKnightMoveRules(move)
	case Bishop:
		return b.satisfiesBishopMoveRules(move)
	case Rook:
		return b.satisfiesRookMoveRules(move)
	case Queen:
		return b.satisfiesQueenMoveRules(move)
	case PromotedPawn:
		return b.satisfiesQueenMoveRules(move)
	case King:
		return b.satisfiesKingMoveRules(move)
	}
	return true
}

func (b *Board) DoBulkCapture(bulkCaptureRequest *bulkCaptureRequest) (*protocol.ServerBulkCapture, error) {
	capturedPieces := make([]uint32, 0, 16)
	onlyColor := bulkCaptureRequest.OnlyColor()
	startingX := bulkCaptureRequest.StartingX()
	startingY := bulkCaptureRequest.StartingY()
	endingX := bulkCaptureRequest.EndingX()
	endingY := bulkCaptureRequest.EndingY()

	if startingX >= BOARD_SIZE || startingY >= BOARD_SIZE || endingX >= BOARD_SIZE || endingY >= BOARD_SIZE {
		log.Printf("BUG: ClearBoard: out of bounds: %d %d %d %d", startingX, startingY, endingX, endingY)
		b.generalLogger.Error().Str("error_kind", "clear_board_out_of_bounds").
			Uint16("starting_x", startingX).Uint16("starting_y", startingY).
			Uint16("ending_x", endingX).Uint16("ending_y", endingY).
			Send()
		return nil, fmt.Errorf("out of bounds: %d %d %d %d", startingX, startingY, endingX, endingY)
	}

	now := time.Now()
	b.Lock()
	defer b.Unlock()

	for y := startingY; y < endingY; y++ {
		for x := startingX; x < endingX; x++ {
			piece := b.pieces[y][x]
			if EncodedIsEmpty(EncodedPiece(piece)) {
				continue
			}
			p := PieceOfEncodedPiece(EncodedPiece(piece))
			if onlyColor == OnlyColorWhite && !p.IsWhite {
				continue
			} else if onlyColor == OnlyColorBlack && p.IsWhite {
				continue
			}

			if p.IsWhite {
				b.whitePiecesCaptured.Add(1)
				if p.Type == King {
					b.whiteKingsCaptured.Add(1)
				}
			} else {
				b.blackPiecesCaptured.Add(1)
				if p.Type == King {
					b.blackKingsCaptured.Add(1)
				}
			}

			capturedPieces = append(capturedPieces, p.ID)
			b.pieces[y][x] = uint64(EmptyEncodedPiece)
		}
	}
	took := time.Since(now).Nanoseconds()
	b.maybeLogSpecialMutexAction(took, "is_clear_board")

	b.seqNum++
	seqNum := b.seqNum

	return &protocol.ServerBulkCapture{
		CapturedIds: capturedPieces,
		Seqnum:      seqNum,
	}, nil
}

type AdoptionResult struct {
	AdoptedPieces []uint32
	Seqnum        uint64
}

func (b *Board) Adopt(adoptionRequest *adoptionRequest) (*AdoptionResult, error) {
	adoptedPieces := make([]uint32, 0, 16)
	onlyColor := adoptionRequest.OnlyColor()
	startingX := adoptionRequest.StartingX()
	startingY := adoptionRequest.StartingY()
	endingX := adoptionRequest.EndingX()
	endingY := adoptionRequest.EndingY()

	if startingX >= BOARD_SIZE || startingY >= BOARD_SIZE || endingX >= BOARD_SIZE || endingY >= BOARD_SIZE {
		log.Printf("BUG: Adopt: out of bounds: %d %d %d %d", startingX, startingY, endingX, endingY)
		b.generalLogger.Error().Str("error_kind", "adopt_out_of_bounds").
			Uint16("starting_x", startingX).Uint16("starting_y", startingY).
			Uint16("ending_x", endingX).Uint16("ending_y", endingY).
			Send()
		return nil, fmt.Errorf("out of bounds: %d %d %d %d", startingX, startingY, endingX, endingY)
	}

	now := time.Now()
	b.Lock()
	defer b.Unlock()

	for y := startingY; y < endingY; y++ {
		for x := startingX; x < endingX; x++ {
			piece := b.pieces[y][x]
			if EncodedIsEmpty(EncodedPiece(piece)) {
				continue
			}
			p := PieceOfEncodedPiece(EncodedPiece(piece))
			if onlyColor == OnlyColorWhite && !p.IsWhite {
				continue
			} else if onlyColor == OnlyColorBlack && p.IsWhite {
				continue
			}
			p.Adopted = true
			b.pieces[y][x] = uint64(p.Encode())
			adoptedPieces = append(adoptedPieces, p.ID)
		}
	}
	took := time.Since(now).Nanoseconds()
	b.maybeLogSpecialMutexAction(took, "is_adoption")

	b.seqNum++
	seqNum := b.seqNum

	return &AdoptionResult{
		AdoptedPieces: adoptedPieces,
		Seqnum:        seqNum,
	}, nil
}

// this can't handle multiple writers because it releases its read lock before
// acquiring the write lock, which means that if you have multiple writers
// you may apply an invalid move.
//
// Fortunately that's totally fine for us, we just use a single writer :)
//
// we do this because it lets us do validation without holding the write lock,
// which (should?) increase throughput on the whole (our validation is substantially
// more expensive than our move application, which is just a few writes).
func (b *Board) ValidateAndApplyMove__NOTTHREADSAFE(move Move) MoveResult {
	if !move.BoundsCheck() {
		return MoveResult{Valid: false}
	}

	if move.ExceedsMaxMoveDistance() {
		return MoveResult{Valid: false}
	}

	// can't move 0 squares
	if move.FromX == move.ToX && move.FromY == move.ToY {
		return MoveResult{Valid: false}
	}

	b.RLock()
	haveReadLock := true
	defer func() {
		if haveReadLock {
			b.RUnlock()
		}
	}()

	raw := b.pieces[move.FromY][move.FromX]

	// Can't move an empty piece
	if EncodedIsEmpty(EncodedPiece(raw)) {
		// log.Printf("Invalid move: No piece at from position (expected id %d)", move.PieceID)
		return MoveResult{Valid: false}
	}

	movedPiece := PieceOfEncodedPiece(EncodedPiece(raw))

	// Can't move an opponent's piece
	if move.ClientIsPlayingWhite != movedPiece.IsWhite {
		if RESPECT_COLOR_REQUIREMENT {
			return MoveResult{Valid: false}
		}
	}

	// piece ID must match
	if movedPiece.ID != move.PieceID {
		// log.Printf("Invalid move: Piece ID does not match")
		return MoveResult{Valid: false}
	}

	switch move.MoveType {
	case protocol.MoveType_MOVE_TYPE_CASTLE:
		// Must be a king
		if movedPiece.Type != King {
			return MoveResult{Valid: false}
		}
		// Must be unmoved
		if movedPiece.MoveCount != 0 {
			return MoveResult{Valid: false}
		}
		// Must be moving 2 squares horizontally and none vertically
		dx := int32(move.ToX) - int32(move.FromX)
		dy := int32(move.ToY) - int32(move.FromY)
		if dx != 2 && dx != -2 {
			return MoveResult{Valid: false}
		}

		if dy != 0 {
			return MoveResult{Valid: false}
		}

		// Must have a piece in the correct position
		rookFromX := int32(move.FromX)
		rookFromY := uint16(move.FromY)
		if dx == 2 {
			rookFromX += 3
		} else {
			rookFromX -= 4
		}

		if rookFromX < 0 || rookFromX >= BOARD_SIZE {
			return MoveResult{Valid: false}
		}

		rookPieceRaw := b.pieces[rookFromY][rookFromX]
		if EncodedIsEmpty(EncodedPiece(rookPieceRaw)) {
			return MoveResult{Valid: false}
		}

		rookPiece := PieceOfEncodedPiece(EncodedPiece(rookPieceRaw))
		// Piece must be a rook
		if rookPiece.Type != Rook {
			return MoveResult{Valid: false}
		}

		// Rook must be of the correct color
		if rookPiece.IsWhite != movedPiece.IsWhite {
			return MoveResult{Valid: false}
		}

		// Rook must be unmoved
		if rookPiece.MoveCount != 0 {
			return MoveResult{Valid: false}
		}

		// Back rank on the relevant side must be empty
		backEmpty := b.crossedSquaresAreEmpty(move.FromX, move.FromY, uint16(rookFromX), uint16(rookFromY))
		if !backEmpty {
			return MoveResult{Valid: false}
		}

		rookToY := uint16(move.ToY)
		rookToX := uint16(move.ToX)

		if dx == 2 {
			rookToX -= 1
		} else {
			rookToX += 1
		}

		// That's it! Apply the move
		movedPiece.MoveCount = 1
		rookPiece.MoveCount = 1
		haveReadLock = false
		b.RUnlock()
		now := time.Now()
		b.Lock()
		b.pieces[move.FromY][move.FromX] = uint64(EmptyEncodedPiece)
		b.pieces[rookFromY][rookFromX] = uint64(EmptyEncodedPiece)
		b.pieces[move.ToY][move.ToX] = uint64(movedPiece.Encode())
		b.pieces[rookToY][rookToX] = uint64(rookPiece.Encode())
		b.totalMoves.Add(1)
		b.seqNum++
		seqNum := b.seqNum
		b.Unlock()
		took := time.Since(now).Nanoseconds()
		b.maybeLogMutexDuration(took)

		kingMoveResult := MovedPieceResult{
			Piece: movedPiece,
			FromX: move.FromX,
			FromY: move.FromY,
			ToX:   move.ToX,
			ToY:   move.ToY,
		}
		rookMoveResult := MovedPieceResult{
			Piece: rookPiece,
			FromX: uint16(rookFromX),
			FromY: rookFromY,
			ToX:   rookToX,
			ToY:   rookToY,
		}

		movedPieces := []MovedPieceResult{kingMoveResult, rookMoveResult}
		return MoveResult{Valid: true, MovedPieces: movedPieces, Seqnum: seqNum}

	case protocol.MoveType_MOVE_TYPE_EN_PASSANT:
		// Must be a pawn
		if movedPiece.Type != Pawn {
			return MoveResult{Valid: false}
		}

		// dy must be 1 (black) or -1 (white)
		dy := int32(move.ToY) - int32(move.FromY)
		if movedPiece.IsWhite && dy != -1 || !movedPiece.IsWhite && dy != 1 {
			return MoveResult{Valid: false}
		}

		// dx must be 1 or -1
		dx := int32(move.ToX) - int32(move.FromX)
		if dx != 1 && dx != -1 {
			return MoveResult{Valid: false}
		}

		// There can't be a piece in the way
		otherPiece := b.pieces[move.ToY][move.ToX]
		if !EncodedIsEmpty(EncodedPiece(otherPiece)) {
			return MoveResult{Valid: false}
		}

		// there must be a piece at dx + current x, current y
		capturedX := move.FromX + uint16(dx)
		capturedY := move.FromY
		capturedRaw := b.pieces[capturedY][capturedX]

		if EncodedIsEmpty(EncodedPiece(capturedRaw)) {
			return MoveResult{Valid: false}
		}

		capturedPiece := PieceOfEncodedPiece(EncodedPiece(capturedRaw))

		// must be a pawn of the opposite color
		if capturedPiece.IsWhite == movedPiece.IsWhite {
			return MoveResult{Valid: false}
		}

		// must be a pawn
		if capturedPiece.Type != Pawn {
			return MoveResult{Valid: false}
		}

		// must have double moved
		if !capturedPiece.JustDoubleMoved {
			return MoveResult{Valid: false}
		}

		// That's it! Apply the move
		movedPiece.IncrementMoveCount()
		movedPiece.IncrementCaptureCount()
		movedPiece.JustDoubleMoved = false
		haveReadLock = false
		b.RUnlock()
		now := time.Now()
		b.Lock()
		b.pieces[move.ToY][move.ToX] = uint64(movedPiece.Encode())
		b.pieces[move.FromY][move.FromX] = uint64(EmptyEncodedPiece)
		b.pieces[capturedY][capturedX] = uint64(EmptyEncodedPiece)
		b.seqNum++
		seqNum := b.seqNum
		b.Unlock()
		took := time.Since(now).Nanoseconds()
		b.maybeLogMutexDuration(took)

		if capturedPiece.IsWhite {
			b.whitePiecesCaptured.Add(1)
		} else {
			b.blackPiecesCaptured.Add(1)
		}
		b.totalMoves.Add(1)

		movedPieceResult := MovedPieceResult{
			Piece: movedPiece,
			FromX: move.FromX,
			FromY: move.FromY,
			ToX:   move.ToX,
			ToY:   move.ToY,
		}
		movedPieces := []MovedPieceResult{movedPieceResult}

		return MoveResult{Valid: true, MovedPieces: movedPieces,
			CapturedPiece: CaptureResult{
				Piece: capturedPiece,
				X:     capturedX,
				Y:     capturedY,
			},
			Seqnum: seqNum,
		}

	case protocol.MoveType_MOVE_TYPE_NORMAL:
		capturedRaw := b.pieces[move.ToY][move.ToX]
		capturedPiece := PieceOfEncodedPiece(EncodedPiece(capturedRaw))

		if !capturedPiece.IsEmpty() {
			// must capture pieces of the opposite color
			if capturedPiece.IsWhite == movedPiece.IsWhite {
				return MoveResult{Valid: false}
			}

			startBoardX := move.FromX / 8
			startBoardY := move.FromY / 8
			endBoardX := move.ToX / 8
			endBoardY := move.ToY / 8

			// captures must be on the same sub-board
			if startBoardX != endBoardX || startBoardY != endBoardY {
				return MoveResult{Valid: false}
			}
		}

		// Must satisfy move rules
		if !b.satisfiesMoveRules(movedPiece, capturedPiece, move) {
			return MoveResult{Valid: false}
		}

		// Pawns must handle double move, promotion
		if movedPiece.Type == Pawn {
			dy := int32(move.ToY) - int32(move.FromY)
			if dy == 2 || dy == -2 {
				movedPiece.JustDoubleMoved = true
			} else {
				movedPiece.JustDoubleMoved = false
			}

			if move.ToY == 0 && movedPiece.IsWhite {
				movedPiece.Type = PromotedPawn
			} else if move.ToY == BOARD_SIZE-1 && !movedPiece.IsWhite {
				movedPiece.Type = PromotedPawn
			}
		}
		movedPiece.IncrementMoveCount()
		winningMove := false

		if !capturedPiece.IsEmpty() {
			movedPiece.IncrementCaptureCount()
			if capturedPiece.IsWhite {
				b.whitePiecesCaptured.Add(1)
			} else {
				b.blackPiecesCaptured.Add(1)
			}
			if capturedPiece.Type == Queen {
				movedPiece.QueenKiller = true
				if movedPiece.Type == Pawn {
					movedPiece.QueenPawner = true
				}
			}
			if capturedPiece.Type == King {
				if capturedPiece.IsWhite {
					count := b.whiteKingsCaptured.Add(1)
					if count == TOTAL_KINGS_PER_SIDE {
						winningMove = true
					}
				} else {
					count := b.blackKingsCaptured.Add(1)
					if count == TOTAL_KINGS_PER_SIDE {
						winningMove = true
					}
				}
				movedPiece.KingKiller = true
				if movedPiece.Type == Pawn {
					movedPiece.KingPawner = true
				}
			}
			if capturedPiece.Adopted {
				movedPiece.AdoptedKiller = true
			}
			if capturedPiece.Type != movedPiece.Type {
				movedPiece.HasCapturedPieceTypeOtherThanOwn = true
			}
		}

		// Actually apply the move!
		haveReadLock = false
		b.RUnlock()
		now := time.Now()
		b.Lock()
		b.pieces[move.FromY][move.FromX] = uint64(EmptyEncodedPiece)
		b.pieces[move.ToY][move.ToX] = uint64(movedPiece.Encode())
		b.seqNum++
		seqNum := b.seqNum
		b.Unlock()
		took := time.Since(now).Nanoseconds()
		b.maybeLogMutexDuration(took)

		b.totalMoves.Add(1)
		movedPieceResult := MovedPieceResult{
			Piece: movedPiece,
			FromX: move.FromX,
			FromY: move.FromY,
			ToX:   move.ToX,
			ToY:   move.ToY,
		}
		movedPieces := []MovedPieceResult{movedPieceResult}

		if !capturedPiece.IsEmpty() {
			return MoveResult{Valid: true, MovedPieces: movedPieces,
				CapturedPiece: CaptureResult{
					Piece: capturedPiece,
					X:     move.ToX,
					Y:     move.ToY,
				},
				Seqnum:      seqNum,
				WinningMove: winningMove,
			}
		} else {
			return MoveResult{
				Valid:       true,
				MovedPieces: movedPieces,
				Seqnum:      seqNum,
				WinningMove: winningMove,
			}
		}
	default:
		// log.Printf("Invalid move: Move type not supported")
		return MoveResult{Valid: false}
	}
}

func (b *Board) GetStats() GameStats {
	b.RLock()
	seqnum := b.seqNum
	b.RUnlock()
	return GameStats{
		TotalMoves:           b.totalMoves.Load(),
		WhitePiecesRemaining: 16000000 - b.whitePiecesCaptured.Load(),
		BlackPiecesRemaining: 16000000 - b.blackPiecesCaptured.Load(),
		WhiteKingsRemaining:  1000000 - b.whiteKingsCaptured.Load(),
		BlackKingsRemaining:  1000000 - b.blackKingsCaptured.Load(),
		Seqnum:               seqnum,
	}
}

// CR-someday nroyalty: LRU cache for a very small period of time?? Pretty annoying
// to implement with how we've done things so far.
// CR-someday nroyalty: we could pass in a function that returns the current position
// and use that to figure out the client's position at lock-aquisition time,
// not lock-request time. Not a huge deal in practice probably.
func (b *Board) GetBoardSnapshot_RETURN_TO_POOL_AFTER_YOU_FUCK(pos Position) *protocol.ServerStateSnapshot {
	start := time.Now()
	minX := uint16(0)
	minY := uint16(0)
	maxX := uint16(BOARD_SIZE - 1)
	maxY := uint16(BOARD_SIZE - 1)

	if pos.X > VIEW_RADIUS {
		minX = pos.X - VIEW_RADIUS
	}
	if pos.Y > VIEW_RADIUS {
		minY = pos.Y - VIEW_RADIUS
	}
	if pos.X+VIEW_RADIUS < BOARD_SIZE {
		maxX = pos.X + VIEW_RADIUS
	}
	if pos.Y+VIEW_RADIUS < BOARD_SIZE {
		maxY = pos.Y + VIEW_RADIUS
	}

	width := maxX - minX + 1
	height := maxY - minY + 1

	// we don't zero this out when we get it, but that should be fine
	// since we're writing over every value that we read
	piecesPtr := b.rawRowsPool.Get().(*[][]uint64)
	pieces := *piecesPtr

	preLock := time.Now()
	b.RLock()
	seqnum := b.seqNum
	for y := minY; y <= maxY; y++ {
		copy(pieces[y-minY], b.pieces[y][minX:maxX+1])
	}
	b.RUnlock()
	lockTook := time.Since(preLock).Nanoseconds()

	// estimate that the slice is half-full?
	pieceStates := make([]*protocol.PieceDataForSnapshot, 0, (width*height)/2)
	startingDx := int16(minX) - int16(pos.X)
	startingDy := int16(minY) - int16(pos.Y)
	for y := uint16(0); y < height; y++ {
		for x := uint16(0); x < width; x++ {
			raw := pieces[y][x]
			encodedPiece := EncodedPiece(raw)
			if EncodedIsEmpty(encodedPiece) {
				continue
			}
			piece := PieceOfEncodedPiece(encodedPiece)
			pieceStates = append(pieceStates, piece.ToProtocolForSnapshot(
				int32(startingDx+int16(x)),
				int32(startingDy+int16(y))))
		}
	}

	b.rawRowsPool.Put(piecesPtr)

	snapshot := &protocol.ServerStateSnapshot{
		Pieces: pieceStates,
		Seqnum: seqnum,
		XCoord: uint32(pos.X),
		YCoord: uint32(pos.Y),
	}
	totalTook := time.Since(start).Nanoseconds()

	b.maybeLogSnapshotDuration(lockTook, totalTook)
	return snapshot
}

func (b *Board) setupPiecesForColor(boardX, boardY uint16, isWhite bool) {
	baseX := boardX * SINGLE_BOARD_SIZE
	baseY := boardY * SINGLE_BOARD_SIZE
	if baseX > BOARD_SIZE-SINGLE_BOARD_SIZE || baseY > BOARD_SIZE-SINGLE_BOARD_SIZE {
		log.Printf("Board section is out of bounds: %d, %d", baseX, baseY)
		return
	}

	var pawnRow, pieceRow uint16

	if isWhite {
		pieceRow = baseY + 7 // Bottom row for white
		pawnRow = baseY + 6  // Second-to-bottom for white pawns
	} else {
		pieceRow = baseY    // Top row for black
		pawnRow = baseY + 1 // Second row for black pawns
	}

	for x := uint16(0); x < 8; x++ {
		piece := b.createPiece(Pawn, isWhite)
		b.pieces[pawnRow][baseX+x] = uint64(piece.Encode())
	}

	pieceTypes := []protocol.PieceType{Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook}
	for x := uint16(0); x < 8; x++ {
		piece := b.createPiece(pieceTypes[x], isWhite)
		b.pieces[pieceRow][baseX+x] = uint64(piece.Encode())
	}
}

func (b *Board) createPiece(pieceType protocol.PieceType, isWhite bool) Piece {
	piece := NewPiece(b.nextID, pieceType, isWhite)
	b.nextID++
	return piece
}

const ACTUALLY_RANDOMIZE = false
const ONLY_A_FEW_BOARDS = false
const ONLY_A_FEW_BOARDS_COUNT = 1

func (b *Board) InitializeRandom() {
	b.Lock()
	defer b.Unlock()
	log.Printf("Initializing random board")
	startX := uint16(0)
	startY := uint16(0)
	for dx := range 1000 {
		for dy := range 1000 {
			includeWhite := true
			includeBlack := true
			if ACTUALLY_RANDOMIZE {
				random := rand.Intn(1500)
				includeWhite = random > dy
				includeBlack = random > dx
			} else if ONLY_A_FEW_BOARDS {
				good := dx < ONLY_A_FEW_BOARDS_COUNT && dy == 0
				includeWhite = good
				includeBlack = good
			}
			if includeWhite {
				b.setupPiecesForColor(startX+uint16(dx), startY+uint16(dy), true)
			} else {
				b.whitePiecesCaptured.Add(16)
				b.whiteKingsCaptured.Add(1)
			}
			if includeBlack {
				b.setupPiecesForColor(startX+uint16(dx), startY+uint16(dy), false)
			} else {
				b.blackPiecesCaptured.Add(16)
				b.blackKingsCaptured.Add(1)
			}
		}
	}
}

type Position struct {
	X uint16 `json:"x"`
	Y uint16 `json:"y"`
}
