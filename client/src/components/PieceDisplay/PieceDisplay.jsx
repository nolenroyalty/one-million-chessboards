import React from "react";
import styled, { keyframes } from "styled-components";
import {
  imageForPieceType,
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
  cursor: var(--cursor);
  pointer-events: var(--pointer-events);
  width: var(--size);
  height: var(--size);
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: var(--opacity);
  transition: opacity 0.3s ease-in-out;
`;

const AnimFadeout = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

const CapturedPieceWrapper = styled.button`
  all: unset;
  cursor: none;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--size);
  height: var(--size);
  animation: ${AnimFadeout} 0.25s ease-in-out both 0.03s;
  transform: translate(var(--x), var(--y));
`;

function CapturedPiece({ id, x, y, src, pieceX, pieceY, size }) {
  return (
    <CapturedPieceWrapper
      id={id}
      data-id={id}
      data-piece-x={pieceX}
      data-piece-y={pieceY}
      style={{
        "--x": `${x * size}px`,
        "--y": `${y * size}px`,
        "--size": `${size}px`,
      }}
    >
      <PieceImg src={src} />
    </CapturedPieceWrapper>
  );
}
const Piece = React.forwardRef(
  ({ id, x, y, src, onClick, dataId, pieceX, pieceY, size, hidden }, ref) => {
    return (
      <PieceButtonWrapper
        id={id}
        key={id}
        data-id={dataId}
        data-piece-x={pieceX}
        data-piece-y={pieceY}
        // it's important that we use an inline style here because it lets
        // us override that style from our animation handler and then automatically
        // remove that overridden style when we re-render the piece
        style={{
          "--size": `${size}px`,
          transform: `translate(${x * size}px, ${y * size}px)`,
          "--opacity": hidden ? 0 : 1,
          "--pointer-events": hidden ? "none" : "auto",
          "--cursor": hidden ? "none" : "pointer",
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
  hidden,
}) {
  console.log("RENDER PIECE DISPLAY");
  const { startingX, startingY, endingX, endingY } = getStartingAndEndingCoords(
    {
      coords,
      width,
      height,
    }
  );

  const piecesById = React.useCallback((pieces) => {
    const piecesById = new Map();
    for (const piece of pieces) {
      piecesById.set(piece.id, piece);
    }
    return piecesById;
  }, []);

  const [piecesAndCaptures, setPiecesAndCaptures] = React.useState({
    pieces: piecesById(pieceHandler.current.getPieces()),
    captures: pieceHandler.current.getCaptures(),
    recentPieces: new Map(),
  });
  const piecesRefsMap = React.useRef(new Map());
  const recentMoveByPieceIdRef = React.useRef(
    pieceHandler.current.getMoveMapByPieceId()
  );
  const lastAnimatedCoords = React.useRef(new Map());

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
        data.recentMoves.forEach((move) => {
          recentMoveByPieceIdRef.current.set(move.pieceId, move);
        });
        const now = performance.now();
        const filterTime = 1000;
        setPiecesAndCaptures((prev) => {
          const newPieces = new Map(data.pieces);
          const newCaptures = [...prev.captures, ...data.recentCaptures].filter(
            (capture) => {
              return capture.receivedAt > now - filterTime;
            }
          );
          return { pieces: newPieces, captures: newCaptures };
        });
        console.log("called set pieces");
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

  const getAnimatedCoords = React.useCallback(({ pieceId, now }) => {
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
  }, []);

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
    };
    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [pixelsPerSquare, startingX, startingY, isNotVisible, getAnimatedCoords]);

  return (
    <>
      {piecesAndCaptures.captures.map((capture) => {
        if (isNotVisible({ x: capture.x, y: capture.y })) {
          return null;
        }
        const { x, y } = getScreenRelativeCoords({
          x: capture.x,
          y: capture.y,
          startingX,
          startingY,
        });
        return (
          <CapturedPiece
            key={capture.capturedPieceId}
            id={capture.id}
            src={imageForPieceType({
              pieceType: capture.capturedType,
              isWhite: capture.wasWhite,
            })}
            pieceX={capture.x}
            pieceY={capture.y}
            x={x}
            y={y}
            size={pixelsPerSquare}
          />
        );
      })}
      {Array.from(piecesAndCaptures.pieces.values()).map((piece) => {
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
            src={imageForPieceType({
              pieceType: piece.type,
              isWhite: piece.isWhite,
            })}
            pieceX={piece.x}
            pieceY={piece.y}
            x={x}
            y={y}
            size={pixelsPerSquare}
            hidden={hidden}
            onClick={() => {
              if (!hidden) {
                handlePieceClick(piece);
              }
            }}
          />
        );
      })}
    </>
  );
}

export default PieceDisplay;
