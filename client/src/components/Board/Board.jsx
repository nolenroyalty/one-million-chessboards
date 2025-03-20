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
  opacity,
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
        opacity={opacity}
      />
      <PieceMoveButtons
        moveableSquares={moveableSquares}
        coords={coords}
        width={width}
        height={height}
        moveAndClear={moveAndClear}
        selectedPiece={selectedPiece}
        size={pixelsPerSquare}
        opacity={opacity}
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

function useZoomedOutParams({ innerSize }) {
  const [x, setX] = React.useState(0);
  const timeout = React.useRef(null);
  React.useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      console.log("CALC SIZE", innerSize);
      const x2 = innerSize.width / 2;
      const y2 = innerSize.height / 2;
      setX(x2);
    }, 100);
  }, [innerSize]);
  return { x };
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
  const [smallOpacity, setSmallOpacity] = React.useState(1);
  const [largeOpacity, setLargeOpacity] = React.useState(0);

  const innerSize = useElementSize(innerRef);
  const { x } = useZoomedOutParams({ innerSize });
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
      setLargeHidden(false);

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
      setLargeHidden(true);
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
      console.log("touchstart");
      e.preventDefault();
      touchStartState.current.touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    };

    const handleTouchEnd = (e) => {
      touchStartState.current.touchStartDist = null;
      touchStartState.current.changed = false;
      console.log("touchend");
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
  }, [showLargeBoard]);

  const lastPanzoom = React.useRef({ lastX: 0, lastY: 0, accX: 0, accY: 0 });
  const lastPanzoomZoom = React.useRef({ scale: 1 });
  React.useEffect(() => {
    const elt = panzoomBoxRef.current;
    const panzoom = Panzoom(panzoomBoxRef.current, {
      setTransform: (e, { scale, x, y }) => {
        // console.log("setTransform", e, { scale, x, y });
      },
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

    // CR nroyalty: handle zooming on phones
    // const handlePanzoomZoom = (e) => {
    //   console.log("panzoomzoom", e, lastPanzoomZoom.current.scale);
    //   lastPanzoomZoom.current.scale = e.detail.scale;
    //   if (e.detail.scale === lastPanzoomZoom.current.scale) {
    //     return;
    //   }
    //   //   if (e.detail.scale > lastPanzoomZoom.current.scale && !showLargeBoard) {
    //   //     setShowLargeBoard(true);
    //   //   } else if (
    //   //     e.detail.scale < lastPanzoomZoom.current.scale &&
    //   //     showLargeBoard
    //   //   ) {
    //   //     setShowLargeBoard(false);
    //   //   }
    //   lastPanzoomZoom.current.scale = e.detail.scale;
    // };
    // elt.addEventListener("panzoomzoom", handlePanzoomZoom);

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
      //   elt.removeEventListener("panzoomzoom", handlePanzoomZoom);
    };
  }, [setCoords, clearMoveableSquares, showLargeBoard]);

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
            opacity={smallOpacity}
          />
        )}
        {largeMounted && (
          <ZoomedOutOverview
            hidden={largeHidden}
            pxWidth={innerSize.width}
            pxHeight={innerSize.height}
            coords={coords}
            pieceHandler={pieceHandler}
            opacity={largeOpacity}
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
            opacity={smallOpacity}
          />
        )}
      </Inner>
    </BoardContainer>
  );
}

export default Board;
