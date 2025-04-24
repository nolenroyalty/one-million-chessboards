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
  transition: opacity var(--transition-time) ease-in-out var(--transition-delay);
  z-index: 1000;
  pointer-events: none;
`;

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

  const isLoading = React.useMemo(() => {
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

  const transitionDelay = React.useMemo(() => {
    if (!isLoading) {
      return "0s";
    } else {
      if (lastTransitionDebounceDelay < 200) {
        return "0.2s";
      } else {
        return "0s";
      }
    }
  }, [isLoading, lastTransitionDebounceDelay]);

  return (
    <Wrapper
      style={{
        "--opacity": isLoading ? 0.8 : 0,
        "--transition-time": isLoading ? "0.225s" : "0.2s",
        "--transition-delay": transitionDelay,
      }}
    ></Wrapper>
  );
}

export default LoadingView;
