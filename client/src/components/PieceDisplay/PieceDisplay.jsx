import React from "react";
import styled, { keyframes } from "styled-components";
import {
  imageForPieceType,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  easeInOutSquare,
  computeAnimationDuration,
} from "../../utils";

const MAX_ANIMATION_DURATION = 750;
const MIN_ANIMATION_DURATION = 350;
const MAX_DMOVE = 15;

// CR nroyalty: tombstones for recently captured pieces!

const PieceImg = styled.img`
  width: var(--size);
  height: var(--size);
  opacity: var(--opacity);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  will-change: opacity, transform;

  transform-origin: center;
  transform: var(--transform);
  &:hover {
    transform: scale(1.12);
  }
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
  transition: opacity 0.3s ease;
  will-change: opacity, transform;
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

function CapturedPiece({ id, x, y, src, piece, size }) {
  return (
    <CapturedPieceWrapper
      id={id}
      data-id={id}
      data-piece-x={piece.x}
      data-piece-y={piece.y}
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
const _Piece = React.forwardRef(
  (
    {
      x,
      y,
      src,
      onClick,
      dataId,
      pieceX,
      pieceY,
      size,
      hidden,
      opacity,
      selected,
    },
    ref
  ) => {
    const translate = React.useMemo(() => {
      return `translate(${x * size}px, ${y * size}px)`;
    }, [x, y, size]);

    const style = React.useMemo(() => {
      return {
        "--size": `${size}px`,
        transform: translate,
        "--opacity": opacity,
        "--pointer-events": hidden ? "none" : "auto",
        "--cursor": hidden ? "none" : "pointer",
      };
    }, [size, translate, opacity, hidden]);

    const imgStyle = React.useMemo(() => {
      return { "--transform": selected ? "scale(1.12)" : "scale(1)" };
    }, [selected]);

    return (
      <PieceButtonWrapper
        data-id={dataId}
        data-piece-x={pieceX}
        data-piece-y={pieceY}
        // it's important that we use an inline style here because it lets
        // us override that style from our animation handler and then automatically
        // remove that overridden style when we re-render the piece
        style={style}
        onClick={onClick}
        ref={ref}
      >
        <PieceImg src={src} style={imgStyle} />
      </PieceButtonWrapper>
    );
  }
);

const Piece = React.memo(_Piece, (prevProps, nextProps) => {
  return (
    prevProps.dataId === nextProps.dataId &&
    prevProps.piece.x === nextProps.piece.x &&
    prevProps.piece.y === nextProps.piece.y &&
    prevProps.src === nextProps.src &&
    prevProps.selected === nextProps.selected &&
    prevProps.hidden === nextProps.hidden &&
    prevProps.opacity === nextProps.opacity &&
    prevProps.size === nextProps.size
  );
});

// CR nroyalty: make sure to deselect a piece if it's moved by another player
function PieceDisplay({
  pieceHandler,
  coords,
  numSquares,
  handlePieceClick,
  pixelsPerSquare,
  selectedPiece,
  hidden,
  opacity,
  clearSelectedPieceAndSquares,
}) {
  const { startingX, startingY, endingX, endingY } = React.useMemo(() => {
    return getStartingAndEndingCoords({
      coords,
      width: numSquares,
      height: numSquares,
    });
  }, [coords, numSquares]);

  const piecesRefsMap = React.useRef(new Map());
  const recentMoveByPieceIdRef = React.useRef(
    pieceHandler.current.getMoveMapByPieceId()
  );
  const [forceUpdate, setForceUpdate] = React.useState(0);

  const isNotVisible = React.useCallback(
    ({ x, y }) => {
      return x < startingX || x >= endingX || y < startingY || y >= endingY;
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

  const getVisiblePiecesAndIds = React.useCallback(
    (piecesMap) => {
      const pieces = [];
      const ids = new Set();
      for (const piece of piecesMap.values()) {
        if (ids.has(piece.id)) {
          continue;
        }
        if (isInvisibleNowAndViaMove({ piece })) {
          continue;
        }
        ids.add(piece.id);
        pieces.push(piece);
      }
      return { pieces, ids };
    },
    [isInvisibleNowAndViaMove]
  );
  const visiblePiecesAndIdsRef = React.useRef(
    getVisiblePiecesAndIds(pieceHandler.current.getPieces())
  );

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "piece-display",
      callback: (data) => {
        data.recentMoves.forEach((move) => {
          if (move.pieceId === selectedPiece?.id) {
            clearSelectedPieceAndSquares();
          }
          recentMoveByPieceIdRef.current.set(move.pieceId, move);
        });
        data.recentCaptures.forEach((capture) => {
          console.log("capture", capture);
          if (capture.capturedPieceId === selectedPiece?.id) {
            clearSelectedPieceAndSquares();
          }
        });
        const nowVisiblePiecesAndIds = getVisiblePiecesAndIds(data.pieces);
        const newIds = nowVisiblePiecesAndIds.ids;
        const oldIds = visiblePiecesAndIdsRef.current.ids;
        if (
          newIds.size !== oldIds.size ||
          ![...newIds].every((id) => oldIds.has(id))
        ) {
          setForceUpdate((prev) => prev + 1);
        }
        visiblePiecesAndIdsRef.current = nowVisiblePiecesAndIds;
      },
    });
    return () => {
      pieceHandler.current.unsubscribe({
        id: "piece-display",
      });
    };
  }, [
    getVisiblePiecesAndIds,
    pieceHandler,
    selectedPiece?.id,
    clearSelectedPieceAndSquares,
  ]);

  const getAnimatedCoords = React.useCallback(({ pieceId, now }) => {
    const recentMove = recentMoveByPieceIdRef.current.get(pieceId);
    if (recentMove) {
      const { fromX, fromY, toX, toY, receivedAt } = recentMove;
      const elapsed = now - receivedAt;
      const moveDistance = Math.hypot(toX - fromX, toY - fromY);
      // CR-maybe nroyalty: we could memoize this if need be
      const animationDuration = computeAnimationDuration({
        moveDistance,
        maxAnimationDuration: MAX_ANIMATION_DURATION,
        minAnimationDuration: MIN_ANIMATION_DURATION,
        maxMoveDistance: MAX_DMOVE,
      });
      if (elapsed > animationDuration) {
        return { x: toX, y: toY, finished: true };
      }
      const progress = easeInOutSquare(elapsed / animationDuration);
      const x = fromX + (toX - fromX) * progress;
      const y = fromY + (toY - fromY) * progress;
      return { x, y, finished: false };
    }
    return null;
  }, []);

  const savePieceRef = React.useCallback((pieceId, ref) => {
    if (ref) {
      piecesRefsMap.current.set(pieceId, ref);
    } else {
      piecesRefsMap.current.delete(pieceId);
    }
  }, []);

  const maybeHandlePieceClick = React.useCallback(
    (piece) => {
      if (!hidden) {
        handlePieceClick(piece);
      }
    },
    [hidden, handlePieceClick]
  );

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
          toKeep.set(move.pieceId, move);
        } else {
          maybeSetRefTransform(ref, x, y);
        }
      }
      recentMoveByPieceIdRef.current = toKeep;
    };
    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [pixelsPerSquare, startingX, startingY, isNotVisible, getAnimatedCoords]);

  const createOnClickHandler = React.useCallback(
    (pieceId) => {
      return (e) => {
        const piece = visiblePiecesAndIdsRef.current.pieces.find(
          (p) => p.id === pieceId
        );
        if (piece) {
          maybeHandlePieceClick(piece);
        }
      };
    },
    [maybeHandlePieceClick]
  );

  const createRefFunc = React.useCallback(
    (pieceId) => {
      return (el) => {
        savePieceRef(pieceId, el);
      };
    },
    [savePieceRef]
  );

  const memoizedPieces = React.useMemo(() => {
    const pieces = [];
    const shutUpError = forceUpdate;
    for (const piece of visiblePiecesAndIdsRef.current.pieces) {
      if (isInvisibleNowAndViaMove({ piece })) {
        continue;
      }
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
      const { x, y } = getScreenRelativeCoords({
        x: maybeAnimatedX,
        y: maybeAnimatedY,
        startingX,
        startingY,
      });
      pieces.push({
        piece,
        refFunc: createRefFunc(piece.id),
        imageSrc: imageForPieceType({
          pieceType: piece.type,
          isWhite: piece.isWhite,
        }),
        x,
        y,
        onClick: createOnClickHandler(piece.id),
        selected: piece.id === selectedPiece?.id,
      });
    }
    return pieces;
  }, [
    createOnClickHandler,
    createRefFunc,
    getAnimatedCoords,
    isInvisibleNowAndViaMove,
    startingX,
    startingY,
    forceUpdate,
    selectedPiece,
  ]);

  return memoizedPieces.map(({ piece, refFunc, imageSrc, x, y, onClick }) => {
    return (
      <Piece
        key={piece.id}
        ref={refFunc}
        piece={piece}
        src={imageSrc}
        x={x}
        y={y}
        size={pixelsPerSquare}
        hidden={hidden}
        opacity={opacity}
        onClick={onClick}
        selected={piece.id === selectedPiece?.id}
      />
    );
  });
}

export default PieceDisplay;
