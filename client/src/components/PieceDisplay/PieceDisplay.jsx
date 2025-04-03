import React from "react";
import styled, { keyframes } from "styled-components";
import HandlersContext from "../HandlersContext/HandlersContext";
import CoordsContext from "../CoordsContext/CoordsContext";
import SelectedPieceAndSquaresContext from "../SelectedPieceAndSquaresContext/SelectedPieceAndSquaresContext";
import {
  imageForPieceType,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  easeInOutSquare,
  computeAnimationDuration,
  getZoomedInScreenAbsoluteCoords,
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

  transform-origin: center;
  transform: var(--transform);
  &:hover {
    transform: scale(1.12);
  }
  filter: url(#colorRemap) url(#binaryRemap);
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

function _Piece({
  x,
  y,
  src,
  dataId,
  pieceX,
  pieceY,
  size,
  hidden,
  opacity,
  selected,
  translate,
  savePieceRef,
  maybeHandlePieceClick,
}) {
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

  const onClick = React.useCallback(() => {
    maybeHandlePieceClick(dataId);
  }, [maybeHandlePieceClick, dataId]);

  const refFunc = React.useCallback(
    (el) => {
      savePieceRef(dataId, el);
    },
    [savePieceRef, dataId]
  );

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
      ref={refFunc}
    >
      <PieceImg className="chess-piece" src={src} style={imgStyle} />
      {/* <CircleX style={imgStyle} /> */}
    </PieceButtonWrapper>
  );
}

const Piece = React.memo(_Piece);

// CR nroyalty: make sure to deselect a piece if it's moved by another player
function PieceDisplay({ boardSizeParams, hidden, opacity }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const { coords } = React.useContext(CoordsContext);
  const { selectedPiece, clearSelectedPiece, setSelectedPiece } =
    React.useContext(SelectedPieceAndSquaresContext);
  const { startingX, startingY, endingX, endingY } = React.useMemo(() => {
    return getStartingAndEndingCoords({
      coords,
      width: boardSizeParams.squareWidth,
      height: boardSizeParams.squareHeight,
    });
  }, [coords, boardSizeParams]);

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
    visiblePiecesAndIdsRef.current = getVisiblePiecesAndIds(
      pieceHandler.current.getPieces()
    );
    setForceUpdate((prev) => prev + 1);
    pieceHandler.current.subscribe({
      id: "piece-display",
      callback: (data) => {
        data.recentMoves.forEach((move) => {
          if (move.pieceId === selectedPiece?.id) {
            clearSelectedPiece();
          }
          const animationDuration = computeAnimationDuration({
            moveDistance: Math.hypot(
              move.toX - move.fromX,
              move.toY - move.fromY
            ),
            maxAnimationDuration: MAX_ANIMATION_DURATION,
            minAnimationDuration: MIN_ANIMATION_DURATION,
            maxMoveDistance: MAX_DMOVE,
          });
          const endTime = move.receivedAt + animationDuration;
          recentMoveByPieceIdRef.current.set(move.pieceId, {
            ...move,
            endTime,
            animationDuration,
          });
        });

        data.recentCaptures.forEach((capture) => {
          if (capture.capturedPieceId === selectedPiece?.id) {
            clearSelectedPiece();
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
  }, [getVisiblePiecesAndIds, pieceHandler, selectedPiece, clearSelectedPiece]);

  const getAnimatedCoords = React.useCallback(({ pieceId, now }) => {
    const recentMove = recentMoveByPieceIdRef.current.get(pieceId);
    if (recentMove) {
      const { fromX, fromY, toX, toY, receivedAt, endTime, animationDuration } =
        recentMove;
      if (now > endTime) {
        return { x: toX, y: toY, finished: true };
      }
      const elapsed = now - receivedAt;
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
    (pieceId) => {
      if (!hidden) {
        const piece = visiblePiecesAndIdsRef.current.pieces.find(
          (p) => p.id === pieceId
        );
        if (piece) {
          setSelectedPiece(piece);
        }
      }
    },
    [hidden, setSelectedPiece]
  );

  React.useEffect(() => {
    let frameId;
    const loop = () => {
      frameId = requestAnimationFrame(loop);
      const now = performance.now();
      const toKeep = new Map();
      const maybeSetRefTransform = (ref, x, y) => {
        if (ref) {
          const { x: absoluteX, y: absoluteY } =
            getZoomedInScreenAbsoluteCoords({
              screenX: x,
              screenY: y,
              boardSizeParams,
            });
          ref.style.transform = `translate(${absoluteX}px, ${absoluteY}px)`;
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
  }, [boardSizeParams, startingX, startingY, isNotVisible, getAnimatedCoords]);

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

      const { x: absoluteX, y: absoluteY } = getZoomedInScreenAbsoluteCoords({
        screenX: x,
        screenY: y,
        boardSizeParams,
      });

      const translate = `translate(${absoluteX}px, ${absoluteY}px)`;

      pieces.push({
        piece,
        imageSrc: imageForPieceType({
          pieceType: piece.type,
          isWhite: piece.isWhite,
        }),
        x,
        y,
        translate,
        selected: piece.id === selectedPiece?.id,
      });
    }
    return pieces;
  }, [
    getAnimatedCoords,
    isInvisibleNowAndViaMove,
    startingX,
    startingY,
    forceUpdate,
    selectedPiece,
    boardSizeParams,
  ]);

  return memoizedPieces.map(({ piece, imageSrc, x, y, translate }) => {
    return (
      <Piece
        key={piece.id}
        savePieceRef={savePieceRef}
        src={imageSrc}
        dataId={piece.id}
        x={x}
        y={y}
        translate={translate}
        size={boardSizeParams.squarePx}
        hidden={hidden}
        opacity={opacity}
        maybeHandlePieceClick={maybeHandlePieceClick}
        selected={piece.id === selectedPiece?.id}
      />
    );
  });
}

export default PieceDisplay;
