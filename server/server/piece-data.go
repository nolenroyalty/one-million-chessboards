package server

// For snapshots, we use dx and dy instead of a full uint16 x and y because we already
// have an anchor coordinate for the snapshot, so we can save 2 bytes per piece
// by just using an offset
type PieceDataForSnapshot struct {
	ID              uint32    `json:"id"`
	Dx              int8      `json:"dx"`
	Dy              int8      `json:"dy"`
	Type            PieceType `json:"type"`
	JustDoubleMoved bool      `json:"justDoubleMoved"`
	IsWhite         bool      `json:"isWhite"`
	MoveCount       uint8     `json:"moveCount"`
	CaptureCount    uint8     `json:"captureCount"`
}

// Using dx/dy for moves is a pain in the ass because we need to know the actual
// X and Y for the move, then use the client's current position to back out
// the dx/dy that we'd pass on. This requires an extra loop and some copying,
// which I think means it's not worth it.
//
// You could imagine doing all of this by only passing moved piece IDs to
// the client goroutine and then having it do a lookup on those IDs when it
// processes the move, but I think that probably adds too much read contention
// to be worth it.
//
// If this ends up being a problem we can consider some clever tricks to work around
// the copying problem and save 2 bytes per move, but I suspect it's not worth it.
type PieceDataForMove struct {
	ID              uint32    `json:"id"`
	X               uint16    `json:"x"`
	Y               uint16    `json:"y"`
	Type            PieceType `json:"type"`
	JustDoubleMoved bool      `json:"justDoubleMoved"`
	IsWhite         bool      `json:"isWhite"`
	MoveCount       uint8     `json:"moveCount"`
	CaptureCount    uint8     `json:"captureCount"`
}
