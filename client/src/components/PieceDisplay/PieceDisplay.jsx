import React from "react";
import styled from "styled-components";
import {
  imageForPiece,
  getMoveableSquares,
  keyToCoords,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
} from "../../utils";

const PieceImg = styled.img`
  width: var(--size);
  height: var(--size);
`;

const PieceButtonWrapper = styled.button`
  all: unset;
  cursor: pointer;
  pointer-events: auto;
  width: var(--size);
  height: var(--size);
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(var(--x), var(--y));
`;

const Piece = React.forwardRef(
  ({ id, x, y, src, onClick, dataId, pieceX, pieceY, size }, ref) => {
    return (
      <PieceButtonWrapper
        id={id}
        key={id}
        data-id={dataId}
        data-piece-x={pieceX}
        data-piece-y={pieceY}
        style={{
          "--x": `${x * size}px`,
          "--y": `${y * size}px`,
          "--size": `${size}px`,
        }}
        onClick={onClick}
        ref={ref}
      >
        <PieceImg src={src} />
      </PieceButtonWrapper>
    );
  }
);

// CR nroyalty: make sure to deselect a piece if it's moved by another player
function PieceDisplay({
  pieceHandler,
  coords,
  width,
  height,
  handlePieceClick,
  pixelsPerSquare,
}) {
  const { startingX, startingY, endingX, endingY } = getStartingAndEndingCoords(
    {
      coords,
      width,
      height,
    }
  );
  const [pieces, setPieces] = React.useState(
    new Map(pieceHandler.current.pieces)
  );

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "piece-display",
      callback: (data) => {
        setPieces(new Map(data.pieces));
        // we can do something with data.recentMoves to access moves that came through
        // from this update
        // each move has fromX, fromY, toX, toY, pieceId, isWhite, pieceType
      },
    });
    return () => {
      pieceHandler.current.unsubscribe({
        id: "piece-display",
      });
    };
  }, [pieceHandler]);

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
        size={pixelsPerSquare}
        onClick={() => {
          handlePieceClick(piece);
        }}
      />
    );
  });
}

export default PieceDisplay;
