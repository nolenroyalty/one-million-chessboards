import React from "react";
import styled from "styled-components";

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
  const sent = React.useRef(false);

  React.useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.pieces) {
        console.log(`piece 0: ${JSON.stringify(data.pieces[0])}`);
      }
      console.log(data);
      if (!sent.current) {
        sent.current = true;
        const piece = data.pieces[0];
        const move = {
          type: "move",
          pieceId: piece.id,
          fromX: piece.x,
          fromY: piece.y,
          toX: piece.x + 1,
          toY: piece.y + 1,
        };
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

  return <Main>hello world</Main>;
}

export default App;
