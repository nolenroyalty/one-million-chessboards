import React from "react";
import { clamp, computeInitialArguments } from "../../utils";

const CoordsContext = React.createContext();

const MIN_COORD = 2;
const MAX_COORD = 7997;

export function CoordsContextProvider({ children }) {
  const initialArgs = React.useMemo(computeInitialArguments, []);

  const [coords, setRawCoords] = React.useState({
    x: initialArgs.x,
    y: initialArgs.y,
  });

  const setCoords = React.useCallback((newCoordsOrFn) => {
    setRawCoords((prev) => {
      const newCoords =
        typeof newCoordsOrFn === "function"
          ? newCoordsOrFn(prev)
          : newCoordsOrFn;
      const x = clamp(newCoords.x, MIN_COORD, MAX_COORD);
      const y = clamp(newCoords.y, MIN_COORD, MAX_COORD);
      const url = new URL(window.location.href);
      url.hash = `${x},${y}`;
      window.history.replaceState({}, "", url);
      return {
        x,
        y,
      };
    });
  }, []);

  const value = React.useMemo(
    () => ({ coords, setCoords }),
    [coords, setCoords]
  );

  return (
    <CoordsContext.Provider value={value}>{children}</CoordsContext.Provider>
  );
}

export default CoordsContext;
