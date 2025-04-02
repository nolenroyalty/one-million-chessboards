import React from "react";

const CoordsContext = React.createContext();

export function CoordsContextProvider({
  initialX,
  initialY,
  websocket,
  children,
}) {
  const [coords, setCoords] = React.useState({ x: initialX, y: initialY });
  React.useEffect(() => {
    // CR nroyalty: debounce this...
    if (websocket) {
      websocket.send(
        JSON.stringify({
          type: "subscribe",
          centerX: coords.x,
          centerY: coords.y,
        })
      );
    }
  }, [websocket, coords]);
  const value = React.useMemo(
    () => ({ coords, setCoords }),
    [coords, setCoords]
  );

  return (
    <CoordsContext.Provider value={value}>{children}</CoordsContext.Provider>
  );
}

export default CoordsContext;
