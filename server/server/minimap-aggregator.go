package server

// CR nroyalty: swap this out - no channels, single goroutine with a pointer swap,
// maybe a mutex, and just raw reads to the cached data
// when you do this, consider where else you need to do it.

import (
	"encoding/json"
	"log"
)

const CELL_SIZE = 5
const NUMBER_OF_CELLS = 1000 / CELL_SIZE

type MinimapCell struct {
	WhiteCount uint16
	BlackCount uint16
}

type minimapMoveUpdate struct {
	FromX uint16
	FromY uint16
	ToX   uint16
	ToY   uint16
	Piece Piece
}

type minimapCaptureUpdate struct {
	X     uint16
	Y     uint16
	Piece Piece
}

type SingleAggregation struct {
	WhiteAhead bool   `json:"whiteAhead"`
	Amount     uint16 `json:"amount"`
}

type AggregationResponse struct {
	Type         string                                               `json:"type"`
	Aggregations [NUMBER_OF_CELLS * NUMBER_OF_CELLS]SingleAggregation `json:"aggregations"`
}

type AggregationRequest struct {
	Response chan json.RawMessage
}

type CachedAggregationRequest struct {
	Response chan json.RawMessage
}

type MinimapAggregator struct {
	cells                     [NUMBER_OF_CELLS][NUMBER_OF_CELLS]MinimapCell
	moveUpdates               chan minimapMoveUpdate
	captureUpdates            chan minimapCaptureUpdate
	aggregationRequests       chan AggregationRequest
	cachedAggregationRequests chan CachedAggregationRequest
	lastAggregation           json.RawMessage
}

func NewMinimapAggregator() *MinimapAggregator {
	return &MinimapAggregator{
		moveUpdates:               make(chan minimapMoveUpdate, 1024),
		captureUpdates:            make(chan minimapCaptureUpdate, 1024),
		aggregationRequests:       make(chan AggregationRequest, 1024),
		cachedAggregationRequests: make(chan CachedAggregationRequest, 1024),
		lastAggregation:           json.RawMessage{},
	}
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
	for i := 0; i < NUMBER_OF_CELLS; i++ {
		for j := 0; j < NUMBER_OF_CELLS; j++ {
			m.cells[i][j] = MinimapCell{}
		}
	}

	for i := 0; i < BOARD_SIZE; i++ {
		for j := 0; j < BOARD_SIZE; j++ {
			piece := board.GetPiece(uint16(i), uint16(j))
			if piece == nil {
				continue
			}
			coords := getAggregatorCoords(uint16(i), uint16(j))
			if piece.IsWhite {
				m.cells[coords.X][coords.Y].WhiteCount++
			} else {
				m.cells[coords.X][coords.Y].BlackCount++
			}
		}
	}
	// just make sure we always have an initial aggregation
	aggregationRequest := AggregationRequest{Response: make(chan json.RawMessage, 1)}
	m.handleAggregationRequest(aggregationRequest)
	m.lastAggregation = <-aggregationRequest.Response
}

func (m *MinimapAggregator) updateForAggregatorCoords(coords AggregatorCoords, isWhite bool, decr bool) {
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

func (m *MinimapAggregator) processMoveUpdate(moveUpdate minimapMoveUpdate) {
	fromCoords := getAggregatorCoords(moveUpdate.FromX, moveUpdate.FromY)
	toCoords := getAggregatorCoords(moveUpdate.ToX, moveUpdate.ToY)
	if fromCoords != toCoords {
		m.updateForAggregatorCoords(fromCoords, moveUpdate.Piece.IsWhite, true)
		m.updateForAggregatorCoords(toCoords, moveUpdate.Piece.IsWhite, false)
	}
}

func (m *MinimapAggregator) processCaptureUpdate(captureUpdate minimapCaptureUpdate) {
	coords := getAggregatorCoords(captureUpdate.X, captureUpdate.Y)
	m.updateForAggregatorCoords(coords, captureUpdate.Piece.IsWhite, true)
}

func (m *MinimapAggregator) handleAggregationRequest(request AggregationRequest) {
	response := AggregationResponse{
		Type: "minimapUpdate",
	}
	for i := 0; i < NUMBER_OF_CELLS*NUMBER_OF_CELLS; i++ {
		response.Aggregations[i] = SingleAggregation{}
		x := i % NUMBER_OF_CELLS
		y := i / NUMBER_OF_CELLS
		whiteCount := m.cells[x][y].WhiteCount
		blackCount := m.cells[x][y].BlackCount
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

		response.Aggregations[i] = SingleAggregation{
			WhiteAhead: whiteCount > blackCount,
			Amount:     uint16(amount),
		}
	}
	jsonResponse, err := json.Marshal(response)
	if err != nil {
		log.Printf("Error marshalling aggregation response: %v", err)
		request.Response <- nil
		return
	}
	m.lastAggregation = jsonResponse
	request.Response <- jsonResponse
}

func (m *MinimapAggregator) Run() {
	for {
		select {
		case request := <-m.aggregationRequests:
			m.handleAggregationRequest(request)
		case moveUpdate := <-m.moveUpdates:
			m.processMoveUpdate(moveUpdate)
		case captureUpdate := <-m.captureUpdates:
			m.processCaptureUpdate(captureUpdate)
		case request := <-m.cachedAggregationRequests:
			m.handleCachedAggregationRequest(request)
		}
	}
}

func (m *MinimapAggregator) RequestAggregation() <-chan json.RawMessage {
	response := make(chan json.RawMessage, 1)
	m.aggregationRequests <- AggregationRequest{Response: response}
	return response
}

func (m *MinimapAggregator) UpdateForMove(fromX uint16, fromY uint16, toX uint16, toY uint16, piece Piece) {
	m.moveUpdates <- minimapMoveUpdate{FromX: fromX, FromY: fromY, ToX: toX, ToY: toY, Piece: piece}
}

func (m *MinimapAggregator) UpdateForCapture(x uint16, y uint16, piece Piece) {
	m.captureUpdates <- minimapCaptureUpdate{X: x, Y: y, Piece: piece}
}

func (m *MinimapAggregator) GetCachedAggregation() json.RawMessage {
	response := make(chan json.RawMessage, 1)
	m.cachedAggregationRequests <- CachedAggregationRequest{Response: response}
	return <-response
}

func (m *MinimapAggregator) handleCachedAggregationRequest(request CachedAggregationRequest) {
	request.Response <- m.lastAggregation
}
