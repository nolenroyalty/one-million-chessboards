import React from "react";
import HandlersContext from "../HandlersContext/HandlersContext";
import CoordsContext from "../CoordsContext/CoordsContext";
import ShowLargeBoardContext from "../ShowLargeBoardContext/ShowLargeBoardContext";

const LogicallyLoadingContext = React.createContext();

function LogicallyLoadingProvider({ boardSizeParams, children }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const { coords } = React.useContext(CoordsContext);
  const [lastSnapshotCoords, setLastSnapshotCoords] = React.useState({
    x: null,
    y: null,
  });
  const { showLargeBoard } = React.useContext(ShowLargeBoardContext);
  const [recentlyLogicallyLoading, setRecentlyLogicallyLoading] =
    React.useState(false);
  const recentlyLogicallyLoadingTimeoutRef = React.useRef(null);

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

  // nroyalty: I don't think we need this anymore...
  React.useEffect(() => {
    if (isLogicallyLoading) {
      if (recentlyLogicallyLoadingTimeoutRef.current) {
        clearTimeout(recentlyLogicallyLoadingTimeoutRef.current);
      }
      setRecentlyLogicallyLoading(true);
    } else {
      if (recentlyLogicallyLoadingTimeoutRef.current) {
        clearTimeout(recentlyLogicallyLoadingTimeoutRef.current);
      }
      recentlyLogicallyLoadingTimeoutRef.current = setTimeout(() => {
        setRecentlyLogicallyLoading(false);
      }, 30);
    }
  }, [isLogicallyLoading]);

  const value = React.useMemo(
    () => ({
      isLogicallyLoading,
      recentlyLogicallyLoading,
    }),
    [isLogicallyLoading, recentlyLogicallyLoading]
  );

  return (
    <LogicallyLoadingContext.Provider value={value}>
      {children}
    </LogicallyLoadingContext.Provider>
  );
}

export { LogicallyLoadingProvider };
export default LogicallyLoadingContext;
