import React from "react";
import CoordsContext from "../CoordsContext/CoordsContext";
import SelectedPieceAndSquaresContext from "../SelectedPieceAndSquaresContext/SelectedPieceAndSquaresContext";
import {
  keyToCoords,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  getZoomedInScreenAbsoluteCoords,
} from "../../utils";
import styled from "styled-components";
import { WebsocketContext } from "../WebsocketProvider/WebsocketProvider";

const MoveButton = styled.button`
  all: unset;
  cursor: var(--cursor);
  pointer-events: var(--pointer-events);
  width: var(--size);
  height: var(--size);
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(var(--x), var(--y));
  background-color: transparent;
  opacity: var(--opacity);
  transition: opacity 0.3s ease-in-out;
`;

function PieceMoveButtons({ boardSizeParams, hidden }) {
  const { coords } = React.useContext(CoordsContext);
  const { submitMove } = React.useContext(WebsocketContext);
  const { selectedPiece, moveableSquares, clearSelectedPiece } =
    React.useContext(SelectedPieceAndSquaresContext);
  const { startingX, startingY } = getStartingAndEndingCoords({
    coords,
    width: boardSizeParams.squareWidth,
    height: boardSizeParams.squareHeight,
  });

  return Array.from(moveableSquares.keys()).map((key) => {
    const [x, y] = keyToCoords(key);
    const { moveType, capturedPiece, additionalMovedPiece } =
      moveableSquares.get(key);
    const { x: screenX, y: screenY } = getScreenRelativeCoords({
      x,
      y,
      startingX,
      startingY,
    });
    const { x: absoluteX, y: absoluteY } = getZoomedInScreenAbsoluteCoords({
      screenX,
      screenY,
      boardSizeParams,
    });
    return (
      <MoveButton
        key={key}
        style={{
          "--x": `${absoluteX}px`,
          "--y": `${absoluteY}px`,
          "--size": `${boardSizeParams.squarePx}px`,
          "--opacity": hidden ? 0 : 1,
          "--pointer-events": hidden ? "none" : "auto",
          "--cursor": hidden ? "none" : "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation();
          submitMove({
            piece: selectedPiece,
            toX: x,
            toY: y,
            moveType,
            capturedPiece,
            additionalMovedPiece,
          });
          clearSelectedPiece();
        }}
      />
    );
  });
}

export default PieceMoveButtons;
