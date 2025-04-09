package server

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

type MovesAndMaybeCapture struct {
	Moves   []PieceMove
	Capture *PieceCapture
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
	moveUpdates               chan MovesAndMaybeCapture
	aggregationRequests       chan AggregationRequest
	cachedAggregationRequests chan CachedAggregationRequest
	lastAggregation           json.RawMessage
}

func NewMinimapAggregator() *MinimapAggregator {
	return &MinimapAggregator{
		moveUpdates:               make(chan MovesAndMaybeCapture, 1024),
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

func (m *MinimapAggregator) processMoveUpdate(moves []PieceMove, capture *PieceCapture) {
	if len(moves) == 0 {
		return
	}
	for _, pieceMove := range moves {
		fromCoords := getAggregatorCoords(pieceMove.FromX, pieceMove.FromY)
		toCoords := getAggregatorCoords(pieceMove.ToX, pieceMove.ToY)
		if fromCoords != toCoords {
			m.updateForAggregatorCoords(fromCoords, pieceMove.IsWhite, true)
			m.updateForAggregatorCoords(toCoords, pieceMove.IsWhite, false)
		}
	}
	if capture != nil {
		captureCoords := getAggregatorCoords(capture.X, capture.Y)
		m.updateForAggregatorCoords(captureCoords, capture.WasWhite, true)
	}
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
			m.processMoveUpdate(moveUpdate.Moves, moveUpdate.Capture)
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

func (m *MinimapAggregator) UpdateForMove(moves []PieceMove, capture *PieceCapture) {
	m.moveUpdates <- MovesAndMaybeCapture{Moves: moves, Capture: capture}
}

func (m *MinimapAggregator) GetCachedAggregation() json.RawMessage {
	response := make(chan json.RawMessage, 1)
	m.cachedAggregationRequests <- CachedAggregationRequest{Response: response}
	return <-response
}

func (m *MinimapAggregator) handleCachedAggregationRequest(request CachedAggregationRequest) {
	request.Response <- m.lastAggregation
}
