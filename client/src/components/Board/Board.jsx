import React from "react";
import styled from "styled-components";
import { imageForPiece, getMoveableSquares, keyToCoords } from "../../utils";
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
  border: ${INNER_PADDING}px solid slategrey;
`;

const Canvas = styled.canvas`
  width: ${WIDTH * PIXELS_PER_SQUARE}px;
  height: ${HEIGHT * PIXELS_PER_SQUARE}px;
`;

const PieceImg = styled.img`
  width: ${PIXELS_PER_SQUARE}px;
  height: ${PIXELS_PER_SQUARE}px;
`;

const PieceButtonWrapper = styled.button`
  all: unset;
  cursor: pointer;
  pointer-events: auto;
  width: ${PIXELS_PER_SQUARE}px;
  height: ${PIXELS_PER_SQUARE}px;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(var(--x), var(--y));
  transition: transform 0.5s ease-in-out;
`;

const MoveButton = styled.button`
  all: unset;
  cursor: pointer;
  pointer-events: auto;
  width: ${PIXELS_PER_SQUARE}px;
  height: ${PIXELS_PER_SQUARE}px;
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(var(--x), var(--y));
  background-color: slateblue;
  opacity: 0.6;
`;

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

function MoveButtons({
  moveableSquares,
  coords,
  width,
  height,
  selectedPiece,
  moveAndClear,
}) {
  const { startingX, startingY } = getStartingAndEndingCoords({
    coords,
    width,
    height,
  });
  return Array.from(moveableSquares.values()).map((key) => {
    const [x, y] = keyToCoords(key);
    const { x: screenX, y: screenY } = screenRelativeCoords({
      x,
      y,
      startingX,
      startingY,
    });
    return (
      <MoveButton
        key={key}
        style={{
          "--x": `${screenX * PIXELS_PER_SQUARE}px`,
          "--y": `${screenY * PIXELS_PER_SQUARE}px`,
        }}
        onClick={() => {
          console.log(JSON.stringify(selectedPiece));
          moveAndClear({ piece: selectedPiece, toX: x, toY: y });
        }}
      />
    );
  });
}

const Piece = React.memo(
  ({ id, x, y, src, onClick, dataId, pieceX, pieceY }) => {
    return (
      <PieceButtonWrapper
        id={id}
        key={id}
        data-id={dataId}
        data-piece-x={pieceX}
        data-piece-y={pieceY}
        style={{
          "--x": `${x * PIXELS_PER_SQUARE}px`,
          "--y": `${y * PIXELS_PER_SQUARE}px`,
        }}
        onClick={onClick}
      >
        <PieceImg src={src} />
      </PieceButtonWrapper>
    );
  }
);

function AllPieces({ pieces, coords, width, height, handlePieceClick }) {
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
        dataId={piece.id}
        src={imageForPiece(piece)}
        pieceX={piece.x}
        pieceY={piece.y}
        x={x}
        y={y}
        onClick={() => {
          console.log("CLICK");
          handlePieceClick(piece);
        }}
      />
    );
  });
}

function Board({ coords, pieces, submitMove }) {
  const canvasRef = React.useRef(null);
  const [selectedPiece, setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());

  const moveAndClear = React.useCallback(
    ({ piece, toX, toY }) => {
      submitMove({ piece, toX, toY });
      setSelectedPiece(null);
      setMoveableSquares(new Set());
    },
    [submitMove]
  );

  const handlePieceClick = React.useCallback(
    (piece) => {
      setSelectedPiece(piece);
      const moveableSquares = getMoveableSquares(piece, pieces);
      console.log(
        "MOVEABLE SQUARES",
        JSON.stringify(Array.from(moveableSquares.values()))
      );
      setMoveableSquares(moveableSquares);
    },
    [pieces]
  );

  const clearMoveableSquares = React.useCallback(() => {
    setSelectedPiece(null);
    setMoveableSquares(new Set());
  }, []);

  React.useEffect(() => {
    // clear piece when escape is pressed
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        clearMoveableSquares();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [clearMoveableSquares]);

  console.log("RENDER BOARD");
  // this should be in a requestAnimationFrame loop...
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
        let color = getSquareColor(x, y);
        // if (moveableSquares.has(pieceKey(x, y))) {
        //   console.log(`match: ${x}, ${y}`);
        //   color = "slateblue";
        // }
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
  }, [coords, selectedPiece, moveableSquares]);

  return (
    <BoardContainer>
      <Inner>
        <Canvas
          width={WIDTH * PIXELS_PER_SQUARE}
          height={HEIGHT * PIXELS_PER_SQUARE}
          ref={canvasRef}
          onMouseDown={(e) => {
            console.log("MOUSE DOWN", e.target.dataset);
          }}
        ></Canvas>
        <AllPieces
          pieces={pieces}
          coords={coords}
          handlePieceClick={handlePieceClick}
          width={WIDTH}
          height={HEIGHT}
        />
        <MoveButtons
          moveableSquares={moveableSquares}
          coords={coords}
          width={WIDTH}
          height={HEIGHT}
          moveAndClear={moveAndClear}
          selectedPiece={selectedPiece}
        />
      </Inner>
    </BoardContainer>
  );
}

export default Board;
