package server

// CR nroyalty: swap this out - no channels, single goroutine with a pointer swap,
// maybe a mutex, and just raw reads to the cached data
// when you do this, consider where else you need to do it.

import (
	"encoding/json"
	"log"
	"sync"
	"sync/atomic"
)

const CELL_SIZE = 5
const NUMBER_OF_CELLS = 1000 / CELL_SIZE

type MinimapCell struct {
	WhiteCount uint16
	BlackCount uint16
}

type packedAggregation uint8

// CR nroyalty: we can pack two of these into a byte and get some real savings...
const (
	amountShift     = 0
	whiteAheadShift = 3
	amountMask      = 0x7
)

func makePackedAggregation(whiteAhead bool, amount uint8) packedAggregation {
	if amount == 0 {
		return packedAggregation(0)
	}
	amountMasked := amount & amountMask
	whiteAheadMasked := 0
	if whiteAhead {
		whiteAheadMasked = 1 << whiteAheadShift
	}
	return packedAggregation(amountMasked | uint8(whiteAheadMasked))
}

type AggregationResponse struct {
	Type         string                                               `json:"type"`
	Aggregations [NUMBER_OF_CELLS * NUMBER_OF_CELLS]packedAggregation `json:"aggregations"`
}

type MinimapAggregator struct {
	sync.Mutex
	cells           [NUMBER_OF_CELLS][NUMBER_OF_CELLS]MinimapCell
	lastAggregation atomic.Value
}

func NewMinimapAggregator() *MinimapAggregator {
	ret := &MinimapAggregator{}
	ret.lastAggregation.Store([]byte{})
	return ret
}

type AggregatorCoords struct {
	X uint16
	Y uint16
}

func getAggregatorCoords(x, y uint16) AggregatorCoords {
	boardX := x / 8
	boardY := y / 8
	cellX := boardX / CELL_SIZE
	cellY := boardY / CELL_SIZE
	return AggregatorCoords{
		X: cellX,
		Y: cellY,
	}
}

func (m *MinimapAggregator) Initialize(board *Board) {
	m.Lock()
	board.RLock()
	for i := 0; i < NUMBER_OF_CELLS; i++ {
		for j := 0; j < NUMBER_OF_CELLS; j++ {
			m.cells[i][j] = MinimapCell{}
		}
	}

	// kinda gross to do raw reads here but it's at startup, whatever
	for i := 0; i < BOARD_SIZE; i++ {
		for j := 0; j < BOARD_SIZE; j++ {
			rawPiece := EncodedPiece(board.pieces[i][j])
			if EncodedIsEmpty(rawPiece) {
				continue
			}
			piece := PieceOfEncodedPiece(rawPiece)
			coords := getAggregatorCoords(uint16(i), uint16(j))
			if piece.IsWhite {
				m.cells[coords.X][coords.Y].WhiteCount++
			} else {
				m.cells[coords.X][coords.Y].BlackCount++
			}
		}
	}
	board.RUnlock()
	m.Unlock()
	m.createAndStoreAggregation()
}

func (m *MinimapAggregator) createAndStoreAggregation() json.RawMessage {
	m.Lock()
	snapshot := m.cells
	m.Unlock()

	response := AggregationResponse{
		Type: "minimapUpdate",
	}
	for i := 0; i < NUMBER_OF_CELLS*NUMBER_OF_CELLS; i++ {
		x := i % NUMBER_OF_CELLS
		y := i / NUMBER_OF_CELLS
		whiteCount := snapshot[x][y].WhiteCount
		blackCount := snapshot[x][y].BlackCount
		diff := max(whiteCount, blackCount) - min(whiteCount, blackCount)
		percentage := float64(diff) / float64(whiteCount+blackCount)
		amount := 0
		if percentage > 0.3 && diff > 50 {
			amount = 3
		} else if percentage > 0.15 && diff > 25 {
			amount = 2
		} else if percentage > 0.03 && diff > 2 {
			amount = 1
		}

		response.Aggregations[i] = makePackedAggregation(whiteCount > blackCount, uint8(amount))
	}
	jsonResponse, err := json.Marshal(response)
	if err != nil {
		log.Printf("Error marshalling aggregation response: %v", err)
		return nil
	}
	m.lastAggregation.Store(jsonResponse)
	return jsonResponse
}

// assumes that the lock is already held!
func (m *MinimapAggregator) unsafeUpdateForAggregatorCoords(coords AggregatorCoords, isWhite bool, decr bool) {
	if isWhite {
		if decr && m.cells[coords.X][coords.Y].WhiteCount > 0 {
			m.cells[coords.X][coords.Y].WhiteCount--
		} else if !decr {
			m.cells[coords.X][coords.Y].WhiteCount++
		}
	} else {
		if decr && m.cells[coords.X][coords.Y].BlackCount > 0 {
			m.cells[coords.X][coords.Y].BlackCount--
		} else if !decr {
			m.cells[coords.X][coords.Y].BlackCount++
		}
	}
}

func (m *MinimapAggregator) UpdateForMoveResult(moveResult MoveResult) {
	needsUpdate := false
	if !moveResult.CapturedPiece.Piece.IsEmpty() {
		needsUpdate = true
	} else {
		for i := range moveResult.Length {
			movedPiece := moveResult.MovedPieces[i]
			fromCoords := getAggregatorCoords(movedPiece.FromX, movedPiece.FromY)
			toCoords := getAggregatorCoords(movedPiece.ToX, movedPiece.ToY)
			if fromCoords != toCoords {
				needsUpdate = true
				break
			}
		}
	}

	if !needsUpdate {
		return
	}

	m.Lock()
	defer m.Unlock()

	for i := range moveResult.Length {
		movedPiece := moveResult.MovedPieces[i]
		fromCoords := getAggregatorCoords(movedPiece.FromX, movedPiece.FromY)
		toCoords := getAggregatorCoords(movedPiece.ToX, movedPiece.ToY)
		if fromCoords != toCoords {
			m.unsafeUpdateForAggregatorCoords(fromCoords, movedPiece.Piece.IsWhite, true)
			m.unsafeUpdateForAggregatorCoords(toCoords, movedPiece.Piece.IsWhite, false)
		}
	}

	if !moveResult.CapturedPiece.Piece.IsEmpty() {
		coords := getAggregatorCoords(moveResult.CapturedPiece.X, moveResult.CapturedPiece.Y)
		m.unsafeUpdateForAggregatorCoords(coords, moveResult.CapturedPiece.Piece.IsWhite, true)
	}
}

func (m *MinimapAggregator) GetLastAggregation() json.RawMessage {
	return json.RawMessage(m.lastAggregation.Load().([]byte))
}
