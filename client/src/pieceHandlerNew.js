import { pieceKey, getMoveableSquares, TYPE_TO_NAME } from "./utils";

class PieceHandler {
  constructor({ statsHandler }) {
    this.statsHandler = statsHandler;
    this.piecesByLocation = new Map();
    this.piecesById = new Map();
    this.optimisticMoves = new Map();
    this.optimisticCaptures = new Map();

    this.moveId = 1;
    this.subscribers = [];
    this.currentCoords = { x: null, y: null };
    this.lastSnapshotCoords = { x: null, y: null };

    this.activeMoves = [];
    this.activeCaptures = [];

    this.snapshotSeqnum = { from: -2, to: -1 };
  }

  setCurrentCoords({ x, y }) {
    // CR nroyalty: invalidate old snapshot if applicable? Maybe we don't do that
    // until we get a new snapshot just in case.

    this.currentCoords = { x, y };
  }

  subscribe({ id, callback }) {
    this.subscribers.push({ id, callback });
    console.log(`SUBSCRIBER COUNT: ${this.subscribers.length}`);
  }

  unsubscribe({ id }) {
    this.subscribers = this.subscribers.filter(
      ({ id: subscriberId }) => subscriberId !== id
    );
    console.log(`SUBSCRIBER COUNT: ${this.subscribers.length}`);
  }

  broadcast({ moves, captures, appearances, wasSnapshot }) {
    this.subscribers.forEach(({ callback }) => {
      callback({
        moves,
        captures,
        appearances,
        piecesByLocation: this.piecesByLocation,
        piecesById: this.piecesById,
        wasSnapshot,
      });
    });
  }

  getMoveMapByPieceId() {
    const ret = new Map();
    this.activeMoves.forEach((move) => {
      ret.set(move.pieceId, move);
    });
    return ret;
  }

  handleSnapshot({ snapshot }) {
    console.log("GOT SNAPSHOT");
    // We intentionally do NOT drop stale snapshots. It's possible that we get
    // snapshots with an old seqnum if the server bounces and loses a little bit of state.
    // Otherwise I think we can assume messages are ordered (TCP, etc) so this should be fine?
    if (this.currentCoords.x === null || this.currentCoords.y === null) {
      console.warn(`BUG? Processing snapshot but current coords aren't set`);
    } else {
      const xCoordDelta = Math.abs(this.currentCoords.x - snapshot.xCoord);
      const yCoordDelta = Math.abs(this.currentCoords.y - snapshot.yCoord);

      if (xCoordDelta > 50 || yCoordDelta > 50) {
        console.log(
          `Dropping snapshot because its coords don't match our current coords
          ours: ${this.currentCoords.x}, ${this.currentCoords.y}
          snap: ${snapshot.xCoord}, ${snapshot.yCoord}
          `
        );
        return;
      }
    }

    let shouldComputeSimulatedChanges = false;
    const SIMULATED_CHANGES_THRESHOLD = 20;

    if (
      this.lastSnapshotCoords.x === null ||
      this.lastSnapshotCoords.y === null
    ) {
      shouldComputeSimulatedChanges = true;
    } else {
      const snapshotXDelta = Math.abs(
        this.lastSnapshotCoords.x - snapshot.xCoord
      );
      const snapshotYDelta = Math.abs(
        this.lastSnapshotCoords.y - snapshot.yCoord
      );

      shouldComputeSimulatedChanges =
        snapshotXDelta < SIMULATED_CHANGES_THRESHOLD &&
        snapshotYDelta < SIMULATED_CHANGES_THRESHOLD;
    }

    const piecesByLocation = new Map();
    const piecesById = new Map();
    const simulatedMoves = [];
    const simulatedCaptures = [];
    const simulatedAppearances = [];
    const now = performance.now();

    // CR nroyalty: potentially invalidate optimistic updates?
    // Maybe not...snapshots could be stale...
    snapshot.pieces.forEach((piece) => {
      piecesByLocation.set(pieceKey(piece.x, piece.y), piece);
      piecesById.set(piece.id, piece);
    });

    const activeMoves = [];
    const activeCaptures = [];

    this.activeMoves.forEach((move) => {
      if (move.seqNum > snapshot.startingSeqnum) {
        const movePieceId = move.pieceId;
        const ourPiece = piecesById.get(movePieceId);
        if (ourPiece) {
          if (ourPiece.x === move.fromX && ourPiece.y === move.fromY) {
            const fromKey = pieceKey(move.fromX, move.fromY);
            const toKey = pieceKey(move.toX, move.toY);
            piecesByLocation.delete(fromKey);
            piecesById.set(movePieceId, ourPiece);
            piecesByLocation.set(toKey, ourPiece);
            activeMoves.push(move);
          }
        }
      }
    });
    this.activeMoves = activeMoves;

    this.activeCaptures.forEach((capture) => {
      if (capture.seqNum > snapshot.startingSeqnum) {
        const ourPiece = piecesById.get(capture.pieceId);
        if (ourPiece) {
          const locKey = pieceKey(ourPiece.x, ourPiece.y);
          piecesByLocation.delete(locKey);
          piecesById.delete(ourPiece.id);
          activeCaptures.push(capture);
        }
      }
    });
    this.activeCaptures = activeCaptures;

    // we need to do this *after* we process the active moves and captures,
    // otherwise we'll end up potentially simulating a move or capture twice!
    snapshot.pieces.forEach((piece) => {
      if (this.piecesById.has(piece.id)) {
        const oldPiece = this.piecesById.get(piece.id);
        if (oldPiece.x !== piece.x || oldPiece.y !== piece.y) {
          const simulatedMove = {
            fromX: oldPiece.x,
            fromY: oldPiece.y,
            toX: piece.x,
            toY: piece.y,
            pieceId: piece.id,
            receivedAt: now,
          };
          console.log(
            `CREATE SIMULATED MOVE: ${JSON.stringify(simulatedMove)}`
          );
          simulatedMoves.push(simulatedMove);
        }
      } else {
        simulatedAppearances.push({
          piece,
          receivedAt: now,
        });
      }
    });

    if (shouldComputeSimulatedChanges) {
      for (const [oldPieceId, oldPiece] of this.piecesById) {
        if (!piecesById.has(oldPieceId)) {
          const existsInRecentCaptures = this.activeCaptures.some((elt) => {
            return elt.piece.id === oldPieceId;
          });
          if (!existsInRecentCaptures) {
            simulatedCaptures.push({
              piece: oldPiece,
              receivedAt: now,
            });
          }
        }
      }
    }

    this.piecesById = piecesById;
    this.piecesByLocation = piecesByLocation;
    this.snapshotSeqnum = {
      from: snapshot.startingSeqnum,
      to: snapshot.endingSeqnum,
    };

    this.broadcast({
      wasSnapshot: true,
      moves: simulatedMoves,
      appearances: simulatedAppearances,
      captures: simulatedCaptures,
    });
  }

  handleMoves({ moves, captures }) {
    let dTotalMoves = 0;
    let dWhitePieces = 0;
    let dBlackPieces = 0;
    let dWhiteKings = 0;
    let dBlackKings = 0;
    const now = performance.now();

    const simulatedMoves = [];
    const simulatedAppearances = [];
    const simulatedCaptures = [];

    moves.forEach((move) => {
      if (move.seqNum <= this.snapshotSeqnum.from) {
        // do nothing
      } else {
        const ourPiece = this.piecesById.get(move.pieceId);
        let simulatedMove = null;
        if (ourPiece === undefined) {
          const piece = {
            id: move.pieceId,
            x: move.toX,
            y: move.toY,
            type: move.pieceType,
            isWhite: move.isWhite,
            moveCount: move.moveCount,
            captureCount: move.captureCount,
          };
          simulatedAppearances.push({
            piece,
            receivedAt: now,
          });
          this.piecesById.set(move.pieceId, piece);
          this.piecesByLocation.set(pieceKey(move.toX, move.toY), piece);
        } else {
          if (ourPiece.x === move.fromX && ourPiece.y === move.fromY) {
            // move lines up with our model of the world. neato.
          } else {
            // CR nroyalty: OPTIMISTIC INVALIDATION HERE!!!!
            // CR nroyalty: handle potential invalidations!
            // Move does not line up with our model of the world. We still simulate
            // a move as though it does, to make animations smoother
          }

          simulatedMove = {
            fromX: ourPiece.x,
            fromY: ourPiece.y,
            toX: move.toX,
            toY: move.toY,
            pieceId: ourPiece.id,
            receivedAt: now,
          };

          this.piecesByLocation.delete(pieceKey(ourPiece.x, ourPiece.y));
          ourPiece.x = move.toX;
          ourPiece.y = move.toY;
          ourPiece.moveCount = move.moveCount;
          ourPiece.captureCount = move.captureCount;

          this.piecesByLocation.set(pieceKey(move.toX, move.toY), ourPiece);
          this.piecesById.set(ourPiece.id, ourPiece);
        }
        if (simulatedMove) {
          dTotalMoves++;
          simulatedMoves.push(simulatedMove);
        }
      }
    });

    captures.forEach((capture) => {
      if (capture.seqNum <= this.snapshotSeqnum.from) {
        // do nothing
      } else {
        const ourPiece = this.piecesById.get(capture.capturedPieceId);
        if (ourPiece === undefined) {
          // Do nothing?
          // Maybe we can still deal with invalidation if we get a capture
          // and it references a piece with x and y coordinates that disagree
          // with our optimistic update
        } else {
          const locKey = pieceKey(ourPiece.x, ourPiece.y);
          this.piecesById.delete(ourPiece.id);
          this.piecesByLocation.delete(locKey);

          const pieceType = TYPE_TO_NAME[ourPiece.type];
          const wasWhite = ourPiece.isWhite;
          const wasKing = pieceType === "king";
          simulatedCaptures.push({
            piece: ourPiece,
            receivedAt: now,
          });

          if (wasWhite) {
            dWhitePieces--;
            if (wasKing) {
              dWhiteKings--;
            }
          } else {
            dBlackPieces--;
            if (wasKing) {
              dBlackKings--;
            }
          }
        }
      }
    });

    this.activeMoves.push(...simulatedMoves);
    this.activeCaptures.push(...simulatedCaptures);
    this.statsHandler.applyPieceHandlerDelta({
      dTotalMoves,
      dWhitePieces,
      dBlackPieces,
      dWhiteKings,
      dBlackKings,
    });

    this.broadcast({
      wasSnapshot: false,
      moves: simulatedMoves,
      appearances: simulatedAppearances,
      captures: simulatedCaptures,
    });
  }

  getPieceById(id) {
    return this.piecesById.get(id);
  }

  getPiecesById() {
    return this.piecesById;
  }

  getPieceByLocation(x, y) {
    return this.piecesByLocation.get(pieceKey(x, y));
  }

  getMoveableSquares(piece) {
    return getMoveableSquares(piece, this.piecesByLocation);
  }
}

export default PieceHandler;
