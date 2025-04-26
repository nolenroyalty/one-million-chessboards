package server

import "strings"

type OnlyColor int

const (
	OnlyColorWhite OnlyColor = iota
	OnlyColorBlack
	OnlyColorEither
)

func OnlyColorFromString(s string) OnlyColor {
	if strings.ToLower(s) == "white" {
		return OnlyColorWhite
	} else if strings.ToLower(s) == "black" {
		return OnlyColorBlack
	}
	return OnlyColorEither
}

type adoptionRequest struct {
	BoardX uint16
	BoardY uint16
	Color  OnlyColor
}

func NewAdoptionRequest(xcoord uint16, ycoord uint16, onlyColor OnlyColor) *adoptionRequest {
	return &adoptionRequest{
		BoardX: xcoord / SINGLE_BOARD_SIZE,
		BoardY: ycoord / SINGLE_BOARD_SIZE,
		Color:  onlyColor,
	}
}

func (r *adoptionRequest) StartingX() uint16 {
	return r.BoardX * SINGLE_BOARD_SIZE
}

func (r *adoptionRequest) StartingY() uint16 {
	return r.BoardY * SINGLE_BOARD_SIZE
}

func (r *adoptionRequest) EndingX() uint16 {
	return r.StartingX() + SINGLE_BOARD_SIZE
}

func (r *adoptionRequest) EndingY() uint16 {
	return r.StartingY() + SINGLE_BOARD_SIZE
}

func (r *adoptionRequest) OnlyColor() OnlyColor {
	return r.Color
}
