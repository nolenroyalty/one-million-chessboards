import React from "react";
import styled from "styled-components";
import Board from "../Board/Board";
import PieceHandler from "../../pieceHandler.js";
import { createMoveRequest, keyToCoords } from "../../utils";

const Main = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 1000px;
  margin: 0 auto;
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
      while (attempts < 50) {
        const randomPiece = Array.from(pieceHandler.current.pieces.values())[
          Math.floor(Math.random() * pieceHandler.current.pieces.size)
        ];
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
    };
    console.log("starting bot");
    botInterval = setInterval(loop, 55);

    return () => {
      console.log("stopping bot");
      clearInterval(botInterval);
    };
  }, [pieceHandler, submitMove, started]);
}

function App() {
  const [websocket, setWebsocket] = React.useState(null);
  const [coords, setCoords] = React.useState({ x: 500, y: 500 });
  const pieceHandler = React.useRef(new PieceHandler());
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

  return (
    <Main>
      hello world
      <Board
        coords={coords}
        submitMove={submitMove}
        setCoords={setCoords}
        pieceHandler={pieceHandler}
      />
      <p>
        {coords.x} {coords.y}
      </p>
      <p>{runBot ? "running bot" : "not running bot"}</p>
    </Main>
  );
}

export default App;
