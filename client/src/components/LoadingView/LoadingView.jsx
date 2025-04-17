import React from "react";
import styled from "styled-components";
import HandlersContext from "../HandlersContext/HandlersContext";
import CoordsContext from "../CoordsContext/CoordsContext";
// CR nroyalty: consider zoomed out overview too?

const Wrapper = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;

  background-color: #000000;
  opacity: var(--opacity);
  transition: opacity var(--transition-time) ease-in-out;
  z-index: 1000;
  pointer-events: none;
`;

function LoadingView() {
  const { pieceHandler } = React.useContext(HandlersContext);
  const { coords } = React.useContext(CoordsContext);
  const [lastSnapshotCoords, setLastSnapshotCoords] = React.useState({
    x: null,
    y: null,
  });

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "loading-view",
      type: "coords",
      callback: ({ lastSnapshotCoords }) => {
        setLastSnapshotCoords(lastSnapshotCoords);
      },
    });
    return () => {
      pieceHandler.current.unsubscribe({ id: "loading-view", type: "coords" });
    };
  }, [pieceHandler]);

  const isLoading = React.useMemo(() => {
    if (lastSnapshotCoords.x === null || lastSnapshotCoords.y === null) {
      return true;
    }
    if (coords.x === null || coords.y === null) {
      return true;
    }
    const deltaX = Math.abs(lastSnapshotCoords.x - coords.x);
    const deltaY = Math.abs(lastSnapshotCoords.y - coords.y);
    return deltaX > 32 || deltaY > 32;
  }, [lastSnapshotCoords, coords]);

  return (
    <Wrapper
      style={{
        "--opacity": isLoading ? 0.6 : 0,
        "--transition-time": isLoading ? "0.1s" : "0.5s",
      }}
    ></Wrapper>
  );
}

export default LoadingView;
