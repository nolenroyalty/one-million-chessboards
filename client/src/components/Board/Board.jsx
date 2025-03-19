import React from "react";
import styled from "styled-components";
import Panzoom from "@panzoom/panzoom";
import BoardCanvas from "../BoardCanvas/BoardCanvas";
import PieceDisplay from "../PieceDisplay/PieceDisplay";
import PieceMoveButtons from "../PieceMoveButtons/PieceMoveButtons";
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
  overflow: hidden;
`;

const PanzoomBox = styled.div`
  position: absolute;
  inset: 0;
`;

function Board({ coords, pieces, submitMove, setCoords, pieceHandler }) {
  const [selectedPiece, setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());
  const innerRef = React.useRef(null);
  const panzoomBoxRef = React.useRef(null);
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
      const moveableSquares = pieceHandler.current.getMoveableSquares(piece);
      setMoveableSquares(moveableSquares);
    },
    [pieceHandler]
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
    const panzoom = Panzoom(panzoomBoxRef.current, {
      setTransform: (e, { scale, x, y }) => {},
      disablePan: false,
      disableZoom: false,
    });

    panzoomBoxRef.current.addEventListener("panzoomstart", (e) => {
      console.log("panzoomstart");
      clearMoveableSquares();
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

    panzoomBoxRef.current.addEventListener("panzoomend", (e) => {
      console.log("panzoomend");
    });

    panzoomBoxRef.current.addEventListener("panzoompan", (e) => {
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

    panzoomBoxRef.current.addEventListener("panzoomzoom", (e) => {});

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
  }, [setCoords, clearMoveableSquares]);

  return (
    <BoardContainer>
      <Inner>
        <BoardCanvas
          coords={coords}
          width={WIDTH}
          height={HEIGHT}
          pixelsPerSquare={PIXELS_PER_SQUARE}
          moveableSquares={moveableSquares}
        />
        <PanzoomBox ref={panzoomBoxRef} />
        <PieceDisplay
          coords={coords}
          handlePieceClick={handlePieceClick}
          width={WIDTH}
          height={HEIGHT}
          pixelsPerSquare={PIXELS_PER_SQUARE}
          pieceHandler={pieceHandler}
        />
        <PieceMoveButtons
          moveableSquares={moveableSquares}
          coords={coords}
          width={WIDTH}
          height={HEIGHT}
          moveAndClear={moveAndClear}
          selectedPiece={selectedPiece}
          size={PIXELS_PER_SQUARE}
        />
      </Inner>
    </BoardContainer>
  );
}

export default Board;
