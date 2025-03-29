import React from "react";
import styled from "styled-components";
import BoardCanvas from "../BoardCanvas/BoardCanvas";
import PieceDisplay from "../PieceDisplay/PieceDisplay";
import PieceMoveButtons from "../PieceMoveButtons/PieceMoveButtons";
import ZoomedOutOverview from "../ZoomedOutOverview/ZoomedOutOverview";
import {
  clamp,
  incrementPieceMove,
  incrementPieceCapture,
  pieceKey,
} from "../../utils";
import PanzoomBox from "../PanzoomBox/PanzoomBox";
import BoardControls from "../BoardControls/BoardControls";
import { useElementDimensions } from "../../hooks/use-element-dimensions";
const WIDTH = 23;
const HEIGHT = 24;
const PIXELS_PER_SQUARE = 24;

const BoardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex-grow: 1;
  justify-content: space-between;
  overflow: hidden;
`;

const Inner = styled.div`
  /* width: ${WIDTH * PIXELS_PER_SQUARE}px; */
  /* height: ${HEIGHT * PIXELS_PER_SQUARE}px; */
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
`;

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

const MIN_PIXELS_PER_SQUARE = 28;
const MAX_NUM_ZOOMED_IN_SQUARES = 36;
const MIN_NUM_ZOOMED_IN_SQUARES = 8;
function useZoomedInParams({ innerSize }) {
  const [params, setParams] = React.useState({
    squarePx: 0,
    squareWidth: 0,
    squareHeight: 0,
    borderHalfWidth: 0,
    initialized: false,
  });

  const timeout = React.useRef(null);
  React.useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    const calc = () => {
      const minDist = Math.min(innerSize.width, innerSize.height);
      const maxDist = Math.max(innerSize.width, innerSize.height);
      let heightIsSmall = innerSize.height <= innerSize.width;
      let squarePx;
      let largeCount;
      let smallCount;
      if (minDist / MIN_PIXELS_PER_SQUARE < MIN_NUM_ZOOMED_IN_SQUARES) {
        squarePx = MIN_PIXELS_PER_SQUARE;
        largeCount = maxDist / squarePx;
        smallCount = minDist / squarePx;
      } else {
        squarePx = MIN_PIXELS_PER_SQUARE;
        largeCount = maxDist / squarePx;
        smallCount = minDist / squarePx;
        while (
          largeCount > MAX_NUM_ZOOMED_IN_SQUARES &&
          smallCount > MIN_NUM_ZOOMED_IN_SQUARES
        ) {
          squarePx += 2;
          largeCount = maxDist / squarePx;
          smallCount = minDist / squarePx;
        }
        largeCount = Math.min(
          Math.floor(largeCount),
          MAX_NUM_ZOOMED_IN_SQUARES
        );
        smallCount = Math.max(
          Math.floor(smallCount),
          MIN_NUM_ZOOMED_IN_SQUARES
        );
      }
      let borderHalfWidth = 1;
      if (squarePx > 26) {
        borderHalfWidth = 2;
      }
      if (squarePx > 34) {
        borderHalfWidth = 3;
      }
      let horizontalPadding, verticalPadding;
      if (heightIsSmall) {
        horizontalPadding = innerSize.width - largeCount * squarePx;
        verticalPadding = innerSize.height - smallCount * squarePx;
      } else {
        horizontalPadding = innerSize.width - smallCount * squarePx;
        verticalPadding = innerSize.height - largeCount * squarePx;
      }
      let leftPadding = Math.floor(horizontalPadding / 2);
      let rightPadding = Math.ceil(horizontalPadding / 2);
      let topPadding = Math.floor(verticalPadding / 2);
      let bottomPadding = Math.ceil(verticalPadding / 2);
      setParams({
        squarePx,
        squareWidth: heightIsSmall ? largeCount : smallCount,
        squareHeight: heightIsSmall ? smallCount : largeCount,
        borderHalfWidth,
        leftPadding,
        rightPadding,
        topPadding,
        bottomPadding,
        initialized: true,
      });
    };

    timeout.current = setTimeout(calc, 100);
    return () => {
      clearTimeout(timeout.current);
    };
  }, [innerSize]);
  return params;
}

function Board({ coords, submitMove, setCoords, pieceHandler }) {
  const [selectedPiece, setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());
  const boardContainerRef = React.useRef(null);
  const innerRef = React.useRef(null);
  const [showLargeBoard, _setShowLargeBoard] = React.useState(false);
  const [smallHidden, setSmallHidden] = React.useState(false);
  const [smallMounted, setSmallMounted] = React.useState(true);
  const [largeMounted, setLargeMounted] = React.useState(false);
  const [smallOpacity, setSmallOpacity] = React.useState(1);
  const [largeOpacity, setLargeOpacity] = React.useState(0);
  const largeBoardKillSwitch = React.useRef(false);
  // CR nroyalty: DUPE PLEASE REMOVE
  const piecesRef = React.useRef(pieceHandler.current.getPieces());

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "board",
      callback: (data) => {
        piecesRef.current = data.pieces;
      },
    });
    return () => {
      pieceHandler.current.unsubscribe("board");
    };
  }, [pieceHandler]);

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

  const innerSize = useElementDimensions(innerRef);
  const zoomedOutParams = useZoomedOutParams({ innerSize });
  const zoomedInParams = useZoomedInParams({ innerSize });
  const clearSelectedPieceAndSquares = React.useCallback(() => {
    setSelectedPiece(null);
    setMoveableSquares(new Set());
  }, []);

  const makeCoordsRelativeToInner = React.useCallback(
    (coords) => {
      let x = coords.x - innerSize.left;
      let y = coords.y - innerSize.top;
      return {
        x: clamp(x, 0, innerSize.width),
        y: clamp(y, 0, innerSize.height),
      };
    },
    [innerSize]
  );
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
      clearSelectedPieceAndSquares();
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
  }, [
    showLargeBoard,
    largeMounted,
    smallMounted,
    clearSelectedPieceAndSquares,
  ]);

  const moveAndClear = React.useCallback(
    ({ piece, toX, toY }) => {
      incrementPieceMove(piece.id);
      const toKey = pieceKey(toX, toY);
      if (piecesRef.current.has(toKey)) {
        incrementPieceCapture(piece.id);
      }
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
        clearSelectedPieceAndSquares();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [clearSelectedPieceAndSquares]);

  const zoomInOnBoard = React.useCallback(
    (e) => {
      const elt = innerRef.current;
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
    const elt = innerRef.current;
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
    const elt = innerRef.current;
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
    const elt = innerRef.current;

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

  // CR nroyalty: we need to create ANOTHER wrapper inside INNER
  // that respects our padding calculations and also hides elements outside
  // of its view so that you can't see pieces that have moved off of the visible
  // board!!
  return (
    <BoardContainer ref={boardContainerRef}>
      <Inner ref={innerRef}>
        {smallMounted && (
          <BoardCanvas
            coords={coords}
            pxWidth={innerSize.width}
            pxHeight={innerSize.height}
            zoomedInParams={zoomedInParams}
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
        <PanzoomBox
          setCoords={setCoords}
          clearSelectedPieceAndSquares={clearSelectedPieceAndSquares}
          showLargeBoard={showLargeBoard}
        />
        {smallMounted && (
          <>
            <PieceDisplay
              coords={coords}
              handlePieceClick={handlePieceClick}
              zoomedInParams={zoomedInParams}
              pieceHandler={pieceHandler}
              opacity={smallOpacity}
              hidden={smallHidden}
              selectedPiece={selectedPiece}
              setSelectedPiece={setSelectedPiece}
              makeCoordsRelativeToInner={makeCoordsRelativeToInner}
              clearSelectedPieceAndSquares={clearSelectedPieceAndSquares}
            />
            <PieceMoveButtons
              moveableSquares={moveableSquares}
              coords={coords}
              zoomedInParams={zoomedInParams}
              moveAndClear={moveAndClear}
              selectedPiece={selectedPiece}
              opacity={smallOpacity}
            />
          </>
        )}
      </Inner>
      <BoardControls
        coords={coords}
        setCoords={setCoords}
        showLargeBoard={showLargeBoard}
        setShowLargeBoard={setShowLargeBoard}
        selectedPiece={selectedPiece}
      />
    </BoardContainer>
  );
}

export default Board;
