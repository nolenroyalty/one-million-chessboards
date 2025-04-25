package server

type bulkCaptureRequest struct {
	boardX    uint16
	boardY    uint16
	onlyColor OnlyColor
}

func NewBulkCaptureRequest(xcoord uint16, ycoord uint16, onlyColor OnlyColor) *bulkCaptureRequest {
	return &bulkCaptureRequest{
		boardX:    xcoord / SINGLE_BOARD_SIZE,
		boardY:    ycoord / SINGLE_BOARD_SIZE,
		onlyColor: onlyColor,
	}
}

func (r *bulkCaptureRequest) StartingX() uint16 {
	return r.boardX * SINGLE_BOARD_SIZE
}

func (r *bulkCaptureRequest) StartingY() uint16 {
	return r.boardY * SINGLE_BOARD_SIZE
}

func (r *bulkCaptureRequest) EndingX() uint16 {
	return r.StartingX() + SINGLE_BOARD_SIZE
}

func (r *bulkCaptureRequest) EndingY() uint16 {
	return r.StartingY() + SINGLE_BOARD_SIZE
}

func (r *bulkCaptureRequest) OnlyColor() OnlyColor {
	return r.onlyColor
}
