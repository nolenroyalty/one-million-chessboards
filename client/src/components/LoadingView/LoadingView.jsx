import React from "react";
import styled from "styled-components";
import HandlersContext from "../HandlersContext/HandlersContext";
import CoordsContext from "../CoordsContext/CoordsContext";
import ShowLargeBoardContext from "../ShowLargeBoardContext/ShowLargeBoardContext";
import LastTransitionDebounceDelayContext from "../LastTransitionDebounceDelayContext/LastTransitionDebounceDelayContext";
const Wrapper = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;

  background-color: var(--color-neutral-950);
  opacity: var(--opacity);
  transition: opacity 0.2s ease-in-out;
  z-index: 1000;
  pointer-events: none;
`;

const SHOW_DELAY_MS = 150;
const MIN_DISPLAY_TIME_MS = 350;

function LoadingView({ boardSizeParams }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const { coords } = React.useContext(CoordsContext);
  const [lastSnapshotCoords, setLastSnapshotCoords] = React.useState({
    x: null,
    y: null,
  });
  const { showLargeBoard } = React.useContext(ShowLargeBoardContext);
  const { lastTransitionDebounceDelay } = React.useContext(
    LastTransitionDebounceDelayContext
  );
  const [showOverlay, setShowOverlay] = React.useState(false);
  const showTimerRef = React.useRef(null);
  const hideTimerRef = React.useRef(null);
  const overlayShowTimerRef = React.useRef(null);

  React.useEffect(() => {
    let ph = pieceHandler.current;
    ph.subscribe({
      id: "loading-view",
      type: "coords",
      callback: ({ lastSnapshotCoords }) => {
        // callback is immediately invoked, so no need to set manually
        setLastSnapshotCoords(lastSnapshotCoords);
      },
    });
    return () => {
      ph.unsubscribe({ id: "loading-view", type: "coords" });
    };
  }, [pieceHandler]);

  const isLogicallyLoading = React.useMemo(() => {
    const SNAPSHOT_HALF_WIDTH = 47;
    if (lastSnapshotCoords.x === null || lastSnapshotCoords.y === null) {
      return true;
    }
    if (coords.x === null || coords.y === null) {
      return true;
    }
    const halfWidth = showLargeBoard
      ? Math.floor(boardSizeParams.zoomedOut.squaresWide / 2)
      : Math.floor(boardSizeParams.squareWidth / 2);
    const halfHeight = showLargeBoard
      ? Math.floor(boardSizeParams.zoomedOut.squaresHigh / 2)
      : Math.floor(boardSizeParams.squareHeight / 2);
    const deltaX = Math.abs(lastSnapshotCoords.x - coords.x);
    const deltaY = Math.abs(lastSnapshotCoords.y - coords.y);
    const xThreshold = SNAPSHOT_HALF_WIDTH - halfWidth;
    const yThreshold = SNAPSHOT_HALF_WIDTH - halfHeight;
    return deltaX > xThreshold || deltaY > yThreshold;
  }, [lastSnapshotCoords, coords, showLargeBoard, boardSizeParams]);

  React.useEffect(() => {
    if (isLogicallyLoading) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // 1. we aren't showing the overlay yet
      // 2. we don't have a timer running to show the overlay
      // So set the timer (or show it immediately if we know we'll need to)
      if (!showOverlay && !showTimerRef.current) {
        if (lastTransitionDebounceDelay >= SHOW_DELAY_MS) {
          setShowOverlay(true);
          overlayShowTimerRef.current = performance.now();
        } else {
          showTimerRef.current = setTimeout(() => {
            setShowOverlay(true);
            overlayShowTimerRef.current = performance.now();
            showTimerRef.current = null;
          }, SHOW_DELAY_MS);
        }
      }
    } else {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      // We're showing the overlay AND we don't have a timer running to hide it.
      if (showOverlay && !hideTimerRef.current) {
        const timeSinceShown = performance.now() - overlayShowTimerRef.current;
        // We've already shown it for long enough
        if (timeSinceShown >= MIN_DISPLAY_TIME_MS) {
          setShowOverlay(false);
          hideTimerRef.current = null;
          overlayShowTimerRef.current = null;
        } else {
          const delayRemaining = MIN_DISPLAY_TIME_MS - timeSinceShown;
          hideTimerRef.current = setTimeout(() => {
            setShowOverlay(false);
            hideTimerRef.current = null;
            overlayShowTimerRef.current = null;
          }, delayRemaining);
        }
      }
    }
  }, [isLogicallyLoading, lastTransitionDebounceDelay, showOverlay]);

  return (
    <Wrapper
      style={{
        "--opacity": showOverlay ? 0.8 : 0,
      }}
    ></Wrapper>
  );
}

export default LoadingView;
