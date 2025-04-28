import React from "react";
import styled from "styled-components";
import { WebsocketContext } from "../WebsocketProvider/WebsocketProvider";
import GameOverContext from "../GameOverContext/GameOverContext";
import { QUERY } from "../../constants";

const Wrapper = styled.div`
  /* width: calc(100% + 2 * var(--main-side-padding)); */
  width: 100%;
  height: 2rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  /* margin-left: calc(-1 * var(--main-side-padding)); */
  /* margin-right: calc(-1 * var(--main-side-padding)); */
  /* padding: 0 var(--main-side-padding); */
  border-bottom: 1px solid var(--color-sky-700);
  margin-bottom: 0.25rem;
  position: relative;
`;

const Title = styled.a`
  color: var(--color-neutral-400);
  font-family: "Sunset Demi";
  text-decoration: none;
  cursor: pointer;

  &:visited {
    color: var(--color-neutral-400);
  }

  &:hover {
    color: var(--color-neutral-400);
  }
`;

const DisconnectedDiv = styled.div`
  position: absolute;
  top: 0%;
  left: 50%;
  transform: translate(-50%, var(--translate-y));
  background-color: var(--background-color);
  color: var(--color-neutral-100);
  padding: 0.25rem 0.5rem;
  border-radius: 0 0 0.25rem 0.25rem;
  transition:
    transform 0.5s ease-in-out 1.5s,
    background-color 0.5s ease-in-out 0.2s;
  min-width: 13ch;
  text-align: center;
  user-select: none;
  z-index: 99;
`;

const GameOverDivHeader = styled.p`
  font-size: 1.5rem;
  text-align: center;
`;

const GameOverDivBody = styled.p`
  font-size: 1rem;
  text-align: left;
`;

const HideButton = styled.button`
  all: unset;
  cursor: pointer;
`;

const GameOverDiv = styled.div`
  position: absolute;
  top: 0%;
  left: 50%;
  transform: translate(-50%, var(--translate-y));
  background-color: var(--background-color);
  color: var(--text-color);
  padding: 0.5rem 1rem;
  border-radius: 0 0 0.25rem 0.25rem;
  transition: transform 0.5s ease-in-out;
  min-width: 38ch;
  max-width: 38ch;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 100;
  border: 1px solid var(--border-color);
  border-top: none;

  @media (${QUERY.VERY_SMALL}) {
    width: 100%;
    max-width: 100%;
  }
`;

function MaybeShowDisconnected({ gameOver }) {
  const { connected } = React.useContext(WebsocketContext);
  let translateY = connected ? "-115%" : "0%";
  if (gameOver.over) {
    translateY = "-115%";
  }
  const text = connected ? "Connected" : "Disconnected";
  return (
    <DisconnectedDiv
      style={{
        "--translate-y": translateY,
        "--background-color": connected
          ? "var(--color-blue-800)"
          : "var(--color-pink-400)",
      }}
    >
      {text}
    </DisconnectedDiv>
  );
}

function MaybeShowGameOver({ gameOver }) {
  const [hideGameOver, setHideGameOver] = React.useState(false);

  let translateY = gameOver.over && !hideGameOver ? "0%" : "-115%";
  let backgroundColor;
  let textColor;
  let borderColor;
  if (gameOver.winner === "black" || gameOver.winner === "draw") {
    backgroundColor = "var(--color-neutral-950)";
    textColor = "var(--color-neutral-400)";
    borderColor = "var(--color-sky-700)";
  } else if (gameOver.winner === "white") {
    backgroundColor = "var(--color-slate-300)";
    textColor = "var(--color-neutral-800)";
    borderColor = "var(--color-neutral-950)";
  }
  let headerText = "";
  if (gameOver.winner === "black") {
    headerText = "👑 Black wins! 👑";
  } else if (gameOver.winner === "white") {
    headerText = "👑 White wins! 👑";
  } else {
    headerText = "The game was a DRAW?!?";
  }

  return (
    <GameOverDiv
      style={{
        "--translate-y": translateY,
        "--background-color": backgroundColor,
        "--text-color": textColor,
        "--border-color": borderColor,
      }}
    >
      <GameOverDivHeader>{headerText}</GameOverDivHeader>
      {gameOver.winner !== "n" && (
        <>
          <GameOverDivBody>
            Thank you for playing the first game of One Million Chessboards. I
            hope this was fun.
          </GameOverDivBody>

          <GameOverDivBody>
            Maybe we could do this again. If you'd like that{" "}
            <a
              style={{ color: "inherit" }}
              href="https://eieio.games/whats-my-deal/"
            >
              let me know
            </a>
            .
          </GameOverDivBody>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <HideButton onClick={() => setHideGameOver(true)}>
              <span>Hide</span>
            </HideButton>
            <GameOverDivBody style={{ textAlign: "right" }}>
              -nolen (eieio)
            </GameOverDivBody>
          </div>
        </>
      )}
    </GameOverDiv>
  );
}

function SmallHeader() {
  const { gameOver } = React.useContext(GameOverContext);
  return (
    <Wrapper>
      <MaybeShowDisconnected gameOver={gameOver} />
      <MaybeShowGameOver gameOver={gameOver} />
      <Title href="/">One Million Chessboards</Title>
    </Wrapper>
  );
}

export default SmallHeader;
