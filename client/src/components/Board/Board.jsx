import React from "react";
import styled, { keyframes } from "styled-components";
import BoardCanvas from "../BoardCanvas/BoardCanvas";
import PieceDisplay from "../PieceDisplay/PieceDisplay";
import PieceMoveButtons from "../PieceMoveButtons/PieceMoveButtons";
import ZoomedOutOverview from "../ZoomedOutOverview/ZoomedOutOverview";
import {
  clamp,
  incrementPieceMove,
  incrementPieceCapture,
  pieceKey,
  TYPE_TO_NAME,
} from "../../utils";
import PanzoomBox from "../PanzoomBox/PanzoomBox";
import BoardControls from "../BoardControls/BoardControls";
import useBoardSizeParams from "../../hooks/use-board-size-params";
import HandlersContext from "../HandlersContext/HandlersContext";
import CoordsContext from "../CoordsContext/CoordsContext";
const BoardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex-grow: 1;
  justify-content: space-between;
  overflow: hidden;
  gap: 0.5rem;
`;

const Outer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const SizedInner = styled.div`
  width: var(--width);
  height: var(--height);
  overflow: hidden;
  animation: ${fadeIn} 0.5s ease-in-out both;
  position: relative;
`;

function Board({ submitMove }) {
  const [selectedPiece, setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());
  const boardContainerRef = React.useRef(null);
  const outerRef = React.useRef(null);
  const sizedInnerRef = React.useRef(null);
  const [showLargeBoard, _setShowLargeBoard] = React.useState(false);
  const [smallHidden, setSmallHidden] = React.useState(false);
  const [smallMounted, setSmallMounted] = React.useState(true);
  const [largeMounted, setLargeMounted] = React.useState(false);
  const [smallOpacity, setSmallOpacity] = React.useState(1);
  const [largeOpacity, setLargeOpacity] = React.useState(0);
  const largeBoardKillSwitch = React.useRef(false);
  const { pieceHandler, statsHandler } = React.useContext(HandlersContext);
  const { coords, setCoords } = React.useContext(CoordsContext);
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

  const boardSizeParams = useBoardSizeParams({ outerRef });
  const clearSelectedPieceAndSquares = React.useCallback(() => {
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
      let dMoves = 1;
      let dWhitePieces = 0;
      let dBlackPieces = 0;
      let dWhiteKings = 0;
      let dBlackKings = 0;
      let incrLocalMoves = true;
      let incrLocalCaptures = false;
      incrementPieceMove(piece.id);
      const toKey = pieceKey(toX, toY);
      const pieces = pieceHandler.current.getPieces();
      if (pieces.has(toKey)) {
        incrementPieceCapture(piece.id);
        incrLocalCaptures = true;
        const capturedPiece = pieces.get(toKey);
        if (capturedPiece) {
          const pieceType = TYPE_TO_NAME[capturedPiece.type];
          const isKing = pieceType === "king";
          if (capturedPiece.isWhite) {
            dWhitePieces--;
            if (isKing) {
              dWhiteKings--;
            }
          } else {
            dBlackPieces--;
            if (isKing) {
              dBlackKings--;
            }
          }
        }
      }
      statsHandler.current.applyLocalDelta({
        dMoves,
        dWhitePieces,
        dBlackPieces,
        dWhiteKings,
        dBlackKings,
        incrLocalMoves,
        incrLocalCaptures,
      });
      submitMove({ piece, toX, toY });
      setSelectedPiece(null);
      setMoveableSquares(new Set());
    },
    [statsHandler, submitMove, pieceHandler]
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
      const elt = sizedInnerRef.current;
      if (!elt) {
        return;
      }
      const eltRect = elt.getBoundingClientRect();
      const deltaX = e.clientX - eltRect.left;
      const deltaY = e.clientY - eltRect.top;
      const clampedX = clamp(deltaX, 0, eltRect.width);
      const clampedY = clamp(deltaY, 0, eltRect.height);
      const xPos = clampedX / boardSizeParams.zoomedOut.squarePx;
      const yPos = clampedY / boardSizeParams.zoomedOut.squarePx;
      const centerXPos = Math.floor(boardSizeParams.zoomedOut.squaresWide / 2);
      const centerYPos = Math.floor(boardSizeParams.zoomedOut.squaresHigh / 2);
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
    [setCoords, boardSizeParams]
  );

  // zoom in on double click if we're zoomed out
  React.useEffect(() => {
    const elt = sizedInnerRef.current;
    const handleDoubleClick = (e) => {
      if (showLargeBoard) {
        setShowLargeBoard(false);
        zoomInOnBoard(e);
      }
    };
    elt.addEventListener("dblclick", handleDoubleClick);
    return () => elt.removeEventListener("dblclick", handleDoubleClick);
  }, [setShowLargeBoard, showLargeBoard, zoomInOnBoard]);

  // handler for desktop zoom
  React.useEffect(() => {
    const elt = sizedInnerRef.current;
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
  }, [setCoords, setShowLargeBoard, showLargeBoard, zoomInOnBoard]);

  const touchStartState = React.useRef({
    touchStartDist: null,
    changed: false,
  });
  React.useEffect(() => {
    const elt = sizedInnerRef.current;

    const handleTouchStart = (e) => {
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
  }, [setShowLargeBoard, showLargeBoard, zoomInOnBoard]);

  return (
    <BoardContainer ref={boardContainerRef}>
      <Outer ref={outerRef}>
        <SizedInner
          style={{
            "--width": `${boardSizeParams.pxWidth}px`,
            "--height": `${boardSizeParams.pxHeight}px`,
          }}
          ref={sizedInnerRef}
        >
          {smallMounted && (
            <BoardCanvas
              pxWidth={boardSizeParams.pxWidth}
              pxHeight={boardSizeParams.pxHeight}
              boardSizeParams={boardSizeParams}
              moveableSquares={moveableSquares}
              selectedPiece={selectedPiece}
              opacity={smallOpacity}
            />
          )}
          {largeMounted && (
            <ZoomedOutOverview
              opacity={largeOpacity}
              boardSizeParams={boardSizeParams}
              largeBoardKillSwitch={largeBoardKillSwitch}
            />
          )}
          <PanzoomBox
            clearSelectedPieceAndSquares={clearSelectedPieceAndSquares}
            showLargeBoard={showLargeBoard}
          />
          {smallMounted && (
            <>
              <PieceDisplay
                handlePieceClick={handlePieceClick}
                boardSizeParams={boardSizeParams}
                opacity={smallOpacity}
                hidden={smallHidden}
                selectedPiece={selectedPiece}
                setSelectedPiece={setSelectedPiece}
                clearSelectedPieceAndSquares={clearSelectedPieceAndSquares}
              />
              <PieceMoveButtons
                moveableSquares={moveableSquares}
                boardSizeParams={boardSizeParams}
                moveAndClear={moveAndClear}
                selectedPiece={selectedPiece}
                opacity={smallOpacity}
              />
            </>
          )}
        </SizedInner>
      </Outer>
      <BoardControls
        showLargeBoard={showLargeBoard}
        setShowLargeBoard={setShowLargeBoard}
        selectedPiece={selectedPiece}
      />
    </BoardContainer>
  );
}

export default Board;
