import React from "react";
import styled from "styled-components";
import {
  imageForPiece,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
} from "../../utils";

const ANIMATION_DURATION = 300;
// CR nroyalty: tombstones for recently captured pieces!

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
          "--size": `${size}px`,
          transform: `translate(${x * size}px, ${y * size}px)`,
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
  console.log("RENDER PIECE DISPLAY");
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
  const piecesRefsMap = React.useRef(new Map());
  const recentMoveByPieceIdRef = React.useRef(new Map());
  const lastAnimatedCoords = React.useRef(new Map());
  const [, forceRender] = React.useReducer((x) => x + 1, 0);

  const isNotVisible = React.useCallback(
    ({ x, y }) => {
      return x < startingX || x > endingX || y < startingY || y > endingY;
    },
    [startingX, startingY, endingX, endingY]
  );

  const isInvisibleNowAndViaMove = React.useCallback(
    ({ piece }) => {
      const recentMove = recentMoveByPieceIdRef.current.get(piece.id);
      if (recentMove) {
        const { fromX, fromY, toX, toY } = recentMove;
        const wasInvisible = isNotVisible({ x: fromX, y: fromY });
        const willBeInvisible = isNotVisible({ x: toX, y: toY });
        return wasInvisible && willBeInvisible;
      }
      return isNotVisible({ x: piece.x, y: piece.y });
    },
    [isNotVisible]
  );

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "piece-display",
      callback: (data) => {
        setPieces(new Map(data.pieces));
        // we can do something with data.recentMoves to access moves that came through
        // from this update
        // each move has fromX, fromY, toX, toY, pieceId, isWhite, pieceType
        data.recentMoves.forEach((move) => {
          recentMoveByPieceIdRef.current.set(move.pieceId, move);
        });
      },
    });
    return () => {
      pieceHandler.current.unsubscribe({
        id: "piece-display",
      });
    };
  }, [pieceHandler]);

  const easeInOutCubic = (t) => {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };

  const getAnimatedCoords = ({ pieceId, now }) => {
    const recentMove = recentMoveByPieceIdRef.current.get(pieceId);
    if (recentMove) {
      const { fromX, fromY, toX, toY, receivedAt } = recentMove;
      const elapsed = now - receivedAt;
      if (elapsed > ANIMATION_DURATION) {
        return { x: toX, y: toY, finished: true };
      }
      const progress = easeInOutCubic(elapsed / ANIMATION_DURATION);
      const x = fromX + (toX - fromX) * progress;
      const y = fromY + (toY - fromY) * progress;
      return { x, y, finished: false };
    }
    return null;
  };

  const savePieceRef = (pieceId, ref) => {
    if (ref) {
      piecesRefsMap.current.set(pieceId, ref);
    } else {
      piecesRefsMap.current.delete(pieceId);
    }
  };

  React.useEffect(() => {
    let frameId;
    const loop = () => {
      frameId = requestAnimationFrame(loop);
      const now = performance.now();
      const toKeep = new Map();
      let doForceRender = false;
      const setForceRenderIfVisibityChanged = (pieceId, x, y) => {
        const lastCoords = lastAnimatedCoords.current.get(pieceId);
        if (!lastCoords) {
          doForceRender = true;
          return;
        }
        const lastVisible = isNotVisible(lastCoords);
        const newVisible = isNotVisible({ x, y });
        if (lastVisible !== newVisible) {
          doForceRender = true;
        }
      };
      const maybeSetRefTransform = (ref, x, y) => {
        if (ref) {
          ref.style.transform = `translate(${x * pixelsPerSquare}px, ${y * pixelsPerSquare}px)`;
        }
      };
      for (const move of recentMoveByPieceIdRef.current.values()) {
        const ref = piecesRefsMap.current.get(move.pieceId);
        const maybeAnimated = getAnimatedCoords({
          pieceId: move.pieceId,
          now,
        });
        if (!maybeAnimated) {
          maybeSetRefTransform(ref, move.toX, move.toY);
          setForceRenderIfVisibityChanged(move.pieceId, move.toX, move.toY);
          doForceRender = true;
          lastAnimatedCoords.current.delete(move.pieceId);
          continue;
        }
        const { x: animatedX, y: animatedY, finished } = maybeAnimated;
        const { x, y } = getScreenRelativeCoords({
          x: animatedX,
          y: animatedY,
          startingX,
          startingY,
        });
        setForceRenderIfVisibityChanged(move.pieceId, x, y);
        if (!finished) {
          maybeSetRefTransform(ref, x, y);
          lastAnimatedCoords.current.set(move.pieceId, { x, y });
          toKeep.set(move.pieceId, move);
        } else {
          maybeSetRefTransform(ref, x, y);
          lastAnimatedCoords.current.delete(move.pieceId);
        }
      }
      recentMoveByPieceIdRef.current = toKeep;
      if (doForceRender) {
        console.log("forceRender");
        forceRender();
      }
    };
    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [pixelsPerSquare, startingX, startingY, isNotVisible]);

  return Array.from(pieces.values()).map((piece) => {
    const now = performance.now();
    let maybeAnimatedX = piece.x;
    let maybeAnimatedY = piece.y;
    const maybeAnimated = getAnimatedCoords({
      pieceId: piece.id,
      now,
    });
    if (maybeAnimated) {
      maybeAnimatedX = maybeAnimated.x;
      maybeAnimatedY = maybeAnimated.y;
    }
    if (isInvisibleNowAndViaMove({ piece })) {
      return null;
    }
    const { x, y } = getScreenRelativeCoords({
      x: maybeAnimatedX,
      y: maybeAnimatedY,
      startingX,
      startingY,
    });
    return (
      <Piece
        key={piece.id}
        ref={(el) => savePieceRef(piece.id, el)}
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
