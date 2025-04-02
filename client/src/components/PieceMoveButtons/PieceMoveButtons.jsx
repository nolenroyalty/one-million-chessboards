import React from "react";
import CoordsContext from "../CoordsContext/CoordsContext";
import HandlersContext from "../HandlersContext/HandlersContext";
import SelectedPieceAndSquaresContext from "../SelectedPieceAndSquaresContext/SelectedPieceAndSquaresContext";
import {
  keyToCoords,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  getZoomedInScreenAbsoluteCoords,
  incrementPieceMove,
  incrementPieceCapture,
  pieceKey,
  TYPE_TO_NAME,
} from "../../utils";
import styled from "styled-components";

const MoveButton = styled.button`
  all: unset;
  cursor: var(--cursor);
  pointer-events: var(--pointer-events);
  width: var(--size);
  height: var(--size);
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(var(--x), var(--y));
  background-color: transparent;
  opacity: var(--opacity);
  transition: opacity 0.3s ease-in-out;
`;

function PieceMoveButtons({ boardSizeParams, submitMove, hidden }) {
  const { coords } = React.useContext(CoordsContext);
  const { pieceHandler, statsHandler } = React.useContext(HandlersContext);
  const { selectedPiece, moveableSquares, clearSelectedPiece } =
    React.useContext(SelectedPieceAndSquaresContext);
  const { startingX, startingY } = getStartingAndEndingCoords({
    coords,
    width: boardSizeParams.squareWidth,
    height: boardSizeParams.squareHeight,
  });

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
      clearSelectedPiece();
    },
    [statsHandler, submitMove, pieceHandler, clearSelectedPiece]
  );

  return Array.from(moveableSquares.values()).map((key) => {
    const [x, y] = keyToCoords(key);
    const { x: screenX, y: screenY } = getScreenRelativeCoords({
      x,
      y,
      startingX,
      startingY,
    });
    const { x: absoluteX, y: absoluteY } = getZoomedInScreenAbsoluteCoords({
      screenX,
      screenY,
      boardSizeParams,
    });
    return (
      <MoveButton
        key={key}
        style={{
          "--x": `${absoluteX}px`,
          "--y": `${absoluteY}px`,
          "--size": `${boardSizeParams.squarePx}px`,
          "--opacity": hidden ? 0 : 1,
          "--pointer-events": hidden ? "none" : "auto",
          "--cursor": hidden ? "none" : "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation();
          moveAndClear({ piece: selectedPiece, toX: x, toY: y });
        }}
      />
    );
  });
}

export default PieceMoveButtons;
