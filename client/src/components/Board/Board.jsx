import React from "react";
import styled from "styled-components";
import Panzoom from "@panzoom/panzoom";
import BoardCanvas from "../BoardCanvas/BoardCanvas";
import PieceDisplay from "../PieceDisplay/PieceDisplay";
import PieceMoveButtons from "../PieceMoveButtons/PieceMoveButtons";
import ZoomedOutOverview from "../ZoomedOutOverview/ZoomedOutOverview";
import { clamp } from "../../utils";

const BoardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--color-slate-400);
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

const PiecesAndMaybeMoves = React.memo(
  ({
    coords,
    handlePieceClick,
    numSquares,
    pixelsPerSquare,
    pieceHandler,
    moveableSquares,
    moveAndClear,
    selectedPiece,
    opacity,
    hidden,
  }) => {
    return (
      <>
        <PieceDisplay
          coords={coords}
          handlePieceClick={handlePieceClick}
          numSquares={numSquares}
          pixelsPerSquare={pixelsPerSquare}
          pieceHandler={pieceHandler}
          opacity={opacity}
          hidden={hidden}
        />
        <PieceMoveButtons
          moveableSquares={moveableSquares}
          coords={coords}
          numSquares={numSquares}
          moveAndClear={moveAndClear}
          selectedPiece={selectedPiece}
          size={pixelsPerSquare}
          opacity={opacity}
        />
      </>
    );
  }
);

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

function useZoomedOutParams({ innerSize }) {
  const MAX_VIEWPORT_WIDTH = 81;
  const MAX_VIEWPORT_HEIGHT = 81;
  const MIN_PX_PER_SQUARE = 12;
  const timeout = React.useRef(null);
  const [params, setParams] = React.useState({
    squareSize: MIN_PX_PER_SQUARE,
    numSquares: 0,
    pieceSize: 0,
    halfBoardLineWidth: 0,
    leftPadding: 0,
    topPadding: 0,
    rightPadding: 0,
    bottomPadding: 0,
    initialized: false,
  });
  React.useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      console.log("calculating zoomed out params", innerSize);
      const minDist = Math.min(innerSize.width, innerSize.height);
      let candidateSize = MIN_PX_PER_SQUARE;
      while (minDist / candidateSize > MAX_VIEWPORT_WIDTH) {
        candidateSize += 2;
      }
      const numSquares = Math.floor(minDist / candidateSize);
      const horizontalPadding = innerSize.width - numSquares * candidateSize;
      const verticalPadding = innerSize.height - numSquares * candidateSize;
      let pieceSize = candidateSize / 2;
      let halfBoardLineWidth = 1;
      if (candidateSize > 24) {
        halfBoardLineWidth = 2;
      }
      if (candidateSize > 30) {
        halfBoardLineWidth = 3;
      }
      setParams({
        squareSize: candidateSize,
        numSquares,
        pieceSize,
        halfBoardLineWidth,
        leftPadding: Math.floor(horizontalPadding / 2),
        topPadding: Math.floor(verticalPadding / 2),
        rightPadding: Math.ceil(horizontalPadding / 2),
        bottomPadding: Math.ceil(verticalPadding / 2),
        initialized: true,
      });
    }, 100);
  }, [innerSize]);
  return params;
}

function useZoomedInParams({ innerSize }) {
  const [params, setParams] = React.useState({
    squareSize: PIXELS_PER_SQUARE,
    numSquares: WIDTH,
    innerPadding: INNER_PADDING,
    borderHalfWidth: 1,
    initialized: false,
  });

  const timeout = React.useRef(null);
  React.useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      setParams({
        squareSize: PIXELS_PER_SQUARE,
        numSquares: WIDTH,
        innerPadding: INNER_PADDING,
        borderHalfWidth: 1,
        initialized: true,
      });
    }, 100);
  }, [innerSize]);
  return params;
}

function Board({ coords, submitMove, setCoords, pieceHandler }) {
  const [selectedPiece, setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());
  const panzoomBoxRef = React.useRef(null);
  const boardContainerRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const [showLargeBoard, _setShowLargeBoard] = React.useState(false);
  const [smallHidden, setSmallHidden] = React.useState(false);
  const [smallMounted, setSmallMounted] = React.useState(true);
  const [largeMounted, setLargeMounted] = React.useState(false);
  const [smallOpacity, setSmallOpacity] = React.useState(1);
  const [largeOpacity, setLargeOpacity] = React.useState(0);
  const largeBoardKillSwitch = React.useRef(false);

  const setShowLargeBoard = React.useCallback(
    (show) => {
      _setShowLargeBoard(show);
      if (show) {
        largeBoardKillSwitch.current = false;
      } else {
        largeBoardKillSwitch.current = true;
      }
    },
    [_setShowLargeBoard]
  );

  const innerSize = useElementSize(innerRef);
  const zoomedOutParams = useZoomedOutParams({ innerSize });
  const zoomedInParams = useZoomedInParams({ innerSize });
  const clearMoveableSquares = React.useCallback(() => {
    setSelectedPiece(null);
    setMoveableSquares(new Set());
  }, []);

  React.useEffect(() => {
    if (showLargeBoard) {
      if (!largeMounted) {
        setLargeMounted(true);
        setLargeOpacity(0);
        setSmallOpacity(0);
      }
      setSmallHidden(true);
      const opacityTimeout = setTimeout(() => {
        setLargeOpacity(1);
      }, 50);

      const timer = setTimeout(() => {
        setSmallMounted(false);
      }, 300);

      return () => {
        clearTimeout(timer);
        clearTimeout(opacityTimeout);
      };
    } else {
      if (!smallMounted) {
        setSmallMounted(true);
        setSmallOpacity(0);
        setLargeOpacity(0);
      }
      clearMoveableSquares();
      setSmallHidden(false);
      const opacityTimeout = setTimeout(() => {
        setSmallOpacity(1);
      }, 50);

      const timer = setTimeout(() => {
        setLargeMounted(false);
      }, 300);

      return () => {
        clearTimeout(timer);
        clearTimeout(opacityTimeout);
      };
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

  const zoomInOnBoard = React.useCallback(
    (e) => {
      const elt = boardContainerRef.current;
      if (!elt) {
        return;
      }
      const eltRect = elt.getBoundingClientRect();
      const deltaX = e.clientX - eltRect.left;
      const deltaY = e.clientY - eltRect.top;
      const clampedX = clamp(deltaX, 0, eltRect.width);
      const clampedY = clamp(deltaY, 0, eltRect.height);
      const xPos = clampedX / zoomedOutParams.squareSize;
      const yPos = clampedY / zoomedOutParams.squareSize;
      const centerXPos = Math.floor(zoomedOutParams.numSquares / 2);
      const centerYPos = Math.floor(zoomedOutParams.numSquares / 2);
      const xOffset = Math.floor(xPos - centerXPos);
      const yOffset = Math.floor(yPos - centerYPos);
      setCoords((coords) => {
        const newX = coords.x + xOffset;
        const newY = coords.y + yOffset;
        const boardX = Math.floor(newX / 8);
        const boardY = Math.floor(newY / 8);
        return {
          x: boardX * 8 + 4,
          y: boardY * 8 + 4,
        };
      });
    },
    [setCoords, zoomedOutParams]
  );

  // zoom in on double click if we're zoomed out
  React.useEffect(() => {
    const elt = boardContainerRef.current;
    const handleDoubleClick = (e) => {
      if (showLargeBoard) {
        setShowLargeBoard(false);
        zoomInOnBoard(e);
      }
    };
    elt.addEventListener("dblclick", handleDoubleClick);
    return () => elt.removeEventListener("dblclick", handleDoubleClick);
  }, [showLargeBoard, zoomInOnBoard]);

  // handler for desktop zoom
  React.useEffect(() => {
    const elt = boardContainerRef.current;
    console.log("DESKTOP ZOOM");
    const handleWheel = (e) => {
      const doScroll = e.ctrlKey || e.metaKey;
      if (doScroll && e.deltaY > 0 && !showLargeBoard) {
        setShowLargeBoard(true);
      } else if (doScroll && e.deltaY < 0 && showLargeBoard) {
        setShowLargeBoard(false);
        zoomInOnBoard(e);
      }
      if (doScroll) {
        e.preventDefault();
      }
    };
    elt.addEventListener("wheel", handleWheel, { passive: false });
    return () => elt.removeEventListener("wheel", handleWheel);
  }, [setCoords, showLargeBoard, zoomInOnBoard, zoomedOutParams]);

  const touchStartState = React.useRef({
    touchStartDist: null,
    changed: false,
  });
  React.useEffect(() => {
    const elt = boardContainerRef.current;

    const handleTouchStart = (e) => {
      console.log(e);
      if (e.touches.length !== 2) {
        touchStartState.current.touchStartDist = null;
        touchStartState.current.changed = false;
        return;
      }
      e.preventDefault();
      touchStartState.current.touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    };

    const handleTouchEnd = (e) => {
      touchStartState.current.touchStartDist = null;
      touchStartState.current.changed = false;
    };

    const handleTouchMove = (e) => {
      if (e.touches.length !== 2) {
        return;
      }
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (
        !touchStartState.current.changed &&
        currentDist < touchStartState.current.touchStartDist - 25 &&
        !showLargeBoard
      ) {
        setShowLargeBoard(true);
        touchStartState.current.changed = true;
      } else if (
        !touchStartState.current.changed &&
        currentDist > touchStartState.current.touchStartDist + 25 &&
        showLargeBoard
      ) {
        setShowLargeBoard(false);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomInOnBoard({ clientX: midX, clientY: midY });
        touchStartState.current.changed = true;
      }
    };

    elt.addEventListener("touchstart", handleTouchStart);
    elt.addEventListener("touchend", handleTouchEnd);
    elt.addEventListener("touchmove", handleTouchMove);
    return () => {
      elt.removeEventListener("touchstart", handleTouchStart);
      elt.removeEventListener("touchend", handleTouchEnd);
      elt.removeEventListener("touchmove", handleTouchMove);
    };
  }, [showLargeBoard, zoomInOnBoard]);

  const lastPanzoom = React.useRef({ lastX: 0, lastY: 0, accX: 0, accY: 0 });
  React.useEffect(() => {
    const elt = panzoomBoxRef.current;
    const panzoom = Panzoom(panzoomBoxRef.current, {
      setTransform: (e, { scale, x, y }) => {},
      disablePan: false,
      disableZoom: true,
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
      const dStep = showLargeBoard ? 5 : 1;
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

    function handleKeyDown(e) {
      const increment = showLargeBoard ? 6 : 2;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x,
          y: coords.y - increment,
        }));
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x,
          y: coords.y + increment,
        }));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x - increment,
          y: coords.y,
        }));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x + increment,
          y: coords.y,
        }));
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      panzoom.destroy();
      window.removeEventListener("keydown", handleKeyDown);
      elt.removeEventListener("panzoomstart", handlePanzoomStart);
      elt.removeEventListener("panzoomend", handlePanzoomEnd);
      elt.removeEventListener("panzoompan", handlePanzoomPan);
    };
  }, [setCoords, clearMoveableSquares, showLargeBoard]);

  return (
    <BoardContainer ref={boardContainerRef}>
      <Inner ref={innerRef}>
        {smallMounted && (
          <BoardCanvas
            coords={coords}
            pxWidth={innerSize.width}
            pxHeight={innerSize.height}
            numSquares={zoomedInParams.numSquares}
            borderHalfWidth={zoomedInParams.borderHalfWidth}
            pixelsPerSquare={zoomedInParams.squareSize}
            moveableSquares={moveableSquares}
            selectedPiece={selectedPiece}
            opacity={smallOpacity}
          />
        )}
        {largeMounted && (
          <ZoomedOutOverview
            pxWidth={innerSize.width}
            pxHeight={innerSize.height}
            coords={coords}
            pieceHandler={pieceHandler}
            opacity={largeOpacity}
            sizeParams={zoomedOutParams}
            largeBoardKillSwitch={largeBoardKillSwitch}
          />
        )}
        <PanzoomBox ref={panzoomBoxRef} />
        {smallMounted && (
          <PiecesAndMaybeMoves
            coords={coords}
            handlePieceClick={handlePieceClick}
            numSquares={zoomedInParams.numSquares}
            pixelsPerSquare={zoomedInParams.squareSize}
            pieceHandler={pieceHandler}
            moveableSquares={moveableSquares}
            moveAndClear={moveAndClear}
            selectedPiece={selectedPiece}
            hidden={smallHidden}
            opacity={smallOpacity}
          />
        )}
      </Inner>
    </BoardContainer>
  );
}

export default Board;
