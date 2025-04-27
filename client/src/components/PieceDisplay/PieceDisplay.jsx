import React from "react";
import styled, { keyframes } from "styled-components";
import HandlersContext from "../HandlersContext/HandlersContext";
import CoordsContext from "../CoordsContext/CoordsContext";
import SelectedPieceAndSquaresContext from "../SelectedPieceAndSquaresContext/SelectedPieceAndSquaresContext";
import CurrentColorContext from "../CurrentColorProvider/CurrentColorProvider";

import { Axe } from "lucide-react";
import {
  imageForPieceType,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  easeInOutSquare,
  computeAnimationDuration,
  getZoomedInScreenAbsoluteCoords,
  TYPE_TO_NAME,
} from "../../utils";
import { RESPECT_COLOR_REQUIREMENT } from "../../constants";

const MAX_ANIMATION_DURATION = 750;
const MIN_ANIMATION_DURATION = 350;
const MAX_DMOVE = 15;
const CAPTURE_ANIMATION_DURATION = 450;

const KILL_COUNT_THRESHOLDS = {
  minor: 25,
  medium: 50,
  mega: 250,
  godlike: 1000,
};

const PieceImg = styled.img`
  width: var(--size);
  height: var(--size);
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;

  transform-origin: center;
  transform: var(--transform);
  &:hover {
    transform: scale(var(--hover-scale));
  }

  &[data-captured="true"] {
    transform: unset;
  }
  /* filter: url(#colorRemap) url(#binaryRemap); */
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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
  /* transition: opacity 0.3s ease; */
  /* it'd be nice to have some delay here but it interacts weirdly with all
  the other animation stuff we do */
  transition: opacity 0.3s cubic-bezier(0.33, 1, 0.68, 1);

  &[data-just-appeared="true"] {
    /* transition: opacity 0.3s ease; */
    animation: ${fadeIn} 0.3s ease;
  }

  &[data-captured="true"] {
    pointer-events: none;
    animation: unset;
    cursor: none;
    opacity: 0;
  }

  &[data-hiding-all="true"] {
    opacity: 0 !important;
  }

  & svg {
    transform: var(--axe-transform);
  }

  &:hover > svg {
    transform: scale(var(--axe-hover-scale));
  }
`;

function _Piece({
  src,
  dataId,
  size,
  hidden,
  opacity,
  selected,
  translate,
  savePieceRef,
  maybeHandlePieceClick,
  captured,
  moveable,
  captureCount,
  justAppeared,
  isWhite,
}) {
  const style = React.useMemo(() => {
    const defaultCursor = moveable ? "pointer" : "default";
    return {
      "--size": `${size}px`,
      transform: translate,
      "--pointer-events": hidden || captured ? "none" : "auto",
      "--cursor": hidden || captured ? "none" : defaultCursor,
      "--axe-hover-scale": moveable ? 1.2 : 1,
      "--axe-transform": moveable && selected ? "scale(1.2)" : "scale(1)",
    };
  }, [size, translate, captured, hidden, moveable, selected]);

  const imgStyle = React.useMemo(() => {
    return {
      "--transform": moveable && selected ? "scale(1.12)" : "scale(1)",
      "--hover-scale": moveable ? 1.12 : 1,
    };
  }, [selected, moveable]);

  const onClick = React.useCallback(() => {
    if (captured) {
      return;
    }
    maybeHandlePieceClick(dataId);
  }, [captured, maybeHandlePieceClick, dataId]);

  const refFunc = React.useCallback(
    (el) => {
      savePieceRef(dataId, el);
    },
    [savePieceRef, dataId]
  );

  let killsFillColor = null;
  if (captureCount >= KILL_COUNT_THRESHOLDS.godlike) {
    killsFillColor = "var(--color-purple-600)";
  } else if (captureCount >= KILL_COUNT_THRESHOLDS.mega) {
    killsFillColor = "var(--color-blue-500)";
  } else if (captureCount >= KILL_COUNT_THRESHOLDS.medium) {
    killsFillColor = "var(--color-emerald-600)";
  } else if (captureCount >= KILL_COUNT_THRESHOLDS.minor) {
    if (isWhite) {
      killsFillColor = "var(--color-gray-400)";
    } else {
      killsFillColor = "var(--color-gray-200)";
    }
  }

  let KillsIcon = null;
  if (killsFillColor) {
    KillsIcon = (
      <Axe
        size={16}
        strokeWidth={2}
        fill={killsFillColor}
        color="var(--color-neutral-900)"
        style={{
          position: "absolute",
          bottom: "1px",
          right: "1px",
          pointerEvents: "none",
          transition: "transform 0.3s ease",
          transformOrigin: "top left",
        }}
      />
    );
  }

  return (
    <PieceButtonWrapper
      data-id={dataId}
      data-captured={captured}
      data-just-appeared={justAppeared && !captured}
      disabled={captured}
      data-hiding-all={opacity === 0}
      // it's important that we use an inline style here because it lets
      // us override that style from our animation handler and then automatically
      // remove that overridden style when we re-render the piece
      style={style}
      onClick={onClick}
      ref={refFunc}
    >
      <PieceImg
        className="chess-piece"
        src={src}
        style={imgStyle}
        data-captured={captured}
        draggable={false}
      />
      {KillsIcon}
    </PieceButtonWrapper>
  );
}

const Piece = React.memo(_Piece);

function makeMoveAnimationState(move) {
  const animationDuration = computeAnimationDuration({
    moveDistance: Math.hypot(
      move.piece.x - move.fromX,
      move.piece.y - move.fromY
    ),
    maxAnimationDuration: MAX_ANIMATION_DURATION,
    minAnimationDuration: MIN_ANIMATION_DURATION,
    maxMoveDistance: MAX_DMOVE,
  });
  const endTime = move.receivedAt + animationDuration;
  // we allow noops to make the case that a piece appears and then moves
  // much smoother. It's an artifact of a previous implementation and there's
  // a chance we don't actually need it anymore, but it's cheap to support.
  const noop = move.fromX === move.piece.x && move.fromY === move.piece.y;
  const ret = {
    fromX: move.fromX,
    fromY: move.fromY,
    toX: move.piece.x,
    toY: move.piece.y,
    pieceId: move.piece.id,
    endTime,
    animationDuration,
    receivedAt: move.receivedAt,
    noop,
  };
  return ret;
}

function PieceDisplay({ boardSizeParams, hidden, opacity }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const { coords } = React.useContext(CoordsContext);
  const { selectedPiece, setSelectedPiece, clearSelectedPieceForId } =
    React.useContext(SelectedPieceAndSquaresContext);
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
  const { currentColor } = React.useContext(CurrentColorContext);
  const recentMoveByPieceIdRef = React.useRef(new Map());

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

  const getVisiblePiecesById = React.useCallback(
    ({ pieceIds, getPieceById }) => {
      const map = new Map();
      for (const pieceId of pieceIds) {
        const piece = getPieceById(pieceId);
        if (piece) {
          if (isInvisibleNowAndViaMove({ piece })) {
            continue;
          } else {
            map.set(pieceId, piece);
          }
        }
      }
      return map;
    },
    [isInvisibleNowAndViaMove]
  );

  const visiblePiecesAndIdsRef = React.useRef(
    getVisiblePiecesById({
      pieceIds: pieceHandler.current.getAllPieceIds(),
      getPieceById: (id) => pieceHandler.current.getPieceById(id),
    })
  );

  const getAnimatedCoords = React.useCallback(({ pieceId, now }) => {
    const recentMove = recentMoveByPieceIdRef.current.get(pieceId);
    if (recentMove) {
      const {
        fromX,
        fromY,
        toX,
        toY,
        receivedAt,
        endTime,
        animationDuration,
        noop,
      } = recentMove;
      if (now > endTime) {
        return { x: toX, y: toY, noop, finished: true };
      }
      const elapsed = now - receivedAt;
      const progress = easeInOutSquare(elapsed / animationDuration);
      const x = fromX + (toX - fromX) * progress;
      const y = fromY + (toY - fromY) * progress;
      return { x, y, finished: false, noop };
    }
    return null;
  }, []);

  React.useEffect(() => {
    // it's annoying, but we need to update the visible set of pieces as we pan around the board
    // (and we also need to update our subscription, since it relies on our visibility knowledge)
    // CR-someday nroyalty: I'm nervous that when we unsubscribe and resubscribe we risk losing piece updates?
    // Figure out how that works (I guess it's not the end of the world - we'd just see a few jumps
    // or disappearances)
    //
    // We could try pushing more state into a ref so that we don't need to unsub and resub here though,
    // which would potentially make panning around less scary!!
    visiblePiecesAndIdsRef.current = getVisiblePiecesById({
      pieceIds: pieceHandler.current.getAllPieceIds(),
      getPieceById: (id) => pieceHandler.current.getPieceById(id),
    });

    setForceUpdate((prev) => prev + 1);

    pieceHandler.current.subscribe({
      id: "piece-display",
      type: "pieces",
      callback: (data) => {
        // we do an update if we need to re-render the visible pieces because
        // a move has made a piece visible, because an appearance is within the visible
        // window, or because a capture is within the visible window and is associated
        // with a piece that we're already displaying
        let doUpdate = false;
        const capturesToAdd = [];
        const movesToAdd = [];
        const appearancesToAdd = [];
        const newVisiblePiecesAndIds = getVisiblePiecesById({
          pieceIds: data.pieceIds,
          getPieceById: (id) => pieceHandler.current.getPieceById(id),
        });

        data.moves.forEach((move) => {
          const movedPiece = move.piece;
          const wasVisible = visiblePiecesAndIdsRef.current.has(movedPiece.id);
          const oldPiece = visiblePiecesAndIdsRef.current.get(movedPiece.id);
          if (oldPiece) {
            // nroyalty: in the past, we mutated the old piece in the case that
            // we were moving it off screen. I'm not actually sure why we did this?
            // it creates bugs when we revert a move
            // Just in case, override move's fromX and fromY with the coords of the currently
            // move = { ...move, fromX: oldPiece.x, fromY: oldPiece.y };
            // oldPiece.x = move.piece.x;
            // oldPiece.y = move.piece.y;
            if (TYPE_TO_NAME[movedPiece.type] === "promotedPawn") {
              const alreadyPromoted =
                TYPE_TO_NAME[oldPiece.type] === "promotedPawn";
              if (!alreadyPromoted) {
                doUpdate = true;
              }
            }
            if (TYPE_TO_NAME[oldPiece.type] === "promotedPawn") {
              const notPromotedNow =
                TYPE_TO_NAME[movedPiece.type] !== "promotedPawn";
              if (notPromotedNow) {
                doUpdate = true;
              }
            }
          }
          const endedVisible = !isNotVisible({
            x: movedPiece.x,
            y: movedPiece.y,
          });
          if (wasVisible && !endedVisible) {
            // The piece moves off the screen here. We MUST add the piece to
            // our visible pieces ref - otherwise the piece may just disappear!
            newVisiblePiecesAndIds.set(movedPiece.id, movedPiece);
            movesToAdd.push(move);
          } else if (wasVisible && endedVisible) {
            // nothing special to do here...we already have a piece, just animate it
            movesToAdd.push(move);
          } else if (!wasVisible && endedVisible) {
            movesToAdd.push(move);
            // Make sure that we re-render because we have a new piece to display
            doUpdate = true;
          }
          //   if (wasVisible && (startedVisible || endedVisible)) {
          //     // Already rendered, move is visible, do animation
          //     const oldPiece = visiblePiecesAndIdsRef.current.get(move.pieceId);
          //     oldPiece.x = move.toX;
          //     oldPiece.y = move.toY;
          //     // This is critical - without this, the piece may disappear instead of
          //     // smoothly moving off screen!
          //     newVisiblePiecesAndIds.set(move.pieceId, oldPiece);
          //     movesToAdd.push(move);
          //   } else if (!wasVisible && endedVisible) {
          //     movesToAdd.push(move);
          //     doUpdate = true;
          //   } else if (!wasVisible && startedVisible) {
          //     // Potential bug - this piece should have been visible, but it wasn't!
          //     console.warn(
          //       `Not displaying move because we don't have a piece for it: ${JSON.stringify(move)})`
          //     );
          //     movesToAdd.push(move);
          //   }
        });

        data.captures.forEach((capture) => {
          const capturedPiece = capture.piece;
          const captureVisible = !isNotVisible({
            x: capturedPiece.x,
            y: capturedPiece.y,
          });
          const ourPiece = visiblePiecesAndIdsRef.current.get(capturedPiece.id);
          if (ourPiece && captureVisible) {
            capturesToAdd.push({
              receivedAt: capture.receivedAt,
              piece: ourPiece,
            });
            doUpdate = true;
          }
        });

        data.appearances.forEach((appearance) => {
          const appearedPiece = appearance.piece;
          const ourPiece = visiblePiecesAndIdsRef.current.get(appearedPiece.id);
          const weThinkItIsCaptured = capturedPiecesByIdRef.current.has(
            appearedPiece.id
          );
          if ((ourPiece && weThinkItIsCaptured) || !ourPiece) {
            capturedPiecesByIdRef.current.delete(appearedPiece.id);
            const appearedVisible = !isNotVisible({
              x: appearedPiece.x,
              y: appearedPiece.y,
            });
            if (appearedVisible) {
              doUpdate = true;
              appearancesToAdd.push(appearance);
            }
          } else if (ourPiece) {
            // Nothing to do? Piece appeared but we already know about it?
            console.warn(
              `A piece claimed to have appeared but we already know about it? ${JSON.stringify(appearance)}`
            );
          }
        });

        const now = performance.now();
        visiblePiecesAndIdsRef.current = newVisiblePiecesAndIds;

        movesToAdd.forEach((move) => {
          clearSelectedPieceForId(move.piece.id);

          if (capturedPiecesByIdRef.current.has(move.piece.id)) {
            console.log(`un-deleting piece ${move.piece.id}`);
            capturedPiecesByIdRef.current.delete(move.piece.id);
          }

          let animationState;

          const prevAnimationState = getAnimatedCoords({
            pieceId: move.piece.id,
            now,
          });
          if (prevAnimationState && !prevAnimationState.finished) {
            const fakeMove = {
              ...move,
              fromX: prevAnimationState.x,
              fromY: prevAnimationState.y,
            };
            animationState = makeMoveAnimationState(fakeMove);
          } else {
            animationState = makeMoveAnimationState(move);
          }
          recentMoveByPieceIdRef.current.set(move.piece.id, animationState);
        });

        if (capturesToAdd.length > 0) {
          capturesToAdd.forEach((capture) => {
            clearSelectedPieceForId(capture.piece.id);
            capturedPiecesByIdRef.current.set(capture.piece.id, capture);
          });
          for (const id of capturedPiecesByIdRef.current.keys()) {
            const capture = capturedPiecesByIdRef.current.get(id);
            if (now - capture.receivedAt > CAPTURE_ANIMATION_DURATION) {
              capturedPiecesByIdRef.current.delete(id);
            }
          }
        }

        appearancesToAdd.forEach((appearance) => {
          const fakeMove = {
            fromX: appearance.piece.x,
            fromY: appearance.piece.y,
            piece: appearance.piece,
            receivedAt: appearance.receivedAt,
          };
          const p = newVisiblePiecesAndIds.get(appearance.piece.id);
          if (p) {
            p.appearanceTime = appearance.receivedAt;
          }

          if (capturedPiecesByIdRef.current.has(appearance.piece.id)) {
            console.log(`un-deleting piece ${appearance.piece.id}`);
            capturedPiecesByIdRef.current.delete(appearance.piece.id);
          }
          const animationState = makeMoveAnimationState(fakeMove);
          recentMoveByPieceIdRef.current.set(
            appearance.piece.id,
            animationState
          );
        });

        if (doUpdate) {
          setForceUpdate((prev) => prev + 1);
        }
      },
    });

    return () => {
      pieceHandler.current.unsubscribe({
        type: "pieces",
        id: "piece-display",
      });
    };
  }, [
    clearSelectedPieceForId,
    getAnimatedCoords,
    getVisiblePiecesById,
    isNotVisible,
    pieceHandler,
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
        const newX = Math.round(absoluteX * 100) / 100;
        const newY = Math.round(absoluteY * 100) / 100;
        const lastX = ref.__lastX || -Infinity;
        const lastY = ref.__lastY || -Infinity;
        if (lastX !== newX || lastY !== newY) {
          ref.style.transform = `translate(${newX}px, ${newY}px)`;
          ref.__lastX = newX;
          ref.__lastY = newY;
        }
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
        if (!maybeAnimated.noop) {
          const { x: animatedX, y: animatedY } = maybeAnimated;
          const { x, y } = getScreenRelativeCoords({
            x: animatedX,
            y: animatedY,
            startingX,
            startingY,
          });
          maybeSetRefTransform(ref, x, y);
        }
        if (!maybeAnimated.finished) {
          toKeep.set(move.pieceId, move);
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
    let shutupForceUpdate = forceUpdate;
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

    const visibleIds = visiblePiecesAndIdsRef.current.keys();
    const capturedIds = capturedPiecesByIdRef.current.keys();
    const allIds = new Set([...visibleIds, ...capturedIds]);

    for (const pieceId of allIds) {
      let piece, captured, selected;

      // If it's in both that's not great, but we should assume it is
      // captured!
      if (capturedPiecesByIdRef.current.has(pieceId)) {
        piece = capturedPiecesByIdRef.current.get(pieceId).piece;
        captured = true;
        selected = false;
      } else if (visiblePiecesAndIdsRef.current.has(pieceId)) {
        piece = visiblePiecesAndIdsRef.current.get(pieceId);
        captured = false;
        selected = piece.id === selectedPiece?.id;
      }

      if (isInvisibleNowAndViaMove({ piece })) {
        continue;
      }
      const { absoluteX, absoluteY } = determineAbsoluteCoords({
        pieceId: piece.id,
        x: piece.x,
        y: piece.y,
      });

      let moveable = RESPECT_COLOR_REQUIREMENT
        ? piece.isWhite === currentColor.playingWhite
        : true;
      if (captured) {
        moveable = false;
      }

      const justAppeared =
        piece.appearanceTime && piece.appearanceTime > now - 500;

      memoizedPieces.push({
        piece,
        imageSrc: imageForPieceType({
          pieceType: piece.type,
          isWhite: piece.isWhite,
        }),
        translate: `translate(${absoluteX}px, ${absoluteY}px)`,
        selected,
        captured,
        moveable,
        justAppeared,
      });
    }

    memoizedPieces.sort((a, b) => {
      return a.piece.id - b.piece.id;
    });

    return memoizedPieces;
  }, [
    forceUpdate,
    getAnimatedCoords,
    startingX,
    startingY,
    boardSizeParams,
    isInvisibleNowAndViaMove,
    currentColor.playingWhite,
    selectedPiece?.id,
  ]);

  return memoizedPieces.map(
    ({ piece, imageSrc, translate, captured, moveable, justAppeared }) => {
      return (
        <Piece
          key={piece.id}
          savePieceRef={savePieceRef}
          src={imageSrc}
          dataId={piece.id}
          translate={translate}
          size={boardSizeParams.squarePx}
          hidden={hidden}
          opacity={opacity}
          maybeHandlePieceClick={maybeHandlePieceClick}
          selected={piece.id === selectedPiece?.id}
          captured={captured}
          moveable={moveable}
          justAppeared={justAppeared}
          captureCount={piece.captureCount}
          isWhite={piece.isWhite}
        />
      );
    }
  );
}

export default PieceDisplay;
