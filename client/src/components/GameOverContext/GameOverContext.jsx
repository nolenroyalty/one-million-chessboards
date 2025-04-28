import React from "react";

const GameOverContext = React.createContext();

function GameOverContextProvider({ children }) {
  const [gameOver, setGameOver] = React.useState({ over: false, winner: "" });

  const value = React.useMemo(
    () => ({ gameOver, setGameOver }),
    [gameOver, setGameOver]
  );

  return (
    <GameOverContext.Provider value={value}>
      {children}
    </GameOverContext.Provider>
  );
}

export default GameOverContext;
export { GameOverContextProvider };
