import React from "react";
import HandlersContext from "../HandlersContext/HandlersContext";
import CurrentColorContext from "../CurrentColorProvider/CurrentColorProvider";
import { computeInitialArguments } from "../../utils";
import CoordsContext from "../CoordsContext/CoordsContext";
import { decompress } from "fzstd";
import useStartBot from "../../hooks/use-start-bot";
import { chess } from "../../protoCompiled.js";
// CR nroyalty: replace with partysocket

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd]; // little‑endian

function parseFrame(buf) {
  const u8 = new Uint8Array(buf);

  const isZstd =
    u8[0] === ZSTD_MAGIC[0] &&
    u8[1] === ZSTD_MAGIC[1] &&
    u8[2] === ZSTD_MAGIC[2] &&
    u8[3] === ZSTD_MAGIC[3];

  const payload = isZstd ? decompress(u8) : u8;

  return JSON.parse(new TextDecoder().decode(payload));
}

function encodeAndSendIfOpen({ ws, msg }) {
  const wire = chess.ClientMessage.encode(msg).finish();
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(wire);
      return true;
    } catch (e) {
      console.error("Error sending to server", e);
      return false;
    }
  }
  return false;
}

function protoSendSubscribe({ ws, coords }) {
  const msg = chess.ClientMessage.create({
    subscribe: {
      centerX: coords.x,
      centerY: coords.y,
    },
  });
  return encodeAndSendIfOpen({ ws, msg });
}

function protoSendPing({ ws }) {
  const msg = chess.ClientMessage.create({
    ping: {},
  });
  return encodeAndSendIfOpen({ ws, msg });
}

function protoSendMove({ ws, piece, toX, toY, moveType, moveToken }) {
  const msg = chess.ClientMessage.create({
    move: {
      pieceId: piece.id,
      fromX: piece.x,
      fromY: piece.y,
      toX,
      toY,
      moveType,
      moveToken,
    },
  });
  return encodeAndSendIfOpen({ ws, msg });
}

function useWebsocket({
  setConnected,
  pieceHandler,
  statsHandler,
  websocketRef,
}) {
  const failedReconnections = React.useRef(0);
  const { setCoords } = React.useContext(CoordsContext);
  const { setCurrentColor } = React.useContext(CurrentColorContext);

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

      // CR nroyalty: handle exceptions here lmao
      let ws;
      ws = new WebSocket(wsUrl);
      websocketRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onmessage = async (event) => {
        if (killed) {
          return;
        }
        const buf =
          event.data instanceof Blob
            ? await event.data.arrayBuffer()
            : event.data;
        const data = parseFrame(buf);

        if (data.type === "stateSnapshot") {
          pieceHandler.current.handleSnapshot({
            snapshot: data,
            newConnection: false,
          });
        } else if (data.type === "moveUpdates") {
          pieceHandler.current.handleMoves({
            moves: data.moves,
            captures: data.captures,
          });
        } else if (data.type === "initialState") {
          pieceHandler.current.handleSnapshot({
            snapshot: data.snapshot,
            newConnection: true,
          });
          setCoords({ x: data.position.x, y: data.position.y });
          setCurrentColor({ playingWhite: data.playingWhite });
        } else if (data.type === "validMove") {
          pieceHandler.current.confirmOptimisticMove({
            moveToken: data.moveToken,
            asOfSeqnum: data.asOfSeqnum,
            capturedPieceId: data.capturedPieceId,
          });
        } else if (data.type === "invalidMove") {
          pieceHandler.current.rejectOptimisticMove({
            moveToken: data.moveToken,
          });
        } else if (data.type === "app-pong") {
          // ok
        } else {
          console.log("unknown message type", data);
        }
      };

      ws.onopen = () => {
        console.log("websocket opened");
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
          protoSendPing({ ws });
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
    pieceHandler,
    setConnected,
    setCoords,
    setCurrentColor,
    statsHandler,
    websocketRef,
  ]);
}

// CR nroyalty: if we wanted to be smart (and we should), we can debounce much
// more aggressively if we've recently requested a snapshot, and can skip
// debouncing if we just did a big jump in position!
const DEBOUNCE_TIME = 100;
function useUpdateCoords({ connected, sendSubscribe }) {
  const { coords } = React.useContext(CoordsContext);
  const debounceTimeoutRef = React.useRef(null);
  React.useEffect(() => {
    if (!connected) {
      return;
    }
    if (coords.x === null || coords.y === null) {
      return;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      sendSubscribe(coords);
    }, DEBOUNCE_TIME);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [coords, connected, sendSubscribe]);
}
export const WebsocketContext = React.createContext();

function WebsocketProvider({ children }) {
  const websocketRef = React.useRef(null);
  const [connected, _setConnected] = React.useState(false);
  const { pieceHandler, statsHandler } = React.useContext(HandlersContext);

  const setConnected = React.useCallback(
    (valueOrFunction) => {
      _setConnected((prev) => {
        const newValue =
          typeof valueOrFunction === "function"
            ? valueOrFunction(prev)
            : valueOrFunction;
        pieceHandler.current.setConnected(newValue);
        return newValue;
      });
    },
    [pieceHandler]
  );

  const sendSubscribe = React.useCallback((coords) => {
    protoSendSubscribe({ ws: websocketRef.current, coords });
  }, []);

  useWebsocket({
    websocketRef,
    setConnected,
    pieceHandler,
    statsHandler,
  });

  useUpdateCoords({ connected, sendSubscribe });

  const submitMove = React.useCallback(
    ({
      piece,
      toX,
      toY,
      moveType,
      capturedPiece,
      additionalMovedPiece,
      captureRequired,
      couldBeACapture,
    }) => {
      const moveToken = pieceHandler.current.getIncrMoveToken();
      if (
        protoSendMove({
          ws: websocketRef.current,
          piece,
          toX,
          toY,
          moveType,
          moveToken,
        })
      ) {
        // CR nroyalty: figure out what to do once we move to partysocket...
        let incrLocalMoves = true;
        let incrLocalCaptures = false;
        if (capturedPiece) {
          incrLocalCaptures = true;
        }
        statsHandler.current.updateLocalStats({
          incrLocalMoves,
          incrLocalCaptures,
        });

        pieceHandler.current.addOptimisticMove({
          moveToken,
          movedPiece: piece,
          toX,
          toY,
          additionalMovedPiece,
          capturedPiece,
          captureRequired,
          couldBeACapture,
        });
      }
    },
    [pieceHandler, statsHandler]
  );

  // CR nroyalty: delete this before rolling to prod...
  useStartBot({ pieceHandler, submitMove });

  const value = React.useMemo(
    () => ({ connected, submitMove }),
    [connected, submitMove]
  );

  return (
    <WebsocketContext.Provider value={value}>
      {children}
    </WebsocketContext.Provider>
  );
}

export default WebsocketProvider;
