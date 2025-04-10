package server

const (
	BOARD_SIZE  = 8000
	ZONE_SIZE   = 80
	ZONE_COUNT  = BOARD_SIZE / ZONE_SIZE
	TOTAL_ZONES = ZONE_COUNT * ZONE_COUNT
	VIEW_RADIUS = 47 // clients have a max view radius of 72x72 when zoomed out
	// this lets them move up to 24 squares while maintaining snapshot validity
)
