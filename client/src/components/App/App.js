import React from "react";
import styled from "styled-components";
import Board from "../Board/Board";
import BoardControls from "../BoardControls/BoardControls";
import PieceHandler from "../../pieceHandler.js";
import { createMoveRequest, keyToCoords } from "../../utils";
import ChessPieceColorer from "../ChessPieceColorer/ChessPieceColorer";
import BigHeader from "../BigHeader/BigHeader.jsx";
import SmallHeader from "../SmallHeader/SmallHeader.jsx";
import MinimapHandler from "../../minimapHandler.js";
import StatsHandler from "../../statsHandler.js";
import { HandlersContextProvider } from "../HandlersContext/HandlersContext";
import { CoordsContextProvider } from "../CoordsContext/CoordsContext";
import { ShowLargeBoardContextProvider } from "../ShowLargeBoardContext/ShowLargeBoardContext";
import { SelectedPieceAndSquaresContextProvider } from "../SelectedPieceAndSquaresContext/SelectedPieceAndSquaresContext";

const Main = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: var(--max-outer-width);
  margin: 0 auto;
  background-color: var(--color-neutral-950);
  height: 100svh;
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

function useStartBot({ pieceHandler, submitMove, started }) {
  React.useEffect(() => {
    if (!started) {
      return;
    }
    let botInterval;
    const loop = () => {
      let attempts = 0;
      let targetPiece, targetSquare;
      for (let i = 0; i < 10; i++) {
        while (attempts < 50) {
          const pieces = Array.from(pieceHandler.current.getPieces().values());
          const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
          const moveableSquares =
            pieceHandler.current.getMoveableSquares(randomPiece);
          if (moveableSquares.size > 0) {
            targetPiece = randomPiece;
            targetSquare =
              Array.from(moveableSquares)[
                Math.floor(Math.random() * moveableSquares.size)
              ];
            break;
          }
          attempts++;
        }
        if (targetPiece && targetSquare) {
          const [x, y] = keyToCoords(targetSquare);
          submitMove({
            piece: targetPiece,
            toX: x,
            toY: y,
          });
        }
      }
    };
    console.log("starting bot");
    botInterval = setInterval(loop, 100);

    return () => {
      console.log("stopping bot");
      clearInterval(botInterval);
    };
  }, [pieceHandler, submitMove, started]);
}

function App() {
  console.log("APP");
  const [websocket, setWebsocket] = React.useState(null);
  const statsHandler = React.useRef(new StatsHandler());
  const pieceHandler = React.useRef(
    new PieceHandler({ statsHandler: statsHandler.current })
  );
  const minimapHandler = React.useRef(new MinimapHandler());
  const [runBot, setRunBot] = React.useState(false);

  const submitMove = React.useCallback(
    ({ piece, toX, toY }) => {
      const move = createMoveRequest(piece, toX, toY);
      if (websocket) {
        websocket.send(JSON.stringify(move));
      } else {
        console.log(`Cannot send move because we are not connected: ${move}`);
      }
    },
    [websocket]
  );

  useStartBot({ pieceHandler, submitMove, started: runBot });

  // CR nroyalty: delete this before rolling to prod...
  // run bot on CTRL-B
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "b") {
        setRunBot((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const failedReconnections = React.useRef(0);
  React.useEffect(() => {
    let reconnectTimeout = null;
    let connected = false;
    let pongInterval = null;

    function connect() {
      const protocol =
        window.location.protocol === "https:" ? "wss://" : "ws://";
      const hostname = window.location.host;
      const wsPath = "/ws";
      const wsUrl = `${protocol}${hostname}${wsPath}`;
      const ws = new WebSocket(wsUrl);

      ws.addEventListener("message", (event) => {
        // CR nroyalty: handle movement error / cancelation
        // CR nroyalty: move error handling is like "keep recent moves clientside
        // and send a move ID to the server; use that to figure out what to cancel"
        // CR nroyalty: handle other updates...
        const data = JSON.parse(event.data);
        if (data.type === "stateSnapshot") {
          pieceHandler.current.handleSnapshot({ snapshot: data });
        } else if (data.type === "moveUpdates") {
          pieceHandler.current.handleMoves({
            moves: data.moves,
            captures: data.captures,
          });
        } else if (data.type === "minimapUpdate") {
          minimapHandler.current.setState({ state: data.aggregations });
        } else if (data.type === "globalStats") {
          statsHandler.current.setGlobalStats({ stats: data });
        }
      });

      ws.addEventListener("open", () => {
        console.log("Connected to server");
        setWebsocket(ws);
        connected = true;
        failedReconnections.current = 0;

        pongInterval = setInterval(() => {
          ws.send(JSON.stringify({ type: "app-ping" }));
        }, 10000);
      });

      ws.addEventListener("error", (event) => {
        console.log("websocket error", event);
      });

      ws.addEventListener("close", () => {
        console.log("Disconnected from server");
        clearInterval(pongInterval);
        setWebsocket(null);
        connected = false;
        failedReconnections.current++;
        if (failedReconnections.current === 1) {
          connect();
          return;
        }
        failedReconnections.current = Math.min(5, failedReconnections.current);
        let pow = 2 ** failedReconnections.current;
        const maxSleepTime = 25000;
        let sleepTime = pow * 1000;
        const jitter = 1 + (Math.random() * 0.2 - 0.1);
        sleepTime = Math.min(sleepTime * jitter, maxSleepTime);
        console.log(`Attempting to reconnect in ${sleepTime}ms`);
        reconnectTimeout = setTimeout(() => {
          console.log("Attempting to reconnect");
          connect();
        }, sleepTime);
      });
    }
    connect();

    document.addEventListener("visibilitychange", () => {
      console.log("visibilitychange", document.visibilityState);
      if (document.visibilityState === "visible" && !connected) {
        console.log("Reconnecting because we are visible");
        clearTimeout(reconnectTimeout);
        connect();
      }
    });

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (pongInterval) {
        clearInterval(pongInterval);
      }
    };
  }, []);

  return (
    <HandlersContextProvider
      statsHandler={statsHandler}
      pieceHandler={pieceHandler}
      minimapHandler={minimapHandler}
    >
      <CoordsContextProvider
        initialX={500}
        initialY={500}
        websocket={websocket}
      >
        <ShowLargeBoardContextProvider>
          <SelectedPieceAndSquaresContextProvider>
            <Main>
              <SmallHeader />
              <BigHeader runBot={runBot} />
              {/* <ChessPieceColorer /> */}
              <Board submitMove={submitMove} />
              <BoardControls />
            </Main>
          </SelectedPieceAndSquaresContextProvider>
        </ShowLargeBoardContextProvider>
      </CoordsContextProvider>
    </HandlersContextProvider>
  );
}

export default App;
