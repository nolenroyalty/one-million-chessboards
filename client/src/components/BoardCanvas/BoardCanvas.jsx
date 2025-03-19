import React from "react";
import styled from "styled-components";
import {
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
} from "../../utils";

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
`;

const BOARD_BORDER_COLOR = "black";
const BOARD_BORDER_HALF_WIDTH = 2;

function getSquareColor(x, y) {
  if (x % 2 === 0) {
    return y % 2 === 0 ? "#eeeed2" : "#6f8d51";
  }
  return y % 2 === 0 ? "#6f8d51" : "#eeeed2";
}

function BoardCanvas({ coords, width, height, pixelsPerSquare }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) {
      return;
    }
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const { startingX, startingY, endingX, endingY } =
      getStartingAndEndingCoords({
        coords,
        width,
        height,
      });
    for (let x = startingX; x <= endingX; x++) {
      for (let y = startingY; y <= endingY; y++) {
        let color = getSquareColor(x, y);
        // if (moveableSquares.has(pieceKey(x, y))) {
        //   console.log(`match: ${x}, ${y}`);
        //   color = "slateblue";
        // }
        const { x: screenX, y: screenY } = getScreenRelativeCoords({
          x,
          y,
          startingX,
          startingY,
        });
        ctx.fillStyle = color;
        ctx.fillRect(
          screenX * pixelsPerSquare,
          screenY * pixelsPerSquare,
          pixelsPerSquare,
          pixelsPerSquare
        );
        if (x % 8 === 0 && x > 0) {
          // leftmost square, draw tiny line on the left side
          ctx.save();
          ctx.fillStyle = BOARD_BORDER_COLOR;
          ctx.fillRect(
            screenX * pixelsPerSquare - BOARD_BORDER_HALF_WIDTH,
            screenY * pixelsPerSquare,
            BOARD_BORDER_HALF_WIDTH * 2,
            pixelsPerSquare
          );
          ctx.restore();
        }
        if (y % 8 === 0 && y > 0) {
          // topmost square, draw tiny line on the top side
          ctx.save();
          ctx.fillStyle = BOARD_BORDER_COLOR;
          ctx.fillRect(
            screenX * pixelsPerSquare,
            screenY * pixelsPerSquare - BOARD_BORDER_HALF_WIDTH,
            pixelsPerSquare,
            BOARD_BORDER_HALF_WIDTH * 2
          );
          ctx.restore();
        }
      }
    }
  }, [coords, width, height, pixelsPerSquare]);
  return (
    <Canvas
      width={width * pixelsPerSquare}
      height={height * pixelsPerSquare}
      ref={ref}
    />
  );
}

export default BoardCanvas;
