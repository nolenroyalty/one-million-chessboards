import React from "react";
import styled from "styled-components";
import HandlersContext from "../HandlersContext/HandlersContext";
import {
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  easeInOutSquare,
  colorForPieceType,
  computeAnimationDuration,
} from "../../utils";
import CoordsContext from "../CoordsContext/CoordsContext";
import ShowLargeBoardContext from "../ShowLargeBoardContext/ShowLargeBoardContext";

const MAX_ANIMATION_DURATION = 1200;
const MIN_ANIMATION_DURATION = 500;
const MAX_DMOVE = 25;
const BORDER_COLOR = "#0a0a0a";
const BACKGROUND_COLOR = "#0a0a0a";
const DARK_STROKE_COLOR = "#171717";
const LIGHT_STROKE_COLOR = "#f5f5f5";

const ZoomedOutOverviewWrapper = styled.div`
  position: absolute;
  inset: 0;
  // longer than the small board, looks a little nicer
  transition: opacity 0.5s ease;
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

function ZoomedOutOverview({ opacity, boardSizeParams }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const { coords } = React.useContext(CoordsContext);
  const pieceCanvasRef = React.useRef(null);
  const boardCanvasRef = React.useRef(null);
  const animationCanvasRef = React.useRef(null);
  const piecesRef = React.useRef(new Map(pieceHandler.current.getPieces()));
  const [forcePieceRerender, setForcePieceRerender] = React.useState(0);
  const recentMovesRef = React.useRef(new Map());
  const { largeBoardKillSwitch } = React.useContext(ShowLargeBoardContext);

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "zoomed-out-overview",
      callback: (data) => {
        const piecesById = new Map();
        data.pieces.forEach((piece) => {
          piecesById.set(piece.id, piece);
        });
        piecesRef.current = piecesById;
        data.recentMoves.forEach((move) => {
          recentMovesRef.current.set(move.pieceId, move);
        });
        setForcePieceRerender((x) => x + 1);
      },
    });
    return () => {
      pieceHandler.current.unsubscribe({
        id: "zoomed-out-overview",
      });
    };
  }, [pieceHandler]);

  const { squaresWide, squaresHigh, squarePx, borderHalfWidth, pieceSize } =
    boardSizeParams.zoomedOut;

  const { startingX, startingY, endingX, endingY } = getStartingAndEndingCoords(
    {
      coords,
      width: squaresWide,
      height: squaresHigh,
    }
  );

  const getBoardColor = React.useCallback(({ x, y }) => {
    const boardIdxX = Math.floor(x / 8);
    const boardIdxY = Math.floor(y / 8);

    const color1 = "#334155";
    const color2 = "#A1A1AA";

    if (boardIdxX % 2 === 0) {
      return boardIdxY % 2 === 0 ? color1 : color2;
    }
    return boardIdxY % 2 === 0 ? color2 : color1;
  }, []);

  // draw on the gridlines
  React.useEffect(() => {
    if (!boardCanvasRef.current) {
      return;
    }
    if (largeBoardKillSwitch.current) {
      return;
    }
    const ctx = boardCanvasRef.current.getContext("2d");
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, boardSizeParams.pxWidth, boardSizeParams.pxHeight);
    ctx.fillStyle = BORDER_COLOR;

    let xMod = startingX % 8;
    let yMod = startingY % 8;
    let xOff = 8 - xMod;
    let yOff = 8 - yMod;

    for (let x = startingX + xOff - 8; x < endingX; x += 8) {
      if (x < 0 || x >= 8000) {
        continue;
      }
      for (let y = startingY + yOff - 8; y < endingY; y += 8) {
        if (y < 0 || y >= 8000) {
          continue;
        }
        let { x: screenX, y: screenY } = getScreenRelativeCoords({
          x,
          y,
          startingX,
          startingY,
        });
        screenX = Math.max(0, screenX);
        screenY = Math.max(0, screenY);
        ctx.fillStyle = getBoardColor({ x, y });
        ctx.fillRect(
          screenX * squarePx,
          screenY * squarePx,
          squarePx * 8,
          squarePx * 8
        );
      }
    }

    ctx.fillStyle = BORDER_COLOR;
    for (let x = startingX + xOff; x < endingX; x += 8) {
      if (x < 0 || x >= 8000) {
        continue;
      }
      const { x: screenX } = getScreenRelativeCoords({
        x,
        y: 0,
        startingX,
        startingY,
      });
      const starting = screenX * squarePx - borderHalfWidth;
      const ending = starting + borderHalfWidth * 2;
      ctx.fillRect(starting, 0, ending - starting, ctx.canvas.height);
    }
    for (let y = startingY + yOff; y < endingY; y += 8) {
      if (y < 0 || y >= 8000) {
        continue;
      }
      const { y: screenY } = getScreenRelativeCoords({
        x: 0,
        y,
        startingX,
        startingY,
      });
      const starting = screenY * squarePx - borderHalfWidth;
      const ending = starting + borderHalfWidth * 2;
      ctx.fillRect(0, starting, ctx.canvas.width, ending - starting);
    }
  }, [
    startingX,
    startingY,
    endingX,
    endingY,
    getBoardColor,
    largeBoardKillSwitch,
    boardSizeParams.pxWidth,
    boardSizeParams.pxHeight,
    squarePx,
    borderHalfWidth,
  ]);

  const drawPiece = React.useCallback(
    ({ screenX, screenY, ctx, pieceType, isWhite }) => {
      ctx.save();
      ctx.fillStyle = colorForPieceType({ pieceType, isWhite });
      let x = screenX * squarePx;
      let y = screenY * squarePx;
      const upperLeftX = Math.floor(x + (squarePx - pieceSize) / 2);
      const upperLeftY = Math.ceil(y + (squarePx - pieceSize) / 2);
      ctx.fillRect(upperLeftX, upperLeftY, pieceSize, pieceSize);
      //   if (isWhite) {
      //   }
      //   ctx.lineWidth = 2;
      //   ctx.strokeRect(upperLeftX, upperLeftY, pieceSize, pieceSize);
      ctx.restore();
    },
    [squarePx, pieceSize]
  );

  //   Draw on the non-animated pieces
  //   It's kinda nice to use RAF here because it gives us a debounce-esque mechanic,
  //   but we don't need a loop since we only want to trigger this when the pieces change.
  React.useEffect(() => {
    if (!pieceCanvasRef.current) {
      return;
    }
    if (largeBoardKillSwitch.current) {
      return;
    }

    const loop = () => {
      const ctx = pieceCanvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (const piece of piecesRef.current.values()) {
        const { x, y } = piece;
        if (x < startingX || x >= endingX || y < startingY || y >= endingY) {
          continue;
        }
        if (recentMovesRef.current.has(piece.id)) {
          // when we remove a move here, we draw it to this canvas if
          // applicable. so we shouldn't ever need to draw it here
          continue;
        }
        let { x: screenX, y: screenY } = getScreenRelativeCoords({
          x,
          y,
          startingX,
          startingY,
        });
        drawPiece({
          screenX,
          screenY,
          ctx,
          pieceType: piece.type,
          isWhite: piece.isWhite,
        });
      }
    };

    const rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    drawPiece,
    endingX,
    endingY,
    startingX,
    startingY,
    forcePieceRerender,
    largeBoardKillSwitch,
  ]);

  // draw JUST the moving pieces, and draw the piece's final resting
  // position on the non-animated canvas...
  React.useEffect(() => {
    let rafId;
    if (!animationCanvasRef.current) {
      return;
    }
    if (largeBoardKillSwitch.current) {
      return;
    }
    const loop = () => {
      if (largeBoardKillSwitch.current) {
        return;
      }
      rafId = requestAnimationFrame(loop);
      const ctx = animationCanvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (const move of recentMovesRef.current.values()) {
        const { fromX, fromY, toX, toY, receivedAt } = move;
        const piece = piecesRef.current.get(move.pieceId);
        if (!piece) {
          continue;
        }
        const elapsed = performance.now() - receivedAt;
        const animationDuration = computeAnimationDuration({
          moveDistance: Math.hypot(toX - fromX, toY - fromY),
          maxAnimationDuration: MAX_ANIMATION_DURATION,
          minAnimationDuration: MIN_ANIMATION_DURATION,
          maxMoveDistance: MAX_DMOVE,
        });
        if (elapsed > animationDuration) {
          if (!pieceCanvasRef.current) {
            continue;
          }
          const staticCtx = pieceCanvasRef.current.getContext("2d");
          let { x: screenX, y: screenY } = getScreenRelativeCoords({
            x: toX,
            y: toY,
            startingX,
            startingY,
          });
          drawPiece({
            screenX,
            screenY,
            ctx: staticCtx,
            pieceType: piece.type,
            isWhite: piece.isWhite,
          });
          recentMovesRef.current.delete(move.pieceId);
          continue;
        }
        const progress = easeInOutSquare(elapsed / animationDuration);
        const x = fromX + (toX - fromX) * progress;
        const y = fromY + (toY - fromY) * progress;
        let { x: screenX, y: screenY } = getScreenRelativeCoords({
          x,
          y,
          startingX,
          startingY,
        });
        drawPiece({
          screenX,
          screenY,
          ctx,
          pieceType: piece.type,
          isWhite: piece.isWhite,
        });
      }
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [drawPiece, largeBoardKillSwitch, startingX, startingY]);

  return (
    <ZoomedOutOverviewWrapper
      style={{
        "--opacity": opacity,
      }}
    >
      <ZoomCanvas
        width={boardSizeParams.pxWidth}
        height={boardSizeParams.pxHeight}
        ref={boardCanvasRef}
      />
      <ZoomCanvas
        width={boardSizeParams.pxWidth}
        height={boardSizeParams.pxHeight}
        ref={pieceCanvasRef}
      />
      <ZoomCanvas
        width={boardSizeParams.pxWidth}
        height={boardSizeParams.pxHeight}
        ref={animationCanvasRef}
      />
    </ZoomedOutOverviewWrapper>
  );
}

export default ZoomedOutOverview;
