import React from "react";
import styled from "styled-components";
import Panzoom from "@panzoom/panzoom";
import BoardCanvas from "../BoardCanvas/BoardCanvas";
import PieceDisplay from "../PieceDisplay/PieceDisplay";
import PieceMoveButtons from "../PieceMoveButtons/PieceMoveButtons";
import ZoomedOutOverview from "../ZoomedOutOverview/ZoomedOutOverview";
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

function PiecesAndMaybeMoves({
  coords,
  handlePieceClick,
  width,
  height,
  pixelsPerSquare,
  pieceHandler,
  moveableSquares,
  moveAndClear,
  selectedPiece,
  hidden,
}) {
  return (
    <>
      <PieceDisplay
        coords={coords}
        handlePieceClick={handlePieceClick}
        width={width}
        height={height}
        pixelsPerSquare={pixelsPerSquare}
        pieceHandler={pieceHandler}
        hidden={hidden}
      />
      <PieceMoveButtons
        moveableSquares={moveableSquares}
        coords={coords}
        width={width}
        height={height}
        moveAndClear={moveAndClear}
        selectedPiece={selectedPiece}
        size={pixelsPerSquare}
        hidden={hidden}
      />
    </>
  );
}

function useElementSize(ref) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (!ref.current) {
      return;
    }
    const elt = ref.current;
    setSize({
      width: elt.clientWidth,
      height: elt.clientHeight,
    });
    const handleResize = () => {
      setSize({
        width: elt.clientWidth,
        height: elt.clientHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ref]);

  return size;
}

function Board({ coords, submitMove, setCoords, pieceHandler }) {
  const [selectedPiece, setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());
  const panzoomBoxRef = React.useRef(null);
  const boardContainerRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const [showLargeBoard, setShowLargeBoard] = React.useState(false);
  const [smallHidden, setSmallHidden] = React.useState(false);
  const [largeHidden, setLargeHidden] = React.useState(true);
  const [smallMounted, setSmallMounted] = React.useState(true);
  const [largeMounted, setLargeMounted] = React.useState(false);

  const innerSize = useElementSize(innerRef);

  const clearMoveableSquares = React.useCallback(() => {
    setSelectedPiece(null);
    setMoveableSquares(new Set());
  }, []);

  React.useEffect(() => {
    if (showLargeBoard) {
      if (!largeMounted) {
        setLargeMounted(true);
      }
      setSmallHidden(true);
      setLargeHidden(false);

      const timer = setTimeout(() => {
        setSmallMounted(false);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      if (!smallMounted) {
        setSmallMounted(true);
      }
      clearMoveableSquares();
      setSmallHidden(false);
      setLargeHidden(true);

      const timer = setTimeout(() => {
        setLargeMounted(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [showLargeBoard, largeMounted, smallMounted, clearMoveableSquares]);

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

  React.useEffect(() => {
    const elt = boardContainerRef.current;
    const handleWheel = (e) => {
      const doScroll = e.ctrlKey || e.metaKey;
      if (doScroll && e.deltaY > 0 && !showLargeBoard) {
        setShowLargeBoard(true);
      } else if (doScroll && e.deltaY < 0 && showLargeBoard) {
        setShowLargeBoard(false);
      }
      if (doScroll) {
        e.preventDefault();
      }
    };
    elt.addEventListener("wheel", handleWheel, { passive: false });
    return () => elt.removeEventListener("wheel", handleWheel);
  }, [showLargeBoard]);

  const lastPanzoom = React.useRef({ lastX: 0, lastY: 0, accX: 0, accY: 0 });
  React.useEffect(() => {
    const elt = panzoomBoxRef.current;
    const panzoom = Panzoom(panzoomBoxRef.current, {
      setTransform: (e, { scale, x, y }) => {},
      disablePan: false,
      disableZoom: false,
    });

    const handlePanzoomStart = (e) => {
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
    };
    elt.addEventListener("panzoomstart", handlePanzoomStart);

    const handlePanzoomEnd = (e) => {
      console.log("panzoomend");
    };
    elt.addEventListener("panzoomend", handlePanzoomEnd);

    const handlePanzoomPan = (e) => {
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
    };
    elt.addEventListener("panzoompan", handlePanzoomPan);

    // CR nroyalty: handle zooming on phones
    const handlePanzoomZoom = (e) => {
      console.log("panzoomzoom", e);
    };
    elt.addEventListener("panzoomzoom", handlePanzoomZoom);

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
      console.warn("REMOUNTING PANZOOM");
      panzoom.destroy();
      window.removeEventListener("keydown", handleKeyDown);
      elt.removeEventListener("panzoomstart", handlePanzoomStart);
      elt.removeEventListener("panzoomend", handlePanzoomEnd);
      elt.removeEventListener("panzoompan", handlePanzoomPan);
      elt.removeEventListener("panzoomzoom", handlePanzoomZoom);
    };
  }, [setCoords, clearMoveableSquares]);

  return (
    <BoardContainer ref={boardContainerRef}>
      <Inner ref={innerRef}>
        {smallMounted && (
          <BoardCanvas
            coords={coords}
            width={WIDTH}
            height={HEIGHT}
            pixelsPerSquare={PIXELS_PER_SQUARE}
            moveableSquares={moveableSquares}
            selectedPiece={selectedPiece}
            hidden={smallHidden}
          />
        )}
        {largeMounted && (
          <ZoomedOutOverview
            hidden={largeHidden}
            pxWidth={innerSize.width}
            pxHeight={innerSize.height}
            coords={coords}
            pieceHandler={pieceHandler}
          />
        )}
        <PanzoomBox ref={panzoomBoxRef} />
        {smallMounted && (
          <PiecesAndMaybeMoves
            coords={coords}
            handlePieceClick={handlePieceClick}
            width={WIDTH}
            height={HEIGHT}
            pixelsPerSquare={PIXELS_PER_SQUARE}
            pieceHandler={pieceHandler}
            moveableSquares={moveableSquares}
            moveAndClear={moveAndClear}
            selectedPiece={selectedPiece}
            hidden={smallHidden}
          />
        )}
      </Inner>
    </BoardContainer>
  );
}

export default Board;
