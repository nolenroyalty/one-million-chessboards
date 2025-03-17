import React from "react";
import styled from "styled-components";

const BoardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const WIDTH = 23;
const HEIGHT = 23;

const PIXELS_PER_SQUARE = 24;
const BOARD_BORDER_HALF_WIDTH = 2;
const INNER_PADDING = 4;
const BOARD_BORDER_COLOR = "black";

const Inner = styled.div`
  width: ${WIDTH * PIXELS_PER_SQUARE + INNER_PADDING * 2}px;
  height: ${HEIGHT * PIXELS_PER_SQUARE + INNER_PADDING * 2}px;
  position: relative;
  border: ${INNER_PADDING}px solid slateblue;
`;

const Canvas = styled.canvas`
  width: ${WIDTH * PIXELS_PER_SQUARE}px;
  height: ${HEIGHT * PIXELS_PER_SQUARE}px;
`;

const PieceImg = styled.img`
  width: ${PIXELS_PER_SQUARE}px;
  height: ${PIXELS_PER_SQUARE}px;
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(var(--x), var(--y));
  transition: transform 0.5s ease-in-out;
`;

function imageForPiece(piece) {
  const isWhite = piece.isWhite;
  let name;
  if (piece.type === 0) {
    name = "pawn";
  } else if (piece.type === 1) {
    name = "knight";
  } else if (piece.type === 2) {
    name = "bishop";
  } else if (piece.type === 3) {
    name = "rook";
  } else if (piece.type === 4) {
    name = "queen";
  } else if (piece.type === 5) {
    name = "king";
  }
  return `/pieces/${isWhite ? "white" : "black"}/${name}.png`;
}

function getStartingAndEndingCoords({ coords, width, height }) {
  if (width % 2 === 0 || height % 2 === 0) {
    throw new Error(
      `We're lazy so width and height must be odd. width: ${width}, height: ${height}`
    );
  }
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  const startingX = coords.x - halfWidth;
  const startingY = coords.y - halfHeight;
  const endingX = coords.x + halfWidth;
  const endingY = coords.y + halfHeight;
  return { startingX, startingY, endingX, endingY };
}

function getSquareColor(x, y) {
  if (x % 2 === 0) {
    return y % 2 === 0 ? "#eeeed2" : "#6f8d51";
  }
  return y % 2 === 0 ? "#6f8d51" : "#eeeed2";
}

function screenRelativeCoords({ x, y, startingX, startingY }) {
  return {
    x: x - startingX,
    y: y - startingY,
  };
}

const Piece = React.memo(({ id, x, y, src }) => {
  return (
    <PieceImg
      id={id}
      key={id}
      src={src}
      style={{
        "--x": `${x * PIXELS_PER_SQUARE}px`,
        "--y": `${y * PIXELS_PER_SQUARE}px`,
      }}
    />
  );
});

function AllPieces({ pieces, coords, width, height }) {
  const { startingX, startingY, endingX, endingY } = getStartingAndEndingCoords(
    {
      coords,
      width,
      height,
    }
  );
  return Array.from(pieces.values()).map((piece) => {
    if (
      piece.x < startingX ||
      piece.x > endingX ||
      piece.y < startingY ||
      piece.y > endingY
    ) {
      return null;
    }
    const { x, y } = screenRelativeCoords({
      x: piece.x,
      y: piece.y,
      startingX,
      startingY,
    });
    return (
      <Piece
        key={piece.id}
        data-id={piece.id}
        src={imageForPiece(piece)}
        x={x}
        y={y}
      />
    );
  });
}

function Board({ coords, pieces }) {
  const canvasRef = React.useRef(null);
  console.log("RENDER BOARD");
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { startingX, startingY, endingX, endingY } =
      getStartingAndEndingCoords({
        coords,
        width: WIDTH,
        height: HEIGHT,
      });
    for (let x = startingX; x <= endingX; x++) {
      for (let y = startingY; y <= endingY; y++) {
        const color = getSquareColor(x, y);
        const { x: screenX, y: screenY } = screenRelativeCoords({
          x,
          y,
          startingX,
          startingY,
        });
        ctx.fillStyle = color;
        ctx.fillRect(
          screenX * PIXELS_PER_SQUARE,
          screenY * PIXELS_PER_SQUARE,
          PIXELS_PER_SQUARE,
          PIXELS_PER_SQUARE
        );
        if (x % 8 === 0 && x > 0) {
          // leftmost square, draw tiny line on the left side
          ctx.save();
          ctx.fillStyle = BOARD_BORDER_COLOR;
          ctx.globalAlpha = 0.8;
          ctx.fillRect(
            screenX * PIXELS_PER_SQUARE - BOARD_BORDER_HALF_WIDTH,
            screenY * PIXELS_PER_SQUARE,
            BOARD_BORDER_HALF_WIDTH * 2,
            PIXELS_PER_SQUARE
          );
          ctx.restore();
        }
        if (y % 8 === 0 && y > 0) {
          // topmost square, draw tiny line on the top side
          ctx.save();
          ctx.fillStyle = BOARD_BORDER_COLOR;
          ctx.globalAlpha = 0.8;
          ctx.fillRect(
            screenX * PIXELS_PER_SQUARE,
            screenY * PIXELS_PER_SQUARE - BOARD_BORDER_HALF_WIDTH,
            PIXELS_PER_SQUARE,
            BOARD_BORDER_HALF_WIDTH * 2
          );
          ctx.restore();
        }
      }
    }
  }, [coords]);

  return (
    <BoardContainer>
      <Inner>
        <Canvas
          width={WIDTH * PIXELS_PER_SQUARE}
          height={HEIGHT * PIXELS_PER_SQUARE}
          ref={canvasRef}
        ></Canvas>
        <AllPieces
          pieces={pieces}
          coords={coords}
          width={WIDTH}
          height={HEIGHT}
        />
      </Inner>
    </BoardContainer>
  );
}

export default Board;
