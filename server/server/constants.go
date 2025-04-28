package server

import (
	"sync"
	"time"

	"github.com/klauspost/compress/zstd"
)

// nroyalty: I'm pretty tired, but I *think* it is just safe to say that
// zone size can be 50. We consider everything in the client's current zone,
// plus the zone to their left and right (and up and down, etc). Given that,
// we should always be including every move in the client's snapshot window.
//
// We could probably even shrink zone count to 40 and still get away with things
// to be honest.
//
// In fact, I think we clearly can. If we ignore the client's current zone (because
// they're on the far left or right, etc) we still will have a 40 square buffer
// and their max half view radius is 35 or 36 depending on how you count.
//
// if we get weird reports of missing moves we can investigate further?
//
// Thinking about this the next morning, while we can clearly stick to 40x40 zones
// and never not send a move based on where the client is currently looking, if
// the client is on the edge of a zone the snapshot that they receive will exceed
// past their zone (they get a snapshot of pieces on the far side but don't see
// if they move)
//
// Maybe we set this to 50 and then like...add a check inside the client that
// decides whether they should actually forward the move on. This seems reasonable.

const (
	BOARD_SIZE                  = 8000
	SINGLE_BOARD_SIZE           = 8
	ZONE_SIZE                   = 50
	ZONE_COUNT                  = BOARD_SIZE / ZONE_SIZE
	TOTAL_ZONES                 = ZONE_COUNT * ZONE_COUNT
	VIEW_RADIUS                 = 47
	MAX_CLIENT_HALF_VIEW_RADIUS = 35 // clients have a max view radius of 70x70 when zoomed out
	VIEW_DIAMETER               = VIEW_RADIUS*2 + 1
	RESPECT_COLOR_REQUIREMENT   = true
	MOVE_BUFFER_SIZE            = 400
	CAPTURE_BUFFER_SIZE         = 400
	MINIMAP_REFRESH_INTERVAL    = time.Second * 10
	STATS_REFRESH_INTERVAL      = time.Second * 1
	CAPTURE_REFRESH_INTERVAL    = time.Second * 1
	TOTAL_KINGS_PER_SIDE        = 1000000
)

var GLOBAL_zstdPool = sync.Pool{
	New: func() any {
		enc, _ := zstd.NewWriter(
			nil,
			zstd.WithEncoderLevel(zstd.SpeedFastest),
			zstd.WithEncoderConcurrency(1),
		)
		return enc
	},
}
