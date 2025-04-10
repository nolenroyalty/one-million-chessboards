import React from "react";
import styled from "styled-components";
import Board from "../Board/Board";
import BoardControls from "../BoardControls/BoardControls";
import PieceHandler from "../../pieceHandlerNew.js";
import ChessPieceColorer from "../ChessPieceColorer/ChessPieceColorer";
import BigHeader from "../BigHeader/BigHeader.jsx";
import SmallHeader from "../SmallHeader/SmallHeader.jsx";
import MinimapHandler from "../../minimapHandler.js";
import StatsHandler from "../../statsHandler.js";
import { HandlersContextProvider } from "../HandlersContext/HandlersContext";
import { CoordsContextProvider } from "../CoordsContext/CoordsContext";
import { ShowLargeBoardContextProvider } from "../ShowLargeBoardContext/ShowLargeBoardContext";
import { SelectedPieceAndSquaresContextProvider } from "../SelectedPieceAndSquaresContext/SelectedPieceAndSquaresContext";
import WebsocketProvider from "../WebsocketProvider/WebsocketProvider";

const Main = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: var(--max-outer-width);
  margin: 0 auto;
  background-color: var(--color-neutral-950);
  height: 100svh;
  gap: 0.125rem;
  max-height: 1500px;
  --main-side-padding: 0.5rem;
  padding: 0 var(--main-side-padding);
  border-left: 1px solid var(--color-sky-700);
  border-right: 1px solid var(--color-sky-700);
  @media (max-width: 1000px) {
    border-left: none;
    border-right: none;
  }

  @media (min-height: 1510px) {
    border-bottom: 1px solid var(--color-sky-700);
    padding-bottom: 0.5rem;
    border-radius: 0 0 0.25rem 0.25rem;
  }
  /* box-shadow:
    2px 0 8px var(--color-neutral-800),
    -2px 0 8px var(--color-neutral-800); */
  /* background-color: #0a0a0a;
  opacity: 1;
  /* background-image:
    linear-gradient(#0c4a6e 0.8px, transparent 0.8px),
    linear-gradient(to right, #0c4a6e 0.8px, #0a0a0a 0.8px);
  background-size: 16px 16px; */
  opacity: 1;
  background-image:
    linear-gradient(#0c4a6e55 0.8px, transparent 0.8px),
    linear-gradient(to right, #0c4a6e55 0.8px, #0a0a0a 0.8px);
  background-size: 16px 16px;
`;

function App() {
  const statsHandler = React.useRef(new StatsHandler());
  const pieceHandler = React.useRef(
    new PieceHandler({ statsHandler: statsHandler.current })
  );
  const minimapHandler = React.useRef(new MinimapHandler());

  return (
    <HandlersContextProvider
      statsHandler={statsHandler}
      pieceHandler={pieceHandler}
      minimapHandler={minimapHandler}
    >
      <CoordsContextProvider>
        <WebsocketProvider>
          <ShowLargeBoardContextProvider>
            <SelectedPieceAndSquaresContextProvider>
              <Main>
                <SmallHeader />
                <BigHeader />
                {/* <ChessPieceColorer /> */}
                <Board />
                <BoardControls />
              </Main>
            </SelectedPieceAndSquaresContextProvider>
          </ShowLargeBoardContextProvider>
        </WebsocketProvider>
      </CoordsContextProvider>
    </HandlersContextProvider>
  );
}

export default App;
