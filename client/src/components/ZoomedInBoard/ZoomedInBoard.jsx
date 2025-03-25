import React from "react";
import styled from "styled-components";
import PanzoomBox from "../PanzoomBox/PanzoomBox";
import BoardCanvas from "../BoardCanvas/BoardCanvas";
import {
  imageForPieceType,
  TYPE_TO_NAME,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
  pieceKey,
  computeAnimationDuration,
  easeInOutSquare,
} from "../../utils";

const MAX_ANIMATION_DURATION = 1200;
const MIN_ANIMATION_DURATION = 300;
const MAX_DMOVE = 18;

const OuterWrapper = styled.div`
  position: absolute;
  inset: 0;
`;

const FullBoardCanvasWrapper = styled.canvas`
  position: absolute;
  inset: 0;
  width: var(--inner-size-width);
  height: var(--inner-size-height);
  pointer-events: none;
  cursor: pointer;
`;

function useLocalImageForPieceType() {
  const images = React.useRef({});
  const [allLoaded, setAllLoaded] = React.useState(false);
  const loadCount = React.useRef(0);

  React.useEffect(() => {
    for (const pieceType of Object.keys(TYPE_TO_NAME)) {
      for (const isWhite of [true, false]) {
        const image = imageForPieceType({ pieceType, isWhite });
        const img = new Image();
        img.src = image;
        const key = `${pieceType}-${isWhite ? "white" : "black"}`;
        images.current[key] = img;
        img.onload = () => {
          loadCount.current++;
          if (loadCount.current === Object.keys(TYPE_TO_NAME).length * 2) {
            setAllLoaded(true);
          }
        };
      }
    }
  }, []);

  const getImage = React.useCallback(
    ({ pieceType, isWhite }) => {
      return images.current[`${pieceType}-${isWhite ? "white" : "black"}`];
    },
    [images]
  );

  return { getImage, allImagesLoaded: allLoaded };
}

function useMouseCoordinates({ elt, innerSize, zoomedInParams, coords }) {
  const pos = React.useRef({
    loaded: false,
  });
  React.useEffect(() => {
    if (!elt) {
      return;
    }
    const handleMouseMove = (e) => {
      let { clientX: mouseX, clientY: mouseY } = e;
      let relativeX = Math.floor(mouseX - innerSize.left);
      let relativeY = Math.floor(mouseY - innerSize.top);
      if (
        relativeX < 0 ||
        relativeX > innerSize.width ||
        relativeY < 0 ||
        relativeY > innerSize.height
      ) {
        pos.current = {
          loaded: false,
        };
      } else {
        const absoluteMousePosition = { x: relativeX, y: relativeY };
        const { startingX, startingY } = getStartingAndEndingCoords({
          coords,
          width: zoomedInParams.numSquares,
          height: zoomedInParams.numSquares,
        });
        const canvasSquareX = Math.floor(relativeX / zoomedInParams.squareSize);
        const canvasSquareY = Math.floor(relativeY / zoomedInParams.squareSize);
        const canvasSquareCoords = {
          x: canvasSquareX,
          y: canvasSquareY,
        };
        const boardSquareX = Math.min(
          7999,
          Math.max(0, canvasSquareX + startingX)
        );
        const boardSquareY = Math.min(
          7999,
          Math.max(0, canvasSquareY + startingY)
        );
        const boardSquareCoords = {
          x: boardSquareX,
          y: boardSquareY,
        };
        pos.current = {
          absoluteMousePosition,
          canvasSquareCoords,
          boardSquareCoords,
          loaded: true,
        };
      }
    };
    elt.addEventListener("mousemove", handleMouseMove);
    return () => elt.removeEventListener("mousemove", handleMouseMove);
  }, [
    elt,
    innerSize.height,
    innerSize.left,
    innerSize.top,
    innerSize.width,
    coords,
    zoomedInParams,
  ]);
  return pos;
}

function useScaleCanvas({ canvasRef, dpr, allImagesLoaded }) {
  React.useEffect(() => {
    if (!allImagesLoaded || !canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
  }, [allImagesLoaded, canvasRef, dpr]);
}

function FullBoardCanvas({
  innerSize,
  fullBoardCanvasRef,
  allImagesLoaded,
  style,
}) {
  const dpr = React.useMemo(() => window.devicePixelRatio || 1, []);
  useScaleCanvas({ canvasRef: fullBoardCanvasRef, dpr, allImagesLoaded });
  return (
    <FullBoardCanvasWrapper
      ref={fullBoardCanvasRef}
      width={innerSize.width * dpr}
      height={innerSize.height * dpr}
      style={{
        "--inner-size-width": `${innerSize.width}px`,
        "--inner-size-height": `${innerSize.height}px`,
        ...style,
      }}
    />
  );
}

function useTogglePointerEvents({
  canvasRef,
  piecesByPositionRef,
  mouseCoordinates,
  allImagesLoaded,
  moveableSquaresRef,
}) {
  React.useEffect(() => {
    if (!canvasRef.current || !allImagesLoaded) {
      return;
    }
    const canvas = canvasRef.current;
    let rafId;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!mouseCoordinates.current.loaded) {
        canvas.style.pointerEvents = "none";
        return;
      }
      const boardSquareCoords = mouseCoordinates.current.boardSquareCoords;
      const key = pieceKey(boardSquareCoords.x, boardSquareCoords.y);
      if (
        piecesByPositionRef.current.has(key) ||
        moveableSquaresRef.current.has(key)
      ) {
        canvas.style.pointerEvents = "auto";
      } else {
        canvas.style.pointerEvents = "none";
      }
    };
    loop();
    return () => cancelAnimationFrame(rafId);
  }, [
    canvasRef,
    piecesByPositionRef,
    mouseCoordinates,
    allImagesLoaded,
    moveableSquaresRef,
  ]);
}

function StaticPieces({
  innerSize,
  zoomedInParams,
  pieceHandler,
  getImage,
  allImagesLoaded,
  mouseCoordinates,
  staticCanvasRef,
  piecesByPositionRef,
  moveableSquaresRef,
  startingX,
  startingY,
  endingX,
  endingY,
  recentMovesRef,
}) {
  //   const [pieces, setPieces] = React.useState(pieceHandler.current.getPieces());
  const [forceUpdate, setForceUpdate] = React.useState(0);
  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "static-pieces",
      callback: (data) => {
        setForceUpdate((x) => x + 1);
      },
    });
    return () => {
      pieceHandler.current.unsubscribe({ id: "static-pieces" });
    };
  }, [pieceHandler]);

  useTogglePointerEvents({
    canvasRef: staticCanvasRef,
    piecesByPositionRef,
    mouseCoordinates,
    allImagesLoaded,
    moveableSquaresRef,
  });

  React.useEffect(() => {
    if (!allImagesLoaded || !staticCanvasRef.current) {
      return;
    }

    let rafId;

    const func = () => {
      const canvas = staticCanvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, innerSize.width, innerSize.height);
      for (const piece of piecesByPositionRef.current.values()) {
        const { x: pieceX, y: pieceY } = piece;
        if (
          pieceX < startingX ||
          pieceX >= endingX ||
          pieceY < startingY ||
          pieceY >= endingY
        ) {
          continue;
        }
        if (recentMovesRef.current.has(piece.id)) {
          continue;
        }

        const image = getImage({
          pieceType: piece.type,
          isWhite: piece.isWhite,
        });
        const { x: canvasX, y: canvasY } = getScreenRelativeCoords({
          x: pieceX,
          y: pieceY,
          startingX,
          startingY,
        });
        ctx.drawImage(
          image,
          canvasX * zoomedInParams.squareSize,
          canvasY * zoomedInParams.squareSize,
          zoomedInParams.squareSize,
          zoomedInParams.squareSize
        );
      }
    };
    rafId = requestAnimationFrame(func);
    return () => cancelAnimationFrame(rafId);
  }, [
    allImagesLoaded,
    staticCanvasRef,
    getImage,
    innerSize,
    startingX,
    startingY,
    zoomedInParams.squareSize,
    endingX,
    endingY,
    recentMovesRef,
    forceUpdate,
    piecesByPositionRef,
  ]);
  return (
    <FullBoardCanvas
      innerSize={innerSize}
      fullBoardCanvasRef={staticCanvasRef}
      allImagesLoaded={allImagesLoaded}
    />
  );
}

function AnimatedPieces({
  innerSize,
  zoomedInParams,
  pieceHandler,
  getImage,
  allImagesLoaded,
  mouseCoordinates,
  staticCanvasRef,
  piecesRef,
  startingX,
  startingY,
  endingX,
  endingY,
  recentMovesRef,
}) {
  const animatedCanvasRef = React.useRef(null);
  console.log("animated pieces");

  React.useEffect(() => {
    if (!allImagesLoaded || !animatedCanvasRef.current) {
      return;
    }
    let rafId;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      const canvas = animatedCanvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, innerSize.width, innerSize.height);
      const toDelete = [];
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
          toDelete.push(move.pieceId);
          if (!staticCanvasRef.current) {
            continue;
          }
          const staticCtx = staticCanvasRef.current.getContext("2d");
          const { x: canvasX, y: canvasY } = getScreenRelativeCoords({
            x: toX,
            y: toY,
            startingX,
            startingY,
          });
          const image = getImage({
            pieceType: piece.type,
            isWhite: piece.isWhite,
          });
          staticCtx.drawImage(
            image,
            canvasX * zoomedInParams.squareSize,
            canvasY * zoomedInParams.squareSize,
            zoomedInParams.squareSize,
            zoomedInParams.squareSize
          );
        } else {
          const progress = easeInOutSquare(elapsed / animationDuration);
          const x = fromX + (toX - fromX) * progress;
          const y = fromY + (toY - fromY) * progress;
          const { x: canvasX, y: canvasY } = getScreenRelativeCoords({
            x,
            y,
            startingX,
            startingY,
          });
          if (
            canvasX < -zoomedInParams.squareSize ||
            canvasX >= innerSize.width ||
            canvasY < -zoomedInParams.squareSize ||
            canvasY >= innerSize.height
          ) {
            continue;
          }
          const image = getImage({
            pieceType: piece.type,
            isWhite: piece.isWhite,
          });
          ctx.drawImage(
            image,
            canvasX * zoomedInParams.squareSize,
            canvasY * zoomedInParams.squareSize,
            zoomedInParams.squareSize,
            zoomedInParams.squareSize
          );
        }
      }
      for (const pieceId of toDelete) {
        recentMovesRef.current.delete(pieceId);
      }
    };
    loop();
    return () => cancelAnimationFrame(rafId);
  }, [
    allImagesLoaded,
    animatedCanvasRef,
    getImage,
    innerSize.height,
    innerSize.width,
    piecesRef,
    recentMovesRef,
    startingX,
    startingY,
    staticCanvasRef,
    zoomedInParams.squareSize,
  ]);
  return (
    <FullBoardCanvas
      innerSize={innerSize}
      fullBoardCanvasRef={animatedCanvasRef}
      allImagesLoaded={allImagesLoaded}
    />
  );
}
function ZoomedInBoard({
  smallHidden,
  smallOpacity,
  coords,
  setCoords,
  innerSize,
  zoomedInParams,
  pieceHandler,
  submitMove,
}) {
  console.log("ZOOM BOARD");
  const [selectedPiece, setSelectedPiece] = React.useState(null);
  const staticCanvasRef = React.useRef(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());
  const moveableSquaresRef = React.useRef(new Set());
  const recentMovesRef = React.useRef(new Map());
  const outerWrapperRef = React.useRef(null);
  const mouseCoordinates = useMouseCoordinates({
    elt: outerWrapperRef.current,
    innerSize,
    coords,
    zoomedInParams,
  });
  const { getImage, allImagesLoaded } = useLocalImageForPieceType();
  const clearMoveableSquares = React.useCallback(() => {
    setSelectedPiece(null);
    setMoveableSquares(new Set());
    moveableSquaresRef.current = new Set();
  }, []);
  const piecesRef = React.useRef(pieceHandler.current.getPiecesById());
  const piecesByPositionRef = React.useRef(pieceHandler.current.getPieces());

  React.useEffect(() => {
    // clear moveable squares on escape
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        clearMoveableSquares();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [clearMoveableSquares]);

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "zoomed-in-board",
      callback: (data) => {
        const piecesById = new Map();
        piecesByPositionRef.current = data.pieces;
        data.pieces.forEach((piece) => {
          piecesById.set(piece.id, piece);
        });
        piecesRef.current = piecesById;
        data.recentMoves.forEach((move) => {
          recentMovesRef.current.set(move.pieceId, move);
        });
      },
    });
    return () => {
      pieceHandler.current.unsubscribe({ id: "zoomed-in-board" });
    };
  }, [pieceHandler]);

  const { startingX, startingY, endingX, endingY } = React.useMemo(
    () =>
      getStartingAndEndingCoords({
        coords,
        width: zoomedInParams.numSquares,
        height: zoomedInParams.numSquares,
      }),
    [coords, zoomedInParams]
  );

  const onClick = React.useCallback(
    (e) => {
      const { clientX, clientY } = e;
      const { startingX, startingY } = getStartingAndEndingCoords({
        coords,
        width: zoomedInParams.numSquares,
        height: zoomedInParams.numSquares,
      });
      const relativeX = clientX - innerSize.left;
      const relativeY = clientY - innerSize.top;
      const canvasSquareX = Math.floor(relativeX / zoomedInParams.squareSize);
      const canvasSquareY = Math.floor(relativeY / zoomedInParams.squareSize);
      const boardSquareX = Math.min(
        7999,
        Math.max(0, canvasSquareX + startingX)
      );
      const boardSquareY = Math.min(
        7999,
        Math.max(0, canvasSquareY + startingY)
      );
      console.log(boardSquareX, boardSquareY);
      const key = pieceKey(boardSquareX, boardSquareY);
      if (moveableSquaresRef.current.has(key)) {
        submitMove({
          piece: selectedPiece,
          toX: boardSquareX,
          toY: boardSquareY,
        });
        clearMoveableSquares();
      } else if (piecesByPositionRef.current.has(key)) {
        setSelectedPiece(piecesByPositionRef.current.get(key));
        const moveableSquares = pieceHandler.current.getMoveableSquares(
          piecesByPositionRef.current.get(key)
        );
        console.log(moveableSquares);
        setMoveableSquares(new Set(moveableSquares));
        moveableSquaresRef.current = new Set(moveableSquares);
      }
    },
    [
      coords,
      zoomedInParams.numSquares,
      zoomedInParams.squareSize,
      innerSize.left,
      innerSize.top,
      submitMove,
      selectedPiece,
      clearMoveableSquares,
      pieceHandler,
    ]
  );

  return (
    <OuterWrapper ref={outerWrapperRef} onClick={onClick}>
      <BoardCanvas
        coords={coords}
        pxWidth={innerSize.width}
        pxHeight={innerSize.height}
        numSquares={zoomedInParams.numSquares}
        borderHalfWidth={zoomedInParams.borderHalfWidth}
        pixelsPerSquare={zoomedInParams.squareSize}
        moveableSquares={moveableSquares}
        selectedPiece={selectedPiece}
        opacity={smallOpacity}
      />
      <PanzoomBox
        setCoords={setCoords}
        clearMoveableSquares={clearMoveableSquares}
        showLargeBoard={false}
      />
      <StaticPieces
        coords={coords}
        innerSize={innerSize}
        zoomedInParams={zoomedInParams}
        pieceHandler={pieceHandler}
        getImage={getImage}
        allImagesLoaded={allImagesLoaded}
        mouseCoordinates={mouseCoordinates}
        staticCanvasRef={staticCanvasRef}
        piecesByPositionRef={piecesByPositionRef}
        startingX={startingX}
        startingY={startingY}
        endingX={endingX}
        endingY={endingY}
        recentMovesRef={recentMovesRef}
        moveableSquaresRef={moveableSquaresRef}
      />
      <AnimatedPieces
        coords={coords}
        innerSize={innerSize}
        zoomedInParams={zoomedInParams}
        pieceHandler={pieceHandler}
        getImage={getImage}
        allImagesLoaded={allImagesLoaded}
        mouseCoordinates={mouseCoordinates}
        staticCanvasRef={staticCanvasRef}
        piecesRef={piecesRef}
        startingX={startingX}
        startingY={startingY}
        endingX={endingX}
        endingY={endingY}
        recentMovesRef={recentMovesRef}
      />
    </OuterWrapper>
  );
}

export default ZoomedInBoard;
