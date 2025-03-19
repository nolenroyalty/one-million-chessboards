import React from "react";
import styled from "styled-components";
import {
  imageForPiece,
  getMoveableSquares,
  keyToCoords,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
} from "../../utils";
import Panzoom from "@panzoom/panzoom";
import BoardCanvas from "../BoardCanvas/BoardCanvas";

const BoardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const WIDTH = 23;
const HEIGHT = 23;

const PIXELS_PER_SQUARE = 24;

const INNER_PADDING = 4;

const Inner = styled.div`
  width: ${WIDTH * PIXELS_PER_SQUARE + INNER_PADDING * 2}px;
  height: ${HEIGHT * PIXELS_PER_SQUARE + INNER_PADDING * 2}px;
  position: relative;
  border: ${INNER_PADDING}px solid slategrey;
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
  /* transition: transform 0.5s ease-in-out; */
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
  background-color: transparent;
  /* background-color: slateblue; */
  /* opacity: 0.6; */
`;

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
    const { x: screenX, y: screenY } = getScreenRelativeCoords({
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
    const { x, y } = getScreenRelativeCoords({
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
          handlePieceClick(piece);
        }}
      />
    );
  });
}

function Board({ coords, pieces, submitMove, setCoords }) {
  const [selectedPiece, setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());
  const innerRef = React.useRef(null);

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

  const lastPanzoom = React.useRef({ lastX: 0, lastY: 0, accX: 0, accY: 0 });
  React.useEffect(() => {
    const panzoom = Panzoom(innerRef.current, {
      setTransform: (e, { scale, x, y }) => {},
      disablePan: false,
      disableZoom: false,
    });

    innerRef.current.addEventListener("panzoomstart", (e) => {
      console.log("panzoomstart");
      lastPanzoom.current = {
        ...lastPanzoom.current,
        lastX: e.detail.x,
        lastY: e.detail.y,
        accX: 0,
        accY: 0,
        firstXMove: true,
        firstYMove: true,
        lastPanTime: null,
      };
    });

    innerRef.current.addEventListener("panzoomend", (e) => {
      console.log("panzoomend");
    });

    innerRef.current.addEventListener("panzoompan", (e) => {
      const panzoomDX = e.detail.x - lastPanzoom.current.lastX;
      const panzoomDY = e.detail.y - lastPanzoom.current.lastY;
      lastPanzoom.current.accX += panzoomDX;
      lastPanzoom.current.accY += panzoomDY;
      if (lastPanzoom.current.lastPanTime === null) {
        // nothing
      } else if (performance.now() - lastPanzoom.current.lastPanTime > 600) {
        lastPanzoom.current.firstXMove = true;
        lastPanzoom.current.firstYMove = true;
        lastPanzoom.current.accX = 0;
        lastPanzoom.current.accY = 0;
      }
      lastPanzoom.current.lastPanTime = performance.now();

      let dx = 0;
      let dy = 0;
      let baseStep = 24;
      const dStep = 1;
      const xMult = lastPanzoom.current.firstXMove ? 1 : 2;
      const yMult = lastPanzoom.current.firstYMove ? 1 : 2;

      while (lastPanzoom.current.accX > baseStep * xMult) {
        dx -= dStep * xMult;
        lastPanzoom.current.accX -= baseStep * xMult;
        lastPanzoom.current.firstXMove = false;
        console.log(`baseStep: ${baseStep}`);
      }
      while (lastPanzoom.current.accX < -baseStep * xMult) {
        dx += dStep * xMult;
        lastPanzoom.current.accX += baseStep * xMult;
        lastPanzoom.current.firstXMove = false;
      }
      while (lastPanzoom.current.accY > baseStep * yMult) {
        dy -= dStep * yMult;
        lastPanzoom.current.accY -= baseStep * yMult;
        lastPanzoom.current.firstYMove = false;
      }
      while (lastPanzoom.current.accY < -baseStep * yMult) {
        dy += dStep * yMult;
        lastPanzoom.current.accY += baseStep * yMult;
        lastPanzoom.current.firstYMove = false;
      }
      if (dx !== 0 || dy !== 0) {
        // CR nroyalty: make sure not to pan off the edge!!!
        setCoords((coords) => ({
          x: coords.x + dx,
          y: coords.y + dy,
        }));
      }

      lastPanzoom.current = {
        ...lastPanzoom.current,
        lastX: e.detail.x,
        lastY: e.detail.y,
      };
    });

    innerRef.current.addEventListener("panzoomzoom", (e) => {});

    function handleKeyDown(e) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        console.log("arrow up");
        setCoords((coords) => ({
          x: coords.x,
          y: coords.y - 2,
        }));
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x,
          y: coords.y + 2,
        }));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x - 2,
          y: coords.y,
        }));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x + 2,
          y: coords.y,
        }));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      panzoom.destroy();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setCoords]);

  return (
    <BoardContainer>
      <Inner ref={innerRef}>
        <BoardCanvas
          coords={coords}
          width={WIDTH}
          height={HEIGHT}
          pixelsPerSquare={PIXELS_PER_SQUARE}
          moveableSquares={moveableSquares}
        />
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
