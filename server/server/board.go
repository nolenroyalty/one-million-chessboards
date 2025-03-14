package server

import (
	"log"
	"sync"
)

// Board represents the entire game state
type Board struct {
	pieces   [BOARD_SIZE][BOARD_SIZE]*Piece
	nextID   uint64
	mu       sync.RWMutex
	stats    GameStats
}

// GameStats tracks global game statistics
type GameStats struct {
	TotalMoves          uint32
	WhitePiecesCaptured uint32
	BlackPiecesCaptured uint32
	WhiteKingsCaptured  uint32
	BlackKingsCaptured  uint32
}

// NewBoard creates a new empty board
func NewBoard() *Board {
	return &Board{
		nextID: 1,
	}
}

// GetPiece returns the piece at the given coordinates (thread-safe)
func (b *Board) GetPiece(x, y uint16) *Piece {
	b.mu.RLock()
	defer b.mu.RUnlock()
	
	if x >= BOARD_SIZE || y >= BOARD_SIZE {
		return nil
	}
	
	return b.pieces[y][x]
}

// ApplyMove applies a move to the board, returning the captured piece if any
func (b *Board) _ApplyMove(move Move) *Piece {
	
	// Get the piece to move
	piece := b.pieces[move.FromY][move.FromX]
	if piece == nil {
		return nil
	}
	
	// Check if there's a piece to capture
	var capturedPiece *Piece
	if b.pieces[move.ToY][move.ToX] != nil {
		capturedPiece = b.pieces[move.ToY][move.ToX]
		
		// Update capture statistics
		if capturedPiece.IsWhite {
			b.stats.WhitePiecesCaptured++
			if capturedPiece.Type == King {
				b.stats.WhiteKingsCaptured++
			}
		} else {
			b.stats.BlackPiecesCaptured++
			if capturedPiece.Type == King {
				b.stats.BlackKingsCaptured++
			}
		}
	}
	
	// Move the piece
	b.pieces[move.ToY][move.ToX] = piece
	b.pieces[move.FromY][move.FromX] = nil
	
	// Update move state
	if piece.MoveState == Unmoved {
		if piece.Type == Pawn && (move.ToY > move.FromY+1 || move.ToY+1 < move.FromY) {
			piece.MoveState = DoubleMoved
		} else {
			piece.MoveState = Moved
		}
	} else {
		piece.MoveState = Moved
	}
	
	// Increment move counter
	b.stats.TotalMoves++
	
	return capturedPiece
}

// MoveResult represents the outcome of a move validation
type MoveResult struct {
	Valid         bool
	MovedPiece    *Piece
	CapturedPiece *Piece
}


func (b *Board) ValidateAndApplyMove(move Move) MoveResult {
	log.Printf("Validating and applying move: %v", move)
	if !BoundsCheck(move) {
		log.Printf("Move is out of bounds")
		return MoveResult{Valid: false, MovedPiece: nil, CapturedPiece: nil}
	}

	b.mu.Lock()
	log.Printf("Board locked")
	defer b.mu.Unlock()

	movedPiece := b.pieces[move.FromY][move.FromX]
	if movedPiece == nil {
		log.Printf("No piece at from position")
		return MoveResult{Valid: false, MovedPiece: nil, CapturedPiece: nil}
	}
	
	if movedPiece.ID != move.PieceID {
		log.Printf("Piece ID does not match")
		return MoveResult{Valid: false, MovedPiece: nil, CapturedPiece: nil}
	}
	
	// Check if the move is valid
	if !SatisfiesBasicMoveRules(b, move) {
		log.Printf("Move is invalid")
		return MoveResult{Valid: false, MovedPiece: nil, CapturedPiece: nil}
	}
	log.Printf("Move is valid")
	// Apply the move and get any captured piece
	log.Printf("Moved piece: %v", movedPiece)
	capturedPiece := b._ApplyMove(move)
	log.Printf("Captured piece: %v", capturedPiece)
	log.Printf("returning!")
	
	// Return a result indicating a valid move and any captured piece
	return MoveResult{Valid: true, MovedPiece: movedPiece, CapturedPiece: capturedPiece}
}

// ResetBoardSection initializes a standard 8x8 chess board at the given position
func (b *Board) ResetBoardSection(boardX, boardY uint16, whiteOnly, blackOnly bool) []*PieceState {
	b.mu.Lock()
	defer b.mu.Unlock()
	
	// Calculate base coordinates
	baseX := boardX * 8
	baseY := boardY * 8
	
	// Track all new pieces for notification
	newPieces := make([]*PieceState, 0, 32)
	
	// Clear existing pieces in this section
	for y := uint16(0); y < 8; y++ {
		for x := uint16(0); x < 8; x++ {
			worldX := baseX + x
			worldY := baseY + y
			
			existingPiece := b.pieces[worldY][worldX]
			if existingPiece != nil {
				// Skip pieces that shouldn't be reset based on color flags
				if (whiteOnly && !existingPiece.IsWhite) || (blackOnly && existingPiece.IsWhite) {
					continue
				}
				b.pieces[worldY][worldX] = nil
			}
		}
	}
	
	// Place new pieces if we're not excluding their color
	if !blackOnly {
		// Place white pieces
		b.setupPiecesForColor(baseX, baseY, true, &newPieces)
	}
	
	if !whiteOnly {
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
		pieceRow = baseY     // Top row for black
		pawnRow = baseY + 1  // Second row for black pawns
	}
	
	// Place pawns
	for x := uint16(0); x < 8; x++ {
		piece := b.createPiece(Pawn, isWhite)
		b.pieces[pawnRow][baseX+x] = piece
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
		b.pieces[pieceRow][baseX+x] = piece
		*newPieces = append(*newPieces, &PieceState{
			Piece: piece,
			X:     baseX + x,
			Y:     pieceRow,
		})
	}
}

// createPiece creates a new piece and increments the ID counter
func (b *Board) createPiece(pieceType PieceType, isWhite bool) *Piece {
	piece := NewPiece(b.nextID, pieceType, isWhite)
	b.nextID++
	return piece
}

// GetStats returns a copy of the current game statistics
func (b *Board) GetStats() GameStats {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.stats
}

// GetStateForPosition returns all pieces in a window around the given position
func (b *Board) GetStateForPosition(pos Position) StateSnapshot {
	b.mu.RLock()
	defer b.mu.RUnlock()
	
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
	pieces := make([]*PieceState, 0, 100) // Approximate capacity
	
	for y := minY; y <= maxY; y++ {
		for x := minX; x <= maxX; x++ {
			if b.pieces[y][x] != nil {
				pieces = append(pieces, &PieceState{
					Piece: b.pieces[y][x],
					X:     x,
					Y:     y,
				})
			}
		}
	}
	
	return StateSnapshot{
		Pieces:    pieces,
		AreaMinX:  minX,
		AreaMinY:  minY,
		AreaMaxX:  maxX,
		AreaMaxY:  maxY,
		Timestamp: getCurrentTimestamp(),
	}
}



// getCurrentTimestamp returns the current server timestamp
func getCurrentTimestamp() uint64 {
	return uint64(0) // Placeholder, will be implemented later
}

// PieceState combines a piece with its position
type PieceState struct {
	Piece *Piece
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
	Pieces    []*PieceState
	AreaMinX  uint16
	AreaMinY  uint16
	AreaMaxX  uint16
	AreaMaxY  uint16
	Timestamp uint64
}
