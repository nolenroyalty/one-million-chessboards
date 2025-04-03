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

const MAX_ANIMATION_DURATION = 1000;
const MIN_ANIMATION_DURATION = 350;
const MAX_DMOVE = 15;
const CAPTURE_ANIMATION_DURATION = 200;

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
  /* filter: url(#colorRemap) url(#binaryRemap); */
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
  animation: ${AnimFadeout} ${CAPTURE_ANIMATION_DURATION}ms ease-in-out both;
  transform: translate(var(--x), var(--y));
`;

function _CapturedPiece({ id, x, y, src, pieceX, pieceY, size }) {
  return (
    <CapturedPieceWrapper
      id={id}
      data-id={id}
      data-piece-x={pieceX}
      data-piece-y={pieceY}
      style={{
        "--x": `${x}px`,
        "--y": `${y}px`,
        "--size": `${size}px`,
      }}
    >
      <PieceImg src={src} />
    </CapturedPieceWrapper>
  );
}

const CapturedPiece = React.memo(_CapturedPiece);

function _Piece({
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

function makeMoveAnimationState(move) {
  const animationDuration = computeAnimationDuration({
    moveDistance: Math.hypot(move.toX - move.fromX, move.toY - move.fromY),
    maxAnimationDuration: MAX_ANIMATION_DURATION,
    minAnimationDuration: MIN_ANIMATION_DURATION,
    maxMoveDistance: MAX_DMOVE,
  });
  const endTime = move.receivedAt + animationDuration;
  return {
    ...move,
    endTime,
    animationDuration,
  };
}

function initialMoveAnimationState(moveMapByPieceId) {
  const ret = new Map();
  for (const move of moveMapByPieceId.values()) {
    ret.set(move.pieceId, makeMoveAnimationState(move));
  }
  return ret;
}

function PieceDisplay({ boardSizeParams, hidden, opacity }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const { coords } = React.useContext(CoordsContext);
  const {
    selectedPiece,
    clearSelectedPiece,
    setSelectedPiece,
    clearSelectedPieceForId,
  } = React.useContext(SelectedPieceAndSquaresContext);
  const { startingX, startingY, endingX, endingY } = React.useMemo(() => {
    return getStartingAndEndingCoords({
      coords,
      width: boardSizeParams.squareWidth,
      height: boardSizeParams.squareHeight,
    });
  }, [coords, boardSizeParams]);

  const piecesRefsMap = React.useRef(new Map());
  const capturedPiecesByIdRef = React.useRef(new Map());
  const [forceUpdate, setForceUpdate] = React.useState(0);

  const recentMoveByPieceIdRef = React.useRef(
    initialMoveAnimationState(pieceHandler.current.getMoveMapByPieceId())
  );

  const isNotVisible = React.useCallback(
    ({ x, y }) => {
      return x < startingX || x >= endingX || y < startingY || y >= endingY;
    },
    [startingX, startingY, endingX, endingY]
  );

  const moveIsInvisible = React.useCallback(
    (move) => {
      const { fromX, fromY, toX, toY } = move;
      return (
        isNotVisible({ x: fromX, y: fromY }) && isNotVisible({ x: toX, y: toY })
      );
    },
    [isNotVisible]
  );

  const isInvisibleNowAndViaMove = React.useCallback(
    ({ piece }) => {
      const recentMove = recentMoveByPieceIdRef.current.get(piece.id);
      if (recentMove) {
        return moveIsInvisible(recentMove);
      }
      return isNotVisible({ x: piece.x, y: piece.y });
    },
    [isNotVisible, moveIsInvisible]
  );

  const getVisiblePiecesAndIds = React.useCallback(
    (piecesMap) => {
      const map = new Map();
      for (const piece of piecesMap.values()) {
        if (map.has(piece.id)) {
          continue;
        }
        if (isInvisibleNowAndViaMove({ piece })) {
          continue;
        }
        map.set(piece.id, piece);
      }
      return map;
    },
    [isInvisibleNowAndViaMove]
  );

  const visiblePiecesAndIdsRef = React.useRef(
    getVisiblePiecesAndIds(pieceHandler.current.getPieces())
  );

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

  React.useEffect(() => {
    console.log("RESUB");
    visiblePiecesAndIdsRef.current = getVisiblePiecesAndIds(
      pieceHandler.current.getPieces()
    );
    setForceUpdate((prev) => prev + 1);

    pieceHandler.current.subscribe({
      id: "piece-display",
      callback: (data) => {
        let doUpdate = false;
        const capturesToAdd = [];
        const movesToAdd = [];

        if (data.wasSnapshot) {
          const nowVisiblePiecesAndIds = getVisiblePiecesAndIds(data.pieces);
          const newIds = nowVisiblePiecesAndIds;
          const oldIds = visiblePiecesAndIdsRef.current;
          const sizeEqual = newIds.size === oldIds.size;
          if (!sizeEqual) {
            doUpdate = true;
          }
          const now = performance.now();
          visiblePiecesAndIdsRef.current = nowVisiblePiecesAndIds;

          for (const oldId of oldIds.keys()) {
            if (!newIds.has(oldId)) {
              doUpdate = true;
              const currentPiece = pieceHandler.current.getPieceById(oldId);
              const oldPiece = oldIds.get(oldId);
              if (!currentPiece && oldPiece) {
                const alreadyCaptured =
                  capturedPiecesByIdRef.current.has(oldId);
                // reasonable chance that it's been captured and we haven't heard about it.
                if (!alreadyCaptured) {
                  console.log("SPECULATIVELY ADD CAPTURE");
                  capturesToAdd.push({
                    receivedAt: now,
                    piece: oldPiece,
                  });
                }
              }
            }
          }

          for (const newId of newIds.keys()) {
            if (!oldIds.has(newId)) {
              doUpdate = true;
              console.log("PIECE APPEARED?");
              const newPiece = newIds.get(newId);
              if (newPiece) {
                // add a fake move to prevent us from putting the piece
                // in the final spot and then animating it backawards
                movesToAdd.push({
                  fromX: newPiece.x,
                  fromY: newPiece.y,
                  toX: newPiece.x,
                  toY: newPiece.y,
                  pieceId: newId,
                  receivedAt: now,
                });
              }
            } else {
              const oldPiece = oldIds.get(newId);
              const newPiece = newIds.get(newId);
              if (oldPiece.x !== newPiece.x || oldPiece.y !== newPiece.y) {
                console.log("SHOULD SPECULATIVELY ADD MOVE");
                const move = {
                  fromX: oldPiece.x,
                  fromY: oldPiece.y,
                  toX: newPiece.x,
                  toY: newPiece.y,
                  pieceId: newId,
                  receivedAt: now,
                };
                movesToAdd.push(move);
              }
            }
          }
        } else {
          data.recentMoves.forEach((move) => {
            const visibleNow = !moveIsInvisible(move);
            const visibleBefore = visiblePiecesAndIdsRef.current.has(
              move.pieceId
            );
            if (visibleBefore && !visibleNow) {
              visiblePiecesAndIdsRef.current.delete(move.pieceId);
            } else if (!visibleBefore && visibleNow) {
              const piece = pieceHandler.current.getPieceById(move.pieceId);
              if (piece) {
                visiblePiecesAndIdsRef.current.set(move.pieceId, piece);
                doUpdate = true;
              }
              movesToAdd.push(move);
            } else if (visibleBefore && visibleNow) {
              const piece = pieceHandler.current.getPieceById(move.pieceId);
              if (piece) {
                visiblePiecesAndIdsRef.current.set(move.pieceId, piece);
              }
              movesToAdd.push(move);
            }
          });

          data.recentCaptures.forEach((capture) => {
            const piece = visiblePiecesAndIdsRef.current.get(
              capture.capturedPieceId
            );

            if (piece) {
              visiblePiecesAndIdsRef.current.delete(capture.capturedPieceId);
              doUpdate = true;
              capturesToAdd.push({
                receivedAt: capture.receivedAt,
                piece,
              });
            }
          });
        }

        const now = performance.now();
        movesToAdd.forEach((move) => {
          clearSelectedPieceForId(move.pieceId);
          let animationState;
          const prevAnimationState = getAnimatedCoords({
            pieceId: move.pieceId,
            now,
          });
          if (prevAnimationState) {
            const fakeMove = {
              ...move,
              fromX: prevAnimationState.x,
              fromY: prevAnimationState.y,
            };
            animationState = makeMoveAnimationState(fakeMove);
          } else {
            animationState = makeMoveAnimationState(move);
          }
          recentMoveByPieceIdRef.current.set(move.pieceId, animationState);
        });

        if (capturesToAdd.length > 0) {
          capturesToAdd.forEach((capture) => {
            capturedPiecesByIdRef.current.set(capture.piece.id, capture);
          });
          for (const id of capturedPiecesByIdRef.current.keys()) {
            const capture = capturedPiecesByIdRef.current.get(id);
            if (now - capture.receivedAt > CAPTURE_ANIMATION_DURATION) {
              capturedPiecesByIdRef.current.delete(id);
            }
          }
        }

        if (doUpdate) {
          setForceUpdate((prev) => prev + 1);
        }
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
    clearSelectedPiece,
    clearSelectedPieceForId,
    moveIsInvisible,
    getAnimatedCoords,
  ]);

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
        const piece = visiblePiecesAndIdsRef.current.get(pieceId);
        if (piece) {
          setSelectedPiece(piece);
        }
      }
    },
    [hidden, setSelectedPiece]
  );

  React.useEffect(() => {
    let frameId;
    const maybeSetRefTransform = (ref, x, y) => {
      if (ref) {
        const { x: absoluteX, y: absoluteY } = getZoomedInScreenAbsoluteCoords({
          screenX: x,
          screenY: y,
          boardSizeParams,
        });
        ref.style.transform = `translate(${absoluteX}px, ${absoluteY}px)`;
      }
    };
    const loop = () => {
      frameId = requestAnimationFrame(loop);
      const now = performance.now();
      const toKeep = new Map();

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

  const { capturedPieces, memoizedPieces } = React.useMemo(() => {
    let shutupForceUpdate = forceUpdate;
    const capturedPieces = [];
    const memoizedPieces = [];
    const now = performance.now();

    const determineAbsoluteCoords = ({ pieceId, x, y }) => {
      let maybeAnimatedX = x;
      let maybeAnimatedY = y;
      const maybeAnimated = getAnimatedCoords({
        pieceId: pieceId,
        now,
      });
      if (maybeAnimated) {
        maybeAnimatedX = maybeAnimated.x;
        maybeAnimatedY = maybeAnimated.y;
      }
      const { x: screenX, y: screenY } = getScreenRelativeCoords({
        x: maybeAnimatedX,
        y: maybeAnimatedY,
        startingX,
        startingY,
      });
      const { x: absoluteX, y: absoluteY } = getZoomedInScreenAbsoluteCoords({
        screenX,
        screenY,
        boardSizeParams,
      });
      return { absoluteX, absoluteY };
    };

    for (const piece of visiblePiecesAndIdsRef.current.values()) {
      if (isInvisibleNowAndViaMove({ piece })) {
        continue;
      }
      const { absoluteX, absoluteY } = determineAbsoluteCoords({
        pieceId: piece.id,
        x: piece.x,
        y: piece.y,
      });

      memoizedPieces.push({
        piece,
        imageSrc: imageForPieceType({
          pieceType: piece.type,
          isWhite: piece.isWhite,
        }),
        translate: `translate(${absoluteX}px, ${absoluteY}px)`,
        selected: piece.id === selectedPiece?.id,
      });
    }

    for (const capture of capturedPiecesByIdRef.current.values()) {
      const { absoluteX, absoluteY } = determineAbsoluteCoords({
        pieceId: capture.piece.id,
        x: capture.piece.x,
        y: capture.piece.y,
      });
      capturedPieces.push({
        piece: capture.piece,
        x: absoluteX,
        y: absoluteY,
        src: imageForPieceType({
          pieceType: capture.piece.type,
          isWhite: capture.piece.isWhite,
        }),
      });
    }

    return { capturedPieces, memoizedPieces };
  }, [
    isInvisibleNowAndViaMove,
    getAnimatedCoords,
    startingX,
    startingY,
    boardSizeParams,
    selectedPiece?.id,
    forceUpdate,
  ]);

  return (
    <>
      {capturedPieces.map(({ piece, x, y, src }) => {
        return (
          <CapturedPiece
            key={piece.id}
            x={x}
            y={y}
            src={src}
            pieceX={piece.x}
            pieceY={piece.y}
            size={boardSizeParams.squarePx}
          />
        );
      })}
      {memoizedPieces.map(({ piece, imageSrc, x, y, translate }) => {
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
      })}
    </>
  );
}

export default PieceDisplay;
