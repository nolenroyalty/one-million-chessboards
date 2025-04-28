import React from "react";
import MinimapHandler from "../../minimapHandler.js";
import StatsHandler from "../../statsHandler.js";
import PieceHandler from "../../pieceHandler.js";
import RecentCapturesHandler from "../../recentCapturesHandler.js";
import GameOverContext from "../GameOverContext/GameOverContext";
const HandlersContext = React.createContext();

export function HandlersContextProvider({ children }) {
  const { setGameOver } = React.useContext(GameOverContext);
  const statsHandler = React.useRef(new StatsHandler({ setGameOver }));

  React.useEffect(() => {
    statsHandler.current.setGameOver = setGameOver;
  }, [setGameOver]);

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
    // rch runs a poll loop after we know our color
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
