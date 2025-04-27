package server

import "fmt"

type bulkCaptureRequest struct {
	BoardX uint16
	BoardY uint16
	Color  OnlyColor
}

func NewBulkCaptureRequest(xcoord uint16, ycoord uint16, onlyColor OnlyColor) *bulkCaptureRequest {
	return &bulkCaptureRequest{
		BoardX: xcoord / SINGLE_BOARD_SIZE,
		BoardY: ycoord / SINGLE_BOARD_SIZE,
		Color:  onlyColor,
	}
}

func (r *bulkCaptureRequest) StartingX() uint16 {
	return r.BoardX * SINGLE_BOARD_SIZE
}

func (r *bulkCaptureRequest) StartingY() uint16 {
	return r.BoardY * SINGLE_BOARD_SIZE
}

func (r *bulkCaptureRequest) EndingX() uint16 {
	return r.StartingX() + SINGLE_BOARD_SIZE
}

func (r *bulkCaptureRequest) EndingY() uint16 {
	return r.StartingY() + SINGLE_BOARD_SIZE
}

func (r *bulkCaptureRequest) OnlyColor() OnlyColor {
	return r.Color
}

func (r *bulkCaptureRequest) ToString() string {
	x1, y1 := r.StartingX(), r.StartingY()
	x2, y2 := r.EndingX(), r.EndingY()
	return fmt.Sprintf("BC: [%d, %d] -> [%d, %d]", x1, y1, x2, y2)
}
