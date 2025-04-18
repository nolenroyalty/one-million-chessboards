import React from "react";
import styled from "styled-components";
import CoordsContext from "../CoordsContext/CoordsContext";
import {
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  getZoomedInScreenAbsoluteCoords,
  pieceKey,
  getSquareColor,
} from "../../utils";
import SelectedPieceAndSquaresContext from "../SelectedPieceAndSquaresContext/SelectedPieceAndSquaresContext";
const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  opacity: var(--opacity);
  transition: opacity 0.3s ease;
  width: 100%;
  height: 100%;
`;

const BOARD_BACKGROUND_COLOR = "#0a0a0a";
// const BOARD_BACKGROUND_COLOR = "transparent";
const BOARD_BORDER_COLOR = "#171717";
const MOVEABLE_SQUARE_COLOR = "#3b82f6";
const SELECTED_PIECE_COLOR = "#fbbf24";

function BoardCanvas({ pxWidth, pxHeight, boardSizeParams, opacity }) {
  const ref = React.useRef(null);
  const { coords } = React.useContext(CoordsContext);
  const { moveableSquares, selectedPiece } = React.useContext(
    SelectedPieceAndSquaresContext
  );
  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, pxWidth, pxHeight);
    ctx.save();
    ctx.fillStyle = BOARD_BACKGROUND_COLOR;
    ctx.fillRect(0, 0, pxWidth, pxHeight);
    ctx.restore();
    const { startingX, startingY, endingX, endingY } =
      getStartingAndEndingCoords({
        coords,
        width: boardSizeParams.squareWidth,
        height: boardSizeParams.squareHeight,
      });
    for (let x = startingX; x < endingX; x++) {
      if (x < 0 || x >= 8000) {
        continue;
      }
      for (let y = startingY; y < endingY; y++) {
        if (y < 0 || y >= 8000) {
          continue;
        }
        let color = getSquareColor(x, y);
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
        ctx.fillStyle = color;
        ctx.fillRect(
          absoluteX,
          absoluteY,
          boardSizeParams.squarePx,
          boardSizeParams.squarePx
        );
        if (moveableSquares.has(pieceKey(x, y))) {
          ctx.save();
          ctx.fillStyle = MOVEABLE_SQUARE_COLOR;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(
            absoluteX,
            absoluteY,
            boardSizeParams.squarePx,
            boardSizeParams.squarePx
          );
          ctx.restore();
        } else if (
          selectedPiece &&
          selectedPiece.x === x &&
          selectedPiece.y === y
        ) {
          ctx.save();
          ctx.fillStyle = SELECTED_PIECE_COLOR;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(
            absoluteX,
            absoluteY,
            boardSizeParams.squarePx,
            boardSizeParams.squarePx
          );
          ctx.restore();
        }
        if (x % 8 === 0 && x > 0) {
          // leftmost square, draw tiny line on the left side
          ctx.save();
          ctx.fillStyle = BOARD_BORDER_COLOR;
          ctx.fillRect(
            absoluteX - boardSizeParams.borderHalfWidth,
            absoluteY,
            boardSizeParams.borderHalfWidth * 2,
            boardSizeParams.squarePx
          );
          ctx.restore();
        }
        if (y % 8 === 0 && y > 0) {
          // topmost square, draw tiny line on the top side
          ctx.save();
          ctx.fillStyle = BOARD_BORDER_COLOR;
          ctx.fillRect(
            absoluteX,
            absoluteY - boardSizeParams.borderHalfWidth,
            boardSizeParams.squarePx,
            boardSizeParams.borderHalfWidth * 2
          );
          ctx.restore();
        }
      }
    }
  }, [
    coords,
    boardSizeParams,
    moveableSquares,
    selectedPiece,
    pxWidth,
    pxHeight,
  ]);

  return (
    <Canvas
      width={pxWidth}
      height={pxHeight}
      ref={ref}
      style={{ "--opacity": opacity }}
    />
  );
}

export default BoardCanvas;
