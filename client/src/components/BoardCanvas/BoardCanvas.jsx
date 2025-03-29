import React from "react";
import styled from "styled-components";
import {
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  getZoomedInScreenAbsoluteCoords,
  pieceKey,
  getSquareColor,
} from "../../utils";

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  opacity: var(--opacity);
  transition: opacity 0.3s ease;
`;

// const BOARD_BORDER_COLOR = "#0a0a0a";
const BOARD_BORDER_COLOR = "#171717";
const MOVEABLE_SQUARE_COLOR = "#3b82f6";
const SELECTED_PIECE_COLOR = "#fbbf24";

function BoardCanvas({
  coords,
  pxWidth,
  pxHeight,
  zoomedInParams,
  moveableSquares,
  selectedPiece,
  opacity,
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, pxWidth, pxHeight);
    const { startingX, startingY, endingX, endingY } =
      getStartingAndEndingCoords({
        coords,
        width: zoomedInParams.squareWidth,
        height: zoomedInParams.squareHeight,
      });
    for (let x = startingX; x < endingX; x++) {
      for (let y = startingY; y < endingY; y++) {
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
          zoomedInParams,
        });
        ctx.fillStyle = color;
        ctx.fillRect(
          absoluteX,
          absoluteY,
          zoomedInParams.squarePx,
          zoomedInParams.squarePx
        );
        if (moveableSquares.has(pieceKey(x, y))) {
          ctx.save();
          ctx.fillStyle = MOVEABLE_SQUARE_COLOR;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(
            absoluteX,
            absoluteY,
            zoomedInParams.squarePx,
            zoomedInParams.squarePx
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
            zoomedInParams.squarePx,
            zoomedInParams.squarePx
          );
          ctx.restore();
        }
        if (x % 8 === 0 && x > 0) {
          // leftmost square, draw tiny line on the left side
          ctx.save();
          ctx.fillStyle = BOARD_BORDER_COLOR;
          ctx.fillRect(
            absoluteX - zoomedInParams.borderHalfWidth,
            absoluteY,
            zoomedInParams.borderHalfWidth * 2,
            zoomedInParams.squarePx
          );
          ctx.restore();
        }
        if (y % 8 === 0 && y > 0) {
          // topmost square, draw tiny line on the top side
          ctx.save();
          ctx.fillStyle = BOARD_BORDER_COLOR;
          ctx.fillRect(
            absoluteX,
            absoluteY - zoomedInParams.borderHalfWidth,
            zoomedInParams.squarePx,
            zoomedInParams.borderHalfWidth * 2
          );
          ctx.restore();
        }
      }
    }
  }, [coords, zoomedInParams, moveableSquares, selectedPiece]);

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
