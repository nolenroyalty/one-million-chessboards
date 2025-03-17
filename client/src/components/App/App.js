import React from "react";
import styled from "styled-components";
import Board from "../Board/Board";
import Pieces from "../../pieces";
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
  const pieceHandler = React.useRef(new Pieces());
  const [pieces, setPieces] = React.useState(new Map());
  const sent = React.useRef(false);

  const submitMove = React.useCallback(
    ({ piece, toX, toY }) => {
      const move = createMoveRequest(piece, toX, toY);
      websocket.send(JSON.stringify(move));
    },
    [websocket]
  );

  React.useEffect(() => {
    pieceHandler.current.subscribe({
      id: "app",
      callback: (data) => {
        setPieces(new Map(data.pieces));
      },
    });

    return () => {
      pieceHandler.current.unsubscribe({
        id: "app",
      });
    };
  }, [setPieces]);

  React.useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.pieces) {
        pieceHandler.current.handleSnapshot({ snapshot: data });
      } else if (data.moves) {
        pieceHandler.current.handleMoves({ moves: data.moves });
      }
      console.log(data);
      if (!sent.current) {
        sent.current = true;
        const piece = data.pieces[0];
        const move = createMoveRequest(piece, piece.x + 1, piece.y + 1);
        ws.send(JSON.stringify(move));
      }
    };

    ws.onopen = () => {
      console.log("Connected to server");
      setWebsocket(ws);
    };

    ws.onclose = () => {
      console.log("Disconnected from server");
    };
  }, []);

  React.useEffect(() => {
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
      <Board coords={coords} pieces={pieces} submitMove={submitMove} />
    </Main>
  );
}

export default App;
