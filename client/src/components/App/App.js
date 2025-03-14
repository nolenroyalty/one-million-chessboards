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

  React.useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(data);
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
