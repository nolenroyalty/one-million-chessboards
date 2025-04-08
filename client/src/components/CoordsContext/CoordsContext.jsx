import React from "react";
import { clamp } from "../../utils";

const CoordsContext = React.createContext();

const MIN_COORD = 2;
const MAX_COORD = 7997;

export function CoordsContextProvider({
  initialX,
  initialY,
  safelySendJSON,
  connected,
  children,
}) {
  const [coords, setRawCoords] = React.useState({ x: initialX, y: initialY });

  const setCoords = React.useCallback((newCoordsOrFn) => {
    setRawCoords((prev) => {
      const newCoords =
        typeof newCoordsOrFn === "function"
          ? newCoordsOrFn(prev)
          : newCoordsOrFn;
      return {
        x: clamp(newCoords.x, MIN_COORD, MAX_COORD),
        y: clamp(newCoords.y, MIN_COORD, MAX_COORD),
      };
    });
  }, []);

  React.useEffect(() => {
    // CR nroyalty: debounce this...
    console.log("CONNECTED?", connected);
    if (connected) {
      safelySendJSON({
        type: "subscribe",
        centerX: coords.x,
        centerY: coords.y,
      });
    }
  }, [coords, safelySendJSON, connected]);

  const value = React.useMemo(
    () => ({ coords, setCoords }),
    [coords, setCoords]
  );

  return (
    <CoordsContext.Provider value={value}>{children}</CoordsContext.Provider>
  );
}

export default CoordsContext;
