import React from "react";
import { clamp, computeInitialArguments } from "../../utils";
import { useHash } from "../../hooks/use-hash";

const CoordsContext = React.createContext();

const MIN_COORD = 2;
const MAX_COORD = 7997;

export function CoordsContextProvider({ children }) {
  const initialArgs = React.useMemo(computeInitialArguments, []);
  const replaceStateTimeoutRef = React.useRef(null);

  const [coords, setRawCoords] = React.useState({
    x: initialArgs.x,
    y: initialArgs.y,
  });

  const hash = useHash();
  React.useEffect(() => {
    if (hash && hash !== "") {
      const initialArgs = computeInitialArguments(hash);
      const { x, y } = initialArgs;
      if (x === null || y === null) {
        return;
      }
      setRawCoords({ x, y }, false);
    }
  }, [hash]);

  const setCoords = React.useCallback((newCoordsOrFn, updateHash = true) => {
    setRawCoords((prev) => {
      const newCoords =
        typeof newCoordsOrFn === "function"
          ? newCoordsOrFn(prev)
          : newCoordsOrFn;
      if (newCoords.x === null || newCoords.y === null) {
        return prev;
      }
      const x = clamp(newCoords.x, MIN_COORD, MAX_COORD);
      const y = clamp(newCoords.y, MIN_COORD, MAX_COORD);

      if (updateHash) {
        clearTimeout(replaceStateTimeoutRef.current);
        replaceStateTimeoutRef.current = setTimeout(() => {
          // we get a security error if we don't debounce this lol
          const url = new URL(window.location.href);
          url.hash = `${x},${y}`;
          window.history.replaceState({}, "", url);
        }, 120);
      }
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
