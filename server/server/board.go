package server

import (
	"log"
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
	if piece.Empty {
		return nil
	}
	return &piece
}

type ApplyMoveResult struct {
	CapturedPiece Piece
	MovedPiece    Piece
	NoMove        bool
}

// ApplyMove applies a move to the board, returning the captured piece if any
func (b *Board) _ApplyMove(piece Piece, move Move) ApplyMoveResult {

	// Get the piece to move
	if piece.Empty {
		return ApplyMoveResult{NoMove: true}
	}

	if piece.MoveState == Unmoved || piece.MoveState == DoubleMoved {
		if piece.Type == Pawn {
			dy := int32(move.ToY) - int32(move.FromY)
			if dy == 2 || dy == -2 {
				piece.MoveState = DoubleMoved
			} else {
				piece.MoveState = Moved
			}
		} else {
			piece.MoveState = Moved
		}
	}

	// Do the store before the swap so that if we have a race, we don't have
	// a duplicate piece on the board. This does mean that we potentially
	// have a race where a piece disappears from the board, but I think that's
	// fine since we'll send the move information to the client.
	b.pieces[move.FromY][move.FromX].Store(uint64(EmptyEncodedPiece))
	capturedEncodedPiece := b.pieces[move.ToY][move.ToX].Swap(uint64(piece.Encode()))
	capturedPiece := PieceOfEncodedPiece(EncodedPiece(capturedEncodedPiece))

	if !capturedPiece.Empty {

		// Update capture statistics
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

	// Increment move counter
	b.totalMoves.Add(1)
	b.seqNum.Add(1)

	return ApplyMoveResult{CapturedPiece: capturedPiece, MovedPiece: piece, NoMove: false}
}

// MoveResult represents the outcome of a move validation
type MoveResult struct {
	Valid         bool
	MovedPiece    Piece
	CapturedPiece Piece
	SeqNum        uint64
}

func (b *Board) ValidateAndApplyMove(move Move) MoveResult {
	if !BoundsCheck(move) {
		log.Printf("Invalid move: Move is out of bounds")
		return MoveResult{Valid: false, MovedPiece: Piece{}, CapturedPiece: Piece{}}
	}

	raw := b.pieces[move.FromY][move.FromX].Load()
	movedPiece := PieceOfEncodedPiece(EncodedPiece(raw))
	if movedPiece.Empty {
		log.Printf("Invalid move: No piece at from position (expected id %d)", move.PieceID)
		return MoveResult{Valid: false, MovedPiece: Piece{}, CapturedPiece: Piece{}}
	}

	if movedPiece.ID != move.PieceID {
		log.Printf("Invalid move: Piece ID does not match")
		return MoveResult{Valid: false, MovedPiece: Piece{}, CapturedPiece: Piece{}}
	}

	// Check if the move is valid
	if !SatisfiesBasicMoveRules(b, move) {
		log.Printf("Invalid move: Move does not satisfy basic move rules")
		return MoveResult{Valid: false, MovedPiece: Piece{}, CapturedPiece: Piece{}}
	}
	result := b._ApplyMove(movedPiece, move)
	if result.NoMove {
		return MoveResult{Valid: false, MovedPiece: Piece{}, CapturedPiece: Piece{}}
	}
	seqNum := b.seqNum.Load()
	return MoveResult{Valid: true, MovedPiece: result.MovedPiece, CapturedPiece: result.CapturedPiece, SeqNum: seqNum}
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

// createPiece creates a new piece and increments the ID counter
func (b *Board) createPiece(pieceType PieceType, isWhite bool) Piece {
	piece := NewPiece(b.nextID, pieceType, isWhite)
	b.nextID++
	return piece
}

// GetStats returns a copy of the current game statistics
func (b *Board) GetStats() GameStats {
	return GameStats{
		TotalMoves:           b.totalMoves.Load(),
		WhitePiecesRemaining: 32000000 - b.whitePiecesCaptured.Load(),
		BlackPiecesRemaining: 32000000 - b.blackPiecesCaptured.Load(),
		WhiteKingsRemaining:  1000000 - b.whiteKingsCaptured.Load(),
		BlackKingsRemaining:  1000000 - b.blackKingsCaptured.Load(),
	}
}

// GetStateForPosition returns all pieces in a window around the given position
func (b *Board) GetStateForPosition(pos Position) StateSnapshot {
	startingSeqNum := b.seqNum.Load()
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

	// Collect pieces in the viewport
	pieces := make([]PieceState, 0, 100) // Approximate capacity

	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			raw := b.pieces[y][x].Load()
			piece := PieceOfEncodedPiece(EncodedPiece(raw))
			if !piece.Empty {
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
		AreaMinX:       minX,
		AreaMinY:       minY,
		AreaMaxX:       maxX,
		AreaMaxY:       maxY,
		StartingSeqNum: startingSeqNum,
		EndingSeqNum:   b.seqNum.Load(),
	}
}

func (b *Board) InitializeRandom() {
	log.Printf("Initializing random board")
	startX := uint16(0)
	startY := uint16(0)
	for dx := range 1000 {
		for dy := range 1000 {
			random := rand.Intn(1500)
			includeWhite := random > dy
			includeBlack := random > dx
			// includeWhite := random < 50
			// includeBlack := random >= 50
			b.ResetBoardSection(startX+uint16(dx), startY+uint16(dy), includeWhite, includeBlack)
		}
	}
}

// PieceState combines a piece with its position
type PieceState struct {
	Piece Piece
	X     uint16
	Y     uint16
}

// Position represents a client's current view position
type Position struct {
	X uint16
	Y uint16
}

// StateSnapshot contains all piece data for a client's view
type StateSnapshot struct {
	Pieces         []PieceState
	AreaMinX       uint16
	AreaMinY       uint16
	AreaMaxX       uint16
	AreaMaxY       uint16
	StartingSeqNum uint64
	EndingSeqNum   uint64
}
