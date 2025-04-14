import React from "react";
import HandlersContext from "../HandlersContext/HandlersContext";
import {
  createMoveRequest,
  keyToCoords,
  computeInitialArguments,
  TYPE_TO_NAME,
} from "../../utils";
import CoordsContext from "../CoordsContext/CoordsContext";
// CR nroyalty: replace with partysocket

// CR nroyalty: delete this before rolling to prod...
function useStartBot({ pieceHandler, submitMove, onlyId }) {
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "b") {
        setStarted((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    if (!started) {
      return;
    }
    let botInterval;
    let count = 0;
    let attemptsById = {};

    const loop = () => {
      let attempts = 0;
      let targetPiece, targetSquare, targetMoveType;
      if (onlyId) {
        const piece = pieceHandler.current.getPieceById(onlyId);
        if (piece) {
          targetPiece = piece;
          const moveableSquaresAndMoveType =
            pieceHandler.current.getMoveableSquares(targetPiece);
          if (moveableSquaresAndMoveType.size > 0) {
            const squares = Array.from(moveableSquaresAndMoveType.keys());
            targetSquare =
              Array.from(squares)[Math.floor(Math.random() * squares.length)];
            const data = moveableSquaresAndMoveType.get(targetSquare);
            targetMoveType = data.moveType;
            const [x, y] = keyToCoords(targetSquare);
            submitMove({
              piece: targetPiece,
              toX: x,
              toY: y,
              moveType: targetMoveType,
            });
          }
        }
      } else {
        for (let i = 0; i < 10; i++) {
          while (attempts < 50) {
            const pieces = Array.from(
              pieceHandler.current.getPiecesById().values()
            );
            const randomPiece =
              pieces[Math.floor(Math.random() * pieces.length)];
            const moveableSquaresAndMoveType =
              pieceHandler.current.getMoveableSquares(randomPiece);
            if (moveableSquaresAndMoveType.size > 0) {
              targetPiece = randomPiece;
              const squares = Array.from(moveableSquaresAndMoveType.keys());
              targetSquare =
                Array.from(squares)[Math.floor(Math.random() * squares.length)];
              const data = moveableSquaresAndMoveType.get(targetSquare);
              targetMoveType = data.moveType;
              break;
            }
            attempts++;
          }
          if (targetPiece && targetSquare) {
            if (!attemptsById[targetPiece.id]) {
              attemptsById[targetPiece.id] = 0;
            }
            attemptsById[targetPiece.id] = attemptsById[targetPiece.id] + 1;
            if (attemptsById[targetPiece.id] > 1) {
              console.log(
                `ATTEMPT ${attemptsById[targetPiece.id]} FOR PIECE ${targetPiece.id}`
              );
            }
            const [x, y] = keyToCoords(targetSquare);
            submitMove({
              piece: targetPiece,
              toX: x,
              toY: y,
              moveType: targetMoveType,
            });
          }
        }
        count++;
        if (count > 5) {
          count = 0;
          attemptsById = {};
        }
      }
    };
    const freq = onlyId ? 400 : 100;
    console.log("starting bot");
    botInterval = setInterval(loop, freq);

    return () => {
      console.log("stopping bot");
      clearInterval(botInterval);
    };
  }, [pieceHandler, submitMove, started, onlyId]);
}

function useWebsocket({
  setConnected,
  pieceHandler,
  statsHandler,
  minimapHandler,
  websocketRef,
}) {
  const failedReconnections = React.useRef(0);
  const { setCoords } = React.useContext(CoordsContext);

  React.useEffect(() => {
    let reconnectTimeout = null;
    let connected = false;
    let connecting = false;
    let pongInterval = null;
    let killed = false;

    function connect() {
      if (connecting) {
        console.log("already connecting - not trying again!");
        return;
      }
      connecting = true;
      const protocol =
        window.location.protocol === "https:" ? "wss://" : "ws://";
      const hostname = window.location.host;
      const wsPath = "/ws";
      const initialArgs = computeInitialArguments();
      let wsUrl = `${protocol}${hostname}${wsPath}`;
      const args = [];
      if (initialArgs.x !== null) {
        args.push(`x=${initialArgs.x}`);
      }
      if (initialArgs.y !== null) {
        args.push(`y=${initialArgs.y}`);
      }
      if (initialArgs.colorPref !== null) {
        args.push(`colorPref=${initialArgs.colorPref}`);
      }
      if (args.length > 0) {
        wsUrl += `?${args.join("&")}`;
      }

      if (websocketRef.current) {
        console.log("closing existing websocket");
        websocketRef.current.close();
        websocketRef.current = null;
      }
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onmessage = (event) => {
        if (killed) {
          return;
        }
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
        } else if (data.type === "initialState") {
          pieceHandler.current.handleSnapshot({ snapshot: data.snapshot });
          setCoords({ x: data.position.x, y: data.position.y });
          minimapHandler.current.setState({
            state: data.minimapAggregation.aggregations,
          });
          // CR nroyalty: handle playing white / black
          statsHandler.current.setGlobalStats({ stats: data.globalStats });
        } else if (data.type === "validMove") {
          pieceHandler.current.confirmOptimisticMove({
            moveToken: data.moveToken,
            asOfSeqnum: data.asOfSeqnum,
          });
        } else if (data.type === "invalidMove") {
          pieceHandler.current.rejectOptimisticMove({
            moveToken: data.moveToken,
          });
        }
      };

      ws.onopen = () => {
        if (killed) {
          return;
        }
        connecting = false;
        connected = true;
        setConnected(true);
        failedReconnections.current = 0;

        pongInterval = setInterval(() => {
          if (killed) {
            return;
          }
          ws.send(JSON.stringify({ type: "app-ping" }));
        }, 10000);
      };

      ws.onerror = (event) => {
        console.log("websocket error", event);
        // connecting = false;
        // connected = false;
        // setConnected(false);
        // websocketRef.current = null;
      };

      ws.onclose = () => {
        if (killed) {
          return;
        }
        console.log("Disconnected from server");
        clearInterval(pongInterval);
        websocketRef.current = null;
        connected = false;
        connecting = false;
        setConnected(false);
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
      };
    }
    connect();

    const reconnectOnVisibilityChange = () => {
      if (document.visibilityState === "visible" && !connected) {
        console.log("Reconnecting because we are visible");
        clearTimeout(reconnectTimeout);
        connect();
      }
    };

    document.addEventListener("visibilitychange", reconnectOnVisibilityChange);

    return () => {
      const ws = websocketRef.current;
      document.removeEventListener(
        "visibilitychange",
        reconnectOnVisibilityChange
      );
      killed = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (pongInterval) {
        clearInterval(pongInterval);
      }
      if (ws) {
        ws.close();
      }
      websocketRef.current = null;
    };
  }, [
    minimapHandler,
    pieceHandler,
    setConnected,
    setCoords,
    statsHandler,
    websocketRef,
  ]);
}

// CR nroyalty: do a tiny debounce here (10 or 20 ms?)
function useUpdateCoords({ connected, safelySendJSON }) {
  const { coords } = React.useContext(CoordsContext);
  React.useEffect(() => {
    if (!connected) {
      return;
    }
    if (coords.x === null || coords.y === null) {
      return;
    }
    safelySendJSON({
      type: "subscribe",
      centerX: coords.x,
      centerY: coords.y,
    });
  }, [safelySendJSON, coords, connected]);
}
export const WebsocketContext = React.createContext();

function WebsocketProvider({ children }) {
  const websocketRef = React.useRef(null);
  const [connected, setConnected] = React.useState(false);
  const { pieceHandler, statsHandler, minimapHandler } =
    React.useContext(HandlersContext);

  const safelySendJSON = React.useCallback((json) => {
    const ws = websocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(json));
        return true;
      } catch (e) {
        console.error("Error sending JSON", e);
        return false;
      }
    }
    return false;
  }, []);

  useWebsocket({
    websocketRef,
    setConnected,
    pieceHandler,
    statsHandler,
    minimapHandler,
  });

  useUpdateCoords({ connected, safelySendJSON });

  const submitMove = React.useCallback(
    ({ piece, toX, toY, moveType, capturedPiece, additionalMovedPiece }) => {
      let dMoves = 1;
      let dWhitePieces = 0;
      let dBlackPieces = 0;
      let dWhiteKings = 0;
      let dBlackKings = 0;
      let incrLocalMoves = true;
      let incrLocalCaptures = false;
      if (capturedPiece) {
        incrLocalCaptures = true;
        const pieceType = TYPE_TO_NAME[capturedPiece.type];
        const isKing = pieceType === "king";
        if (capturedPiece.isWhite) {
          dWhitePieces--;
          if (isKing) {
            dWhiteKings--;
          }
        } else {
          dBlackPieces--;
          if (isKing) {
            dBlackKings--;
          }
        }
      }
      statsHandler.current.applyLocalDelta({
        dMoves,
        dWhitePieces,
        dBlackPieces,
        dWhiteKings,
        dBlackKings,
        incrLocalMoves,
        incrLocalCaptures,
      });
      const moveToken = pieceHandler.current.getIncrMoveToken();
      const move = createMoveRequest({ piece, toX, toY, moveType, moveToken });
      // CR nroyalty: figure out what to do once we move to partysocket...
      if (safelySendJSON(move)) {
        pieceHandler.current.addOptimisticMove({
          moveToken,
          movedPiece: piece,
          toX,
          toY,
          additionalMovedPiece,
          capturedPiece,
        });
      }
    },
    [pieceHandler, safelySendJSON, statsHandler]
  );

  const value = React.useMemo(
    () => ({ connected, safelySendJSON, submitMove }),
    [connected, safelySendJSON, submitMove]
  );

  useStartBot({ pieceHandler, submitMove });

  return (
    <WebsocketContext.Provider value={value}>
      {children}
    </WebsocketContext.Provider>
  );
}

export default WebsocketProvider;
