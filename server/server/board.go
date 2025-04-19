package server

// CR nroyalty: remove log lines here before shipping to prod?

import (
	"log"
	"math"
	"math/rand"
	"sync/atomic"
)

// Board represents the entire game state
type Board struct {
	pieces              [BOARD_SIZE][BOARD_SIZE]atomic.Uint64
	nextID              uint32
	seqNum              atomic.Uint64
	totalMoves          atomic.Uint64
	whitePiecesCaptured atomic.Uint32
	blackPiecesCaptured atomic.Uint32
	whiteKingsCaptured  atomic.Uint32
	blackKingsCaptured  atomic.Uint32
}

// GameStats tracks global game statistics
type GameStats struct {
	TotalMoves           uint64
	WhitePiecesRemaining uint32
	BlackPiecesRemaining uint32
	WhiteKingsRemaining  uint32
	BlackKingsRemaining  uint32
}

// NewBoard creates a new empty board
func NewBoard() *Board {
	return &Board{
		nextID:              1,
		seqNum:              atomic.Uint64{},
		totalMoves:          atomic.Uint64{},
		whitePiecesCaptured: atomic.Uint32{},
		blackPiecesCaptured: atomic.Uint32{},
		whiteKingsCaptured:  atomic.Uint32{},
		blackKingsCaptured:  atomic.Uint32{},
	}
}

// GetPiece returns the piece at the given coordinates
func (b *Board) GetPiece(x, y uint16) *Piece {
	if x >= BOARD_SIZE || y >= BOARD_SIZE {
		return nil
	}

	raw := b.pieces[y][x].Load()
	piece := PieceOfEncodedPiece(EncodedPiece(raw))
	if piece.IsEmpty() {
		return nil
	}
	return &piece
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

// MoveResult represents the outcome of a move validation
type MoveResult struct {
	Valid         bool
	MovedPieces   [2]MovedPieceResult
	Length        uint16
	CapturedPiece CaptureResult
	Seqnum        uint64
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
		return false
	}

	x := int32(fromX) + dx
	y := int32(fromY) + dy
	for x != int32(toX) || y != int32(toY) {
		if x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE {
			log.Printf("BUG: crossedSquaresAreEmpty out of bounds: %d %d %d %d", fromX, fromY, toX, toY)
			return false
		}
		raw := b.pieces[y][x].Load()
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
	absDy := int32(math.Abs(float64(dy)))
	// at most 2 squares vertically
	if absDy != 1 && absDy != 2 {
		return false
	}
	dx := int32(move.ToX) - int32(move.FromX)
	absDx := int32(math.Abs(float64(dx)))
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
	absDx := int32(math.Abs(float64(dx)))
	absDy := int32(math.Abs(float64(dy)))
	if absDx == 2 && absDy == 1 || absDx == 1 && absDy == 2 {
		return true
	}
	return false
}

func (b *Board) satisfiesBishopMoveRules_aux(move Move) bool {
	absDx := int32(math.Abs(float64(move.ToX) - float64(move.FromX)))
	absDy := int32(math.Abs(float64(move.ToY) - float64(move.FromY)))
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
	dx := int32(move.ToX) - int32(move.FromX)
	dy := int32(move.ToY) - int32(move.FromY)
	absDx := int32(math.Abs(float64(dx)))
	absDy := int32(math.Abs(float64(dy)))
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

func (b *Board) ValidateAndApplyMove(move Move) MoveResult {
	// Must be in bounds
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

	raw := b.pieces[move.FromY][move.FromX].Load()
	movedPiece := PieceOfEncodedPiece(EncodedPiece(raw))

	// can't move an empty piece
	if movedPiece.IsEmpty() {
		log.Printf("Invalid move: No piece at from position (expected id %d)", move.PieceID)
		return MoveResult{Valid: false}
	}

	if move.ClientIsPlayingWhite != movedPiece.IsWhite {
		if RESPECT_COLOR_REQUIREMENT {
			// log.Printf("Invalid move: Piece is not the correct color")
			return MoveResult{Valid: false}
		}
	}

	// piece ID must match
	if movedPiece.ID != move.PieceID {
		log.Printf("Invalid move: Piece ID does not match")
		return MoveResult{Valid: false}
	}

	switch move.MoveType {
	case MoveTypeCastle:
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

		rookPieceRaw := b.pieces[rookFromY][rookFromX].Load()
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
		b.pieces[move.FromY][move.FromX].Store(uint64(EmptyEncodedPiece))
		b.pieces[rookFromY][rookFromX].Store(uint64(EmptyEncodedPiece))
		b.pieces[move.ToY][move.ToX].Store(uint64(movedPiece.Encode()))
		b.pieces[rookToY][rookToX].Store(uint64(rookPiece.Encode()))

		b.totalMoves.Add(1)
		b.seqNum.Add(1)

		seqNum := b.seqNum.Load()

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
		movedPieces := [2]MovedPieceResult{kingMoveResult, rookMoveResult}

		return MoveResult{Valid: true, MovedPieces: movedPieces, Length: 2, Seqnum: seqNum}

	case MoveTypeEnPassant:
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
		otherPiece := b.pieces[move.ToY][move.ToX].Load()
		if !EncodedIsEmpty(EncodedPiece(otherPiece)) {
			return MoveResult{Valid: false}
		}

		// there must be a piece at dx + current x, current y
		capturedX := move.FromX + uint16(dx)
		capturedY := move.FromY
		capturedRaw := b.pieces[capturedY][capturedX].Load()
		capturedPiece := PieceOfEncodedPiece(EncodedPiece(capturedRaw))

		if capturedPiece.IsEmpty() {
			return MoveResult{Valid: false}
		}

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
		b.pieces[move.ToY][move.ToX].Store(uint64(movedPiece.Encode()))
		b.pieces[move.FromY][move.FromX].Store(uint64(EmptyEncodedPiece))
		b.pieces[capturedY][capturedX].Store(uint64(EmptyEncodedPiece))

		if capturedPiece.IsWhite {
			b.whitePiecesCaptured.Add(1)
		} else {
			b.blackPiecesCaptured.Add(1)
		}
		b.totalMoves.Add(1)
		b.seqNum.Add(1)

		seqNum := b.seqNum.Load()

		movedPieceResult := MovedPieceResult{
			Piece: movedPiece,
			FromX: move.FromX,
			FromY: move.FromY,
			ToX:   move.ToX,
			ToY:   move.ToY,
		}
		movedPieces := [2]MovedPieceResult{movedPieceResult}

		return MoveResult{Valid: true, MovedPieces: movedPieces, Length: 1,
			CapturedPiece: CaptureResult{
				Piece: capturedPiece,
				X:     capturedX,
				Y:     capturedY,
			},
			Seqnum: seqNum,
		}

	case MoveTypeNormal:
		capturedRaw := b.pieces[move.ToY][move.ToX].Load()
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

		if !capturedPiece.IsEmpty() {
			movedPiece.IncrementCaptureCount()
			if capturedPiece.IsWhite {
				b.whitePiecesCaptured.Add(1)
				if capturedPiece.Type == King {
					b.whiteKingsCaptured.Add(1)
				}
			} else {
				b.blackPiecesCaptured.Add(1)
				if capturedPiece.Type == King {
					b.blackKingsCaptured.Add(1)
				}
			}
		}

		// Actually apply the move!
		// Do the store before the swap so that if we have a race, we don't have
		// a duplicate piece on the board. This does mean that we potentially
		// have a race where a piece disappears from the board, but I think that's
		// fine since we'll send the move information to the client.
		b.pieces[move.FromY][move.FromX].Store(uint64(EmptyEncodedPiece))
		b.pieces[move.ToY][move.ToX].Store(uint64(movedPiece.Encode()))

		b.totalMoves.Add(1)
		b.seqNum.Add(1)

		seqNum := b.seqNum.Load()
		movedPieceResult := MovedPieceResult{
			Piece: movedPiece,
			FromX: move.FromX,
			FromY: move.FromY,
			ToX:   move.ToX,
			ToY:   move.ToY,
		}
		movedPieces := [2]MovedPieceResult{movedPieceResult}

		if !capturedPiece.IsEmpty() {
			return MoveResult{Valid: true, MovedPieces: movedPieces,
				Length: 1,
				CapturedPiece: CaptureResult{
					Piece: capturedPiece,
					X:     move.ToX,
					Y:     move.ToY,
				},
				Seqnum: seqNum,
			}
		} else {
			return MoveResult{Valid: true, MovedPieces: movedPieces, Length: 1, Seqnum: seqNum}
		}
	default:
		log.Printf("Invalid move: Move type not supported")
		return MoveResult{Valid: false}
	}
}

// ResetBoardSection initializes a standard 8x8 chess board at the given position
func (b *Board) ResetBoardSection(boardX, boardY uint16, includeWhite bool, includeBlack bool) []*PieceState {

	if boardX >= 1000 || boardY >= 1000 {
		log.Printf("Board section is out of bounds")
		return nil
	}

	// Calculate base coordinates
	baseX := boardX * 8
	baseY := boardY * 8

	// Track all new pieces for notification
	newPieces := make([]*PieceState, 0, 32)

	// Clear existing pieces in this section
	// think about how to do this later when we care...
	// for y := uint16(0); y < 8; y++ {
	// 	for x := uint16(0); x < 8; x++ {
	// 		worldX := baseX + x
	// 		worldY := baseY + y

	// 		existingPiece := b.pieces[worldY][worldX]
	// 		if existingPiece != nil {
	// 			// Skip pieces that shouldn't be reset based on color flags
	// 			if (whiteOnly && !existingPiece.IsWhite) || (blackOnly && existingPiece.IsWhite) {
	// 				continue
	// 			}
	// 			b.pieces[worldY][worldX] = nil
	// 		}
	// 	}
	// }

	// Place new pieces if we're not excluding their color
	if includeWhite {
		// Place white pieces
		b.setupPiecesForColor(baseX, baseY, true, &newPieces)
	}

	if includeBlack {
		// Place black pieces
		b.setupPiecesForColor(baseX, baseY, false, &newPieces)
	}

	return newPieces
}

// setupPiecesForColor sets up the pieces for one color on a board section
func (b *Board) setupPiecesForColor(baseX, baseY uint16, isWhite bool, newPieces *[]*PieceState) {
	var pawnRow, pieceRow uint16

	if isWhite {
		pieceRow = baseY + 7 // Bottom row for white
		pawnRow = baseY + 6  // Second-to-bottom for white pawns
	} else {
		pieceRow = baseY    // Top row for black
		pawnRow = baseY + 1 // Second row for black pawns
	}

	// Place pawns
	for x := uint16(0); x < 8; x++ {
		piece := b.createPiece(Pawn, isWhite)
		b.pieces[pawnRow][baseX+x].Store(uint64(piece.Encode()))
		*newPieces = append(*newPieces, &PieceState{
			Piece: piece,
			X:     baseX + x,
			Y:     pawnRow,
		})
	}

	// Place major pieces
	pieceTypes := []PieceType{Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook}
	for x := uint16(0); x < 8; x++ {
		piece := b.createPiece(pieceTypes[x], isWhite)
		b.pieces[pieceRow][baseX+x].Store(uint64(piece.Encode()))
		*newPieces = append(*newPieces, &PieceState{
			Piece: piece,
			X:     baseX + x,
			Y:     pieceRow,
		})
	}
}

func (b *Board) createPiece(pieceType PieceType, isWhite bool) Piece {
	piece := NewPiece(b.nextID, pieceType, isWhite)
	b.nextID++
	return piece
}

func (b *Board) GetStats() GameStats {
	return GameStats{
		TotalMoves:           b.totalMoves.Load(),
		WhitePiecesRemaining: 32000000 - b.whitePiecesCaptured.Load(),
		BlackPiecesRemaining: 32000000 - b.blackPiecesCaptured.Load(),
		WhiteKingsRemaining:  1000000 - b.whiteKingsCaptured.Load(),
		BlackKingsRemaining:  1000000 - b.blackKingsCaptured.Load(),
	}
}

func (b *Board) GetStateForPosition(pos Position) StateSnapshot {
	startingSeqnum := b.seqNum.Load()
	minX := uint16(0)
	minY := uint16(0)
	maxX := uint16(BOARD_SIZE - 1)
	maxY := uint16(BOARD_SIZE - 1)

	// Adjust for position
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

	pieces := make([]PieceState, 0, 200)

	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			raw := b.pieces[y][x].Load()
			piece := PieceOfEncodedPiece(EncodedPiece(raw))
			if !piece.IsEmpty() {
				pieces = append(pieces, PieceState{
					Piece: piece,
					X:     x,
					Y:     y,
				})
			}
		}
	}

	return StateSnapshot{
		Pieces:         pieces,
		StartingSeqnum: startingSeqnum,
		EndingSeqnum:   b.seqNum.Load(),
		XCoord:         pos.X,
		YCoord:         pos.Y,
	}
}

const ACTUALLY_RANDOMIZE = false

func (b *Board) InitializeRandom() {
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
			}
			// includeWhite := true
			// includeBlack := true
			// includeWhite := random < 50
			// includeBlack := random >= 50
			b.ResetBoardSection(startX+uint16(dx), startY+uint16(dy), includeWhite, includeBlack)
		}
	}
}

type PieceState struct {
	Piece Piece
	X     uint16
	Y     uint16
}

type Position struct {
	X uint16 `json:"x"`
	Y uint16 `json:"y"`
}

type StateSnapshot struct {
	Pieces         []PieceState
	StartingSeqnum uint64
	EndingSeqnum   uint64
	XCoord         uint16
	YCoord         uint16
}
