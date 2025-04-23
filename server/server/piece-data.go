package server

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
