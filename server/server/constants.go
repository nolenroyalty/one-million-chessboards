package server

import "time"

const (
	BOARD_SIZE        = 8000
	SINGLE_BOARD_SIZE = 8
	ZONE_SIZE         = 80
	ZONE_COUNT        = BOARD_SIZE / ZONE_SIZE
	TOTAL_ZONES       = ZONE_COUNT * ZONE_COUNT
	VIEW_RADIUS       = 47 // clients have a max view radius of 72x72 when zoomed out
	VIEW_DIAMETER     = VIEW_RADIUS*2 + 1
	// this lets them move up to 24 squares while maintaining snapshot validity
	RESPECT_COLOR_REQUIREMENT = true
	MOVE_BUFFER_SIZE          = 200
	CAPTURE_BUFFER_SIZE       = 100
	MINIMAP_REFRESH_INTERVAL  = time.Second * 10
	STATS_REFRESH_INTERVAL    = time.Second * 1
	CAPTURE_REFRESH_INTERVAL  = time.Second * 1
)
