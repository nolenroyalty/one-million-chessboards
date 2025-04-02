import React from "react";

const HandlersContext = React.createContext();

export function HandlersContextProvider({
  statsHandler,
  pieceHandler,
  minimapHandler,
  children,
}) {
  const handlers = React.useMemo(
    () => ({
      pieceHandler,
      minimapHandler,
      statsHandler,
    }),
    [pieceHandler, minimapHandler, statsHandler]
  );

  return (
    <HandlersContext.Provider value={handlers}>
      {children}
    </HandlersContext.Provider>
  );
}

export default HandlersContext;
