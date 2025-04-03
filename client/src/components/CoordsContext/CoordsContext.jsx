import React from "react";

const CoordsContext = React.createContext();

export function CoordsContextProvider({
  initialX,
  initialY,
  safelySendJSON,
  connected,
  children,
}) {
  const [coords, setCoords] = React.useState({ x: initialX, y: initialY });
  React.useEffect(() => {
    // CR nroyalty: debounce this...
    safelySendJSON({
      type: "subscribe",
      centerX: coords.x,
      centerY: coords.y,
    });
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
