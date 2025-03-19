import React from "react";
import styled from "styled-components";
import {
  getStartingAndEndingCoords,
  getSquareColor,
  getScreenRelativeCoords,
  easeInOutSquare,
  colorForPieceType,
} from "../../utils";

const MAX_VIEWPORT_WIDTH = 81;
const MAX_VIEWPORT_HEIGHT = 81;
const MIN_PX_PER_SQUARE = 12;
const MOVE_ANIMATION_DURATION = 300;

const ZoomedOutOverviewWrapper = styled.div`
  position: absolute;
  inset: 0;
  background-color: #2bb0557e;
  transition: opacity 0.3s ease;
  opacity: var(--opacity);
`;

const ZoomCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
`;

function ZoomedOutOverview({
  hidden,
  pxWidth,
  pxHeight,
  coords,
  pieceHandler,
}) {
  const pieceCanvasRef = React.useRef(null);
  const boardCanvasRef = React.useRef(null);
  const piecesRef = React.useRef(new Map(pieceHandler.current.getPieces()));
  const recentMovesRef = React.useRef(new Map());

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "zoomed-out-overview",
      callback: (data) => {
        piecesRef.current = new Map(data.pieces);
        data.recentMoves.forEach((move) => {
          recentMovesRef.current.set(move.pieceId, move);
        });
      },
    });
    return () => {
      pieceHandler.current.unsubscribe({
        id: "zoomed-out-overview",
      });
    };
  }, [pieceHandler]);

  const {
    squareSize,
    numSquares,
    pieceSize,
    halfBoardLineWidth,
    leftPadding,
    topPadding,
    rightPadding,
    bottomPadding,
  } = React.useMemo(() => {
    const minDist = Math.min(pxWidth, pxHeight);
    let candidateSize = MIN_PX_PER_SQUARE;
    while (minDist / candidateSize > MAX_VIEWPORT_WIDTH) {
      candidateSize += 2;
    }
    const numSquares = Math.floor(minDist / candidateSize);
    const horizontalPadding = pxWidth - numSquares * candidateSize;
    const verticalPadding = pxHeight - numSquares * candidateSize;
    let pieceSize = candidateSize / 2;
    let halfBoardLineWidth = 1;
    if (candidateSize > 24) {
      halfBoardLineWidth = 2;
    }
    if (candidateSize > 30) {
      halfBoardLineWidth = 3;
    }
    return {
      squareSize: candidateSize,
      numSquares,
      leftPadding: Math.floor(horizontalPadding / 2),
      topPadding: Math.floor(verticalPadding / 2),
      rightPadding: Math.ceil(horizontalPadding / 2),
      bottomPadding: Math.ceil(verticalPadding / 2),
      pieceSize,
      halfBoardLineWidth,
    };
  }, [pxWidth, pxHeight]);

  const { startingX, startingY, endingX, endingY } = getStartingAndEndingCoords(
    {
      coords,
      width: numSquares,
      height: numSquares,
    }
  );

  React.useEffect(() => {
    if (!boardCanvasRef.current) {
      return;
    }
    const ctx = boardCanvasRef.current.getContext("2d");
    ctx.fillStyle = "slategrey"; //  CR nroyalty: fix colors
    ctx.fillRect(0, 0, pxWidth, pxHeight);
    // ctx.fillStyle = "#BFDBFE"; // CR nroyalty: FIX
    ctx.fillStyle = "#6B7280";
    ctx.fillRect(
      leftPadding,
      topPadding,
      pxWidth - leftPadding - rightPadding,
      pxHeight - topPadding - bottomPadding
    );

    let xMod = startingX % 8;
    let yMod = startingY % 8;
    let xOff = 8 - xMod;
    let yOff = 8 - yMod;
    let x = startingX + xOff;
    let y = startingY + yOff;
    ctx.fillStyle = "black"; // CR nroyalty: fix colors
    while (x < endingX) {
      const { x: screenX } = getScreenRelativeCoords({
        x,
        y: 0,
        startingX,
        startingY,
      });
      const starting = leftPadding + screenX * squareSize - halfBoardLineWidth;
      const ending = starting + halfBoardLineWidth * 2;
      ctx.fillRect(starting, 0, ending - starting, pxHeight);
      x += 8;
    }
    while (y < endingY) {
      const { y: screenY } = getScreenRelativeCoords({
        x: 0,
        y,
        startingX,
        startingY,
      });
      const starting = topPadding + screenY * squareSize - halfBoardLineWidth;
      const ending = starting + halfBoardLineWidth * 2;
      ctx.fillRect(0, starting, pxWidth, ending - starting);
      y += 8;
    }
  }, [
    pxWidth,
    pxHeight,
    leftPadding,
    topPadding,
    rightPadding,
    bottomPadding,
    startingX,
    startingY,
    endingX,
    endingY,
    halfBoardLineWidth,
    squareSize,
  ]);

  React.useEffect(() => {
    let rafId;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!pieceCanvasRef.current) {
        return;
      }
      const ctx = pieceCanvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, pxWidth, pxHeight);
      piecesRef.current.values().forEach((piece) => {
        let { x, y } = piece;
        const recentMove = recentMovesRef.current.get(piece.id);
        if (recentMove) {
          const { fromX, fromY, toX, toY, receivedAt } = recentMove;
          const elapsed = performance.now() - receivedAt;
          if (elapsed > MOVE_ANIMATION_DURATION) {
            recentMovesRef.current.delete(piece.id);
          } else {
            const progress = easeInOutSquare(elapsed / MOVE_ANIMATION_DURATION);
            x = fromX + (toX - fromX) * progress;
            y = fromY + (toY - fromY) * progress;
          }
        }
        if (x < startingX || x >= endingX || y < startingY || y >= endingY) {
          return;
        }
        let { x: screenX, y: screenY } = getScreenRelativeCoords({
          x,
          y,
          startingX,
          startingY,
        });
        screenX *= squareSize;
        screenY *= squareSize;
        screenX += leftPadding;
        screenY += topPadding;
        const upperLeftX = screenX + (squareSize - pieceSize) / 2;
        const upperLeftY = screenY + (squareSize - pieceSize) / 2;

        ctx.globalAlpha = 1;
        ctx.fillStyle = colorForPieceType({
          pieceType: piece.type,
          isWhite: piece.isWhite,
        });
        ctx.fillRect(upperLeftX, upperLeftY, pieceSize, pieceSize);
      });
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    coords,
    bottomPadding,
    leftPadding,
    rightPadding,
    topPadding,
    numSquares,
    squareSize,
    startingX,
    startingY,
    endingX,
    endingY,
    pxWidth,
    pxHeight,
    pieceSize,
    halfBoardLineWidth,
  ]);

  return (
    <ZoomedOutOverviewWrapper style={{ "--opacity": hidden ? 0 : 1 }}>
      <ZoomCanvas width={pxWidth} height={pxHeight} ref={boardCanvasRef} />
      <ZoomCanvas width={pxWidth} height={pxHeight} ref={pieceCanvasRef} />
    </ZoomedOutOverviewWrapper>
  );
}

export default ZoomedOutOverview;
