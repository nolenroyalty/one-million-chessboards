import React from "react";

const ShowLargeBoardContext = React.createContext(false);

export function ShowLargeBoardContextProvider({ children }) {
  const [showLargeBoard, _setShowLargeBoard] = React.useState(false);
  const largeBoardKillSwitch = React.useRef(false);
  const setShowLargeBoard = React.useCallback(
    (show) => {
      _setShowLargeBoard(show);
      if (show) {
        largeBoardKillSwitch.current = false;
      } else {
        largeBoardKillSwitch.current = true;
      }
    },
    [_setShowLargeBoard]
  );

  const value = React.useMemo(
    () => ({ showLargeBoard, setShowLargeBoard, largeBoardKillSwitch }),
    [showLargeBoard, setShowLargeBoard, largeBoardKillSwitch]
  );
  return (
    <ShowLargeBoardContext.Provider value={value}>
      {children}
    </ShowLargeBoardContext.Provider>
  );
}

export default ShowLargeBoardContext;
