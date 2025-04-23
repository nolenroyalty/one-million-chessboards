package server

import "time"

const (
	BOARD_SIZE                  = 8000
	SINGLE_BOARD_SIZE           = 8
	ZONE_SIZE                   = 80
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
)
