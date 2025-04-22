import React from "react";
import MinimapHandler from "../../minimapHandler.js";
import StatsHandler from "../../statsHandler.js";
import PieceHandler from "../../pieceHandlerNewer.js";
import RecentCapturesHandler from "../../recentCapturesHandler.js";
const HandlersContext = React.createContext();

export function HandlersContextProvider({ children }) {
  const statsHandler = React.useRef(new StatsHandler());
  const pieceHandler = React.useRef(
    new PieceHandler({ statsHandler: statsHandler.current })
  );
  const minimapHandler = React.useRef(new MinimapHandler());
  const recentCapturesHandler = React.useRef(new RecentCapturesHandler());

  React.useEffect(() => {
    const sh = statsHandler.current;
    const mh = minimapHandler.current;
    const rch = recentCapturesHandler.current;
    sh.runPollLoop();
    mh.runPollLoop();
    return () => {
      sh.stopPollLoop();
      mh.stopPollLoop();
      rch.stopPollLoop();
    };
  }, []);

  const handlers = React.useMemo(
    () => ({
      pieceHandler,
      minimapHandler,
      recentCapturesHandler,
      statsHandler,
    }),
    [pieceHandler, minimapHandler, recentCapturesHandler, statsHandler]
  );

  return (
    <HandlersContext.Provider value={handlers}>
      {children}
    </HandlersContext.Provider>
  );
}

export default HandlersContext;
