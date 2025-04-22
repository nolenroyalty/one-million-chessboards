import React from "react";
import { storeColorPref } from "../../utils";
import HandlersContext from "../HandlersContext/HandlersContext";

const CurrentColorContext = React.createContext(null);

export function CurrentColorProvider({ children }) {
  const [currentColor, _setCurrentColor] = React.useState({
    playingWhite: null,
  });
  const { recentCapturesHandler } = React.useContext(HandlersContext);
  const setCurrentColor = React.useCallback(
    ({ playingWhite }) => {
      console.log(`setting current color to ${playingWhite}`);
      _setCurrentColor({ playingWhite });
      storeColorPref({ playingWhite });
      recentCapturesHandler.current.setColorAndRunPollLoop({
        playingWhite,
      });
    },
    [recentCapturesHandler]
  );

  const value = React.useMemo(
    () => ({ currentColor, setCurrentColor }),
    [currentColor, setCurrentColor]
  );

  return (
    <CurrentColorContext.Provider value={value}>
      {children}
    </CurrentColorContext.Provider>
  );
}

export default CurrentColorContext;
