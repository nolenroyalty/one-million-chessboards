import React from "react";
import HandlersContext from "../HandlersContext/HandlersContext";
import CurrentColorContext from "../CurrentColorProvider/CurrentColorProvider";
import { computeInitialArguments, isZstd } from "../../utils";
import CoordsContext from "../CoordsContext/CoordsContext";
import { decompress } from "fzstd";
import useStartBot from "../../hooks/use-start-bot";
import { chess } from "../../protoCompiled.js";
import protobuf from "protobufjs";
// CR nroyalty: replace with partysocket

function parseServerMessage(buf) {
  const u8 = new Uint8Array(buf);

  const payload = isZstd(u8) ? decompress(u8) : u8;

  let decoded;
  try {
    decoded = chess.ServerMessage.decode(payload);
    return decoded;
  } catch (e) {
    if (e instanceof protobuf.util.ProtocolError) {
      console.error("Error decoding server message", e);
      return null;
    } else {
      console.error("Error decoding server message", e);
      return null;
    }
  }
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
        const data = parseServerMessage(buf);
        if (!data) {
          return;
        }
        if (data.initialState) {
          const initialState = data.initialState;
          setCoords({ x: initialState.position.x, y: initialState.position.y });
          setCurrentColor({ playingWhite: initialState.playingWhite });
          pieceHandler.current.handleSnapshot({
            snapshot: initialState.snapshot,
            newConnection: true,
          });
        } else if (data.snapshot) {
          pieceHandler.current.handleSnapshot({
            snapshot: data.snapshot,
            newConnection: false,
          });
        } else if (data.movesAndCaptures) {
          const movesAndCaptures = data.movesAndCaptures;
          pieceHandler.current.handleMoves({
            moves: movesAndCaptures.moves,
            captures: movesAndCaptures.captures,
          });
        } else if (data.validMove) {
          const valid = data.validMove;
          pieceHandler.current.confirmOptimisticMove({
            moveToken: valid.moveToken,
            asOfSeqnum: valid.asOfSeqnum,
            capturedPieceId: valid.capturedPieceId,
          });
        } else if (data.invalidMove) {
          const invalid = data.invalidMove;
          pieceHandler.current.rejectOptimisticMove({
            moveToken: invalid.moveToken,
          });
        } else if (data.adoption) {
          const adoption = data.adoption;
          pieceHandler.current.handleAdoption({
            adoptedIds: adoption.adoptedIds,
          });
        } else if (data.bulkCapture) {
          const bulkCapture = data.bulkCapture;
          pieceHandler.current.handleBulkCapture({
            capturedIds: bulkCapture.capturedIds,
            seqnum: bulkCapture.seqnum,
          });
        } else if (data.pong) {
        } else {
          console.debug("unknown message type", data);
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
          // CR nroyalty: reduce frequency and add jitter
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

class CoordsDebouncer {
  constructor({ sendSubscribe }) {
    this.recentRequests = [];
    this.requestTimeout = null;
    this.currentCoords = null;
    this.sendSubscribe = sendSubscribe;
  }

  enqueueRequest(delay) {
    if (delay === 0) {
      this.recentRequests.push(performance.now());
      this.sendSubscribe(this.currentCoords);
      return;
    } else {
      this.requestTimeout = setTimeout(() => {
        this.recentRequests.push(performance.now());
        this.sendSubscribe(this.currentCoords);
        this.requestTimeout = null;
      }, delay);
    }
  }

  updateCoords({ coords }) {
    if (
      this.currentCoords &&
      this.currentCoords.x === coords.x &&
      this.currentCoords.y === coords.y
    ) {
      return;
    }
    this.currentCoords = coords;
    if (this.requestTimeout) {
      // we're already waiting to send a request, just update the coords
      // that we will send for it
      return;
    }
    const now = performance.now();
    const recentRequests = this.recentRequests.filter(
      (req) => now - req < 1400
    );
    this.recentRequests = recentRequests;
    if (this.recentRequests.length === 0) {
      this.enqueueRequest(0);
    } else {
      const delay = this.recentRequests.length <= 2 ? 50 : 250;
      this.enqueueRequest(delay);
    }
  }

  stop() {
    this.recentRequests = [];
    if (this.requestTimeout) {
      clearTimeout(this.requestTimeout);
    }
  }
}

function useUpdateCoords({ connected, sendSubscribe }) {
  const { coords } = React.useContext(CoordsContext);
  const debouncer = React.useRef(new CoordsDebouncer({ sendSubscribe }));

  React.useEffect(() => {
    if (!connected) {
      return;
    }
    if (coords.x === null || coords.y === null) {
      return;
    }
    let db = debouncer.current;
    db.updateCoords({ coords });
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
