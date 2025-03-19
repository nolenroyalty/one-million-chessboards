import React from "react";
import styled from "styled-components";
import Board from "../Board/Board";
import PieceHandler from "../../pieceHandler.js";
import { createMoveRequest } from "../../utils";

const Main = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 1000px;
  margin: 0 auto;
`;

function App() {
  const [websocket, setWebsocket] = React.useState(null);
  const [coords, setCoords] = React.useState({ x: 500, y: 500 });
  const pieceHandler = React.useRef(new PieceHandler());

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

  const failedReconnections = React.useRef(0);
  React.useEffect(() => {
    let reconnectTimeout = null;
    let connected = false;
    let pongInterval = null;

    function connect() {
      const ws = new WebSocket("ws://localhost:8080/ws");

      ws.addEventListener("message", (event) => {
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
    </Main>
  );
}

export default App;
