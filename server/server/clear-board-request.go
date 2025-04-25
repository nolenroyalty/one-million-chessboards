package server

type clearBoardRequest struct {
	boardX    uint16
	boardY    uint16
	onlyColor OnlyColor
}

func NewClearBoardRequest(xcoord uint16, ycoord uint16, onlyColor OnlyColor) *clearBoardRequest {
	return &clearBoardRequest{
		boardX:    xcoord / SINGLE_BOARD_SIZE,
		boardY:    ycoord / SINGLE_BOARD_SIZE,
		onlyColor: onlyColor,
	}
}

func (r *clearBoardRequest) StartingX() uint16 {
	return r.boardX * SINGLE_BOARD_SIZE
}

func (r *clearBoardRequest) StartingY() uint16 {
	return r.boardY * SINGLE_BOARD_SIZE
}

func (r *clearBoardRequest) EndingX() uint16 {
	return r.StartingX() + SINGLE_BOARD_SIZE
}

func (r *clearBoardRequest) EndingY() uint16 {
	return r.StartingY() + SINGLE_BOARD_SIZE
}

func (r *clearBoardRequest) OnlyColor() OnlyColor {
	return r.onlyColor
}
