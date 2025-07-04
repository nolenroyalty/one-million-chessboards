package server

import (
	"math/rand"
	"sync"
	"time"
)

const RING_BUFFER_SIZE = 20
const CAPTURE_EXPIRATION_TIME = 25 * time.Second

type PositionAndTime struct {
	Position Position
	Time     time.Time
}

type RecentCaptures struct {
	sync.RWMutex
	whiteCaptureLocations [RING_BUFFER_SIZE]PositionAndTime
	blackCaptureLocations [RING_BUFFER_SIZE]PositionAndTime
	whiteCaptureIdx       int
	blackCaptureIdx       int
	whiteLength           int
	blackLength           int
}

func NewRecentCaptures() *RecentCaptures {
	return &RecentCaptures{
		whiteCaptureLocations: [RING_BUFFER_SIZE]PositionAndTime{},
		blackCaptureLocations: [RING_BUFFER_SIZE]PositionAndTime{},
		whiteCaptureIdx:       0,
		blackCaptureIdx:       0,
		whiteLength:           0,
		blackLength:           0,
	}
}

func (s *RecentCaptures) AddCapture(captureResult *CaptureResult) {
	s.Lock()
	defer s.Unlock()

	position := Position{X: captureResult.X, Y: captureResult.Y}
	now := time.Now()
	positionAndTime := PositionAndTime{Position: position, Time: now}
	if captureResult.Piece.IsWhite {
		s.whiteCaptureLocations[s.whiteCaptureIdx] = positionAndTime
		s.whiteCaptureIdx = (s.whiteCaptureIdx + 1) % RING_BUFFER_SIZE
		if s.whiteLength < RING_BUFFER_SIZE {
			s.whiteLength++
		}
	} else {
		s.blackCaptureLocations[s.blackCaptureIdx] = positionAndTime
		s.blackCaptureIdx = (s.blackCaptureIdx + 1) % RING_BUFFER_SIZE
		if s.blackLength < RING_BUFFER_SIZE {
			s.blackLength++
		}
	}
}

func (s *RecentCaptures) getRecentCapturesByColor(white bool) []Position {
	s.RLock()
	defer s.RUnlock()
	length := s.blackLength
	targetBuffer := s.blackCaptureLocations
	if white {
		length = s.whiteLength
		targetBuffer = s.whiteCaptureLocations
	}

	now := time.Now()
	ret := []Position{}
	for i := 0; i < length; i++ {
		if now.Sub(targetBuffer[i].Time) <= CAPTURE_EXPIRATION_TIME {
			ret = append(ret, targetBuffer[i].Position)
		}
	}
	return ret
}

// Random capture not filtered by time
// Just a nice way to seed players if there's no active player to pin them to
func (s *RecentCaptures) RandomCapture(playingWhite bool) (pos Position, found bool) {
	s.RLock()
	defer s.RUnlock()

	length := s.blackLength
	targetBuffer := s.blackCaptureLocations
	if playingWhite {
		length = s.whiteLength
		targetBuffer = s.whiteCaptureLocations
	}
	if length > 0 {
		found = true
		idx := rand.Intn(int(length))
		pos = targetBuffer[idx].Position
	} else {
		found = false
	}
	return
}

type RecentCapturesResult struct {
	WhiteCaptures []Position
	BlackCaptures []Position
}

func (s *RecentCaptures) GetRecentCaptures() RecentCapturesResult {
	return RecentCapturesResult{
		WhiteCaptures: s.getRecentCapturesByColor(true),
		BlackCaptures: s.getRecentCapturesByColor(false),
	}
}
