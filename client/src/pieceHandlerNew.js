import { pieceKey, getMoveableSquares, TYPE_TO_NAME } from "./utils";

class OSTATE {
  MOVED = "moved";
  CAPTURED = "captured";
  APPEARED = "appeared";
}

class ODECISION {
  REVERT = "revert";
  NO_ACTION = "no-action";
  STOP_TRACKING = "stop-tracking";
}

// CR nroyalty: this will need to handle promotions too. Ugh.
// CR nroyalty: maybe our move confirmations can also come with a seqnum so that we
// can add an activeMove (and activeCapture) for them until the next snapshot
class PieceOptimisticState {
  constructor({ originalPiece }) {
    const pieceCopy = { ...originalPiece };
    this.id = pieceCopy.id;
    this.knownX = pieceCopy.x;
    this.knownY = pieceCopy.y;
    this.knownCaptured = false;
    this.originalPiece = pieceCopy;
    this.actions = [];
  }

  addOptimisticMove({ fromX, fromY, toX, toY, moveToken }) {
    const action = {
      type: OSTATE.MOVED,
      fromX,
      fromY,
      toX,
      toY,
      moveToken,
      confirmed: false,
    };
    this.actions.push(action);
  }

  addOptimisticCapture({ moveToken, x, y }) {
    this.actions.push({
      type: OSTATE.CAPTURED,
      moveToken,
      confirmed: false,
      x,
      y,
    });
  }

  impliedState() {
    if (this.actions.length === 0) {
      return null;
    }
    if (this.knownCaptured) {
      return { state: OSTATE.CAPTURED };
    }
    const lastAction = this.actions[this.actions.length - 1];
    if (lastAction.type === OSTATE.CAPTURED) {
      return { state: OSTATE.CAPTURED };
    } else if (lastAction.type === OSTATE.MOVED) {
      return { state: OSTATE.MOVED, x: lastAction.toX, y: lastAction.toY };
    }
  }

  impactedSquares() {
    const ret = new Set();
    this.actions.forEach((action) => {
      if (action.type === OSTATE.CAPTURED) {
        const key = pieceKey(action.x, action.y);
        ret.add(key);
      } else if (action.type === OSTATE.MOVED) {
        const from = pieceKey(action.fromX, action.fromY);
        const to = pieceKey(action.toX, action.toY);
        ret.add(from);
        ret.add(to);
      }
    });
    return ret;
  }

  processServerMove({ fromX, fromY, toX, toY }) {
    if (this.actions.length === 0) {
      // what do we do here??
      return null;
    }
    if (this.knownCaptured) {
      return null;
    }

    const firstAction = this.actions[0];
    if (firstAction.type === OSTATE.CAPTURED) {
      // We thought that the piece was captured, but it has been moved.
      // We should simulate an appearance at its final location
      const impactedMoveTokens = this.actions.map((a) => a.moveToken);
      return {
        decision: ODECISION.REVERT,
        impactedMoveTokens,
        impactedSquares: this.impactedSquares(),
        state: OSTATE.APPEARED,
        x: toX,
        y: toY,
      };
    } else if (firstAction.type === OSTATE.MOVED) {
      if (
        firstAction.fromX === fromX &&
        firstAction.fromY === fromY &&
        firstAction.toX === toX &&
        firstAction.toY === toY
      ) {
        // Consistent with our state. We can update our known server position and
        // potentially stop tracking this piece!
        const newActions = this.actions.slice(1);
        this.actions = newActions;
        this.knownX = toX;
        this.knownY = toY;
        const stopTracking = newActions.length === 0;
        return {
          decision: stopTracking
            ? ODECISION.STOP_TRACKING
            : ODECISION.NO_ACTION,
        };
      } else {
        // The server move conflicts with our understanding of the state. We should either
        // simulate a move (if we think that the piece is still around) or simulate an appearance
        // (if we don't).
        const impliedState = this.impliedState();
        if (impliedState === null) {
          // This seems like a bug (how do we not have state?) but we can simulate an appearance
          return {
            decision: ODECISION.REVERT,
            impactedMoveTokens: [],
            impactedSquares: this.impactedSquares(),
            state: OSTATE.APPEARED,
            x: toX,
            y: toY,
          };
        } else if (impliedState.state === OSTATE.CAPTURED) {
          // Our move chain ended in this piece getting captured. For what it's worth, I think
          // This is impossible in prod (we should only be simulating captures OR moves for a piece
          // because you can only play one color) but we can handle this for completeness.
          const impactedMoveTokens = this.actions.map((a) => a.moveToken);
          return {
            decision: ODECISION.REVERT,
            impactedMoveTokens,
            impactedSquares: this.impactedSquares(),
            state: OSTATE.APPEARED,
            x: toX,
            y: toY,
          };
        } else if (impliedState.state === OSTATE.MOVED) {
          // We have a move chain for this piece. We don't really need to undo all of the moves...
          // just simulate a move from its current position and cancel any dependencies
          const impactedMoveTokens = this.actions.map((a) => a.moveToken);
          return {
            decision: ODECISION.REVERT,
            impactedMoveTokens,
            impactedSquares: this.impactedSquares(),
            state: OSTATE.MOVED,
            fromX: impliedState.x,
            fromY: impliedState.y,
            toX: toX,
            toY: toY,
          };
        }
      }
    }
  }

  processServerCapture() {
    if (this.actions.length === 0) {
      // Again, not sure what we do here?
      return null;
    }

    this.knownCaptured = true;
    const firstAction = this.actions[0];
    if (firstAction.type === OSTATE.CAPTURED) {
      // Cool, this is consistent. Just stop tracking the piece!
      return {
        decision: ODECISION.STOP_TRACKING,
      };
    } else {
      // It's kinda weird, but we don't actually care about our implied state here.
      // We just want to simulate a capture for the piece (if we're currently tracking it)
      const impactedMoveTokens = this.actions.map((a) => a.moveToken);
      return {
        decision: ODECISION.REVERT,
        impactedMoveTokens,
        impactedSquares: this.impactedSquares(),
        state: OSTATE.CAPTURED,
      };
    }
  }

  // processServerConfirmation({ moveToken }) {
  //   const impactedActionIndex = this.actions.findIndex(
  //     (action) => action.moveToken === moveToken
  //   );
  //   if (impactedActionIndex === -1) {
  //     return {
  //       decision: ODECISION.NO_ACTION,
  //     };
  //   } else if (impactedActionIndex === 0) {
  //     // regrettably we can't guarantee ordering of these :/
  //     this.actions = this.actions.slice(1);
  //     if (this.actions.length === 0) {
  //       return { decision: ODECISION.STOP_TRACKING };
  //     } else {
  //       let additionalConfirmedActionIdx = 0;
  //       while (additionalConfirmedActionIdx < this.actions.length) {
  //         if (this.actions[additionalConfirmedActionIdx].confirmed) {
  //           additionalConfirmedActionIdx++;
  //         } else {
  //           break;
  //         }
  //       }
  //       this.actions = this.actions.slice(additionalConfirmedActionIdx);
  //       if (this.actions.length === 0) {
  //         return { decision: ODECISION.STOP_TRACKING };
  //       } else {
  //         return { decision: ODECISION.NO_ACTION };
  //       }
  //     }
  //   } else {
  //     const impactedAction = this.actions[impactedActionIndex];
  //     impactedAction.confirmed = true;
  //     const lastConfirmedActionIdx = this.actions.findLastIndex(
  //       (a) => a.confirmed
  //     );
  //     if (lastConfirmedActionIdx === impactedActionIndex) {
  //       if (impactedAction.type === OSTATE.MOVED) {
  //         this.knownX = impactedAction.toX;
  //         this.knownY = impactedAction.toY;
  //       }
  //     }
  //     if (impactedAction.type === OSTATE.CAPTURED) {
  //       this.knownCaptured = true;
  //     }
  //     return { decision: ODECISION.NO_ACTION };
  //   }
  // }

  processServerConfirmation({ moveToken }) {
    const impactedActionIndex = this.actions.findIndex(
      (action) => action.moveToken === moveToken && !action.confirmed // Find unconfirmed action
    );

    if (impactedActionIndex === -1) {
      return { decision: ODECISION.NO_ACTION };
    } else if (impactedActionIndex !== 0) {
      console.warn(`out of order server move confirmation? ${moveToken}`);
    }

    this.actions[impactedActionIndex].confirmed = true;

    let stopTracking = false;
    if (this.actions.length > 0 && this.actions[0].confirmed) {
      let lastPrunedAction = null;
      while (this.actions.length > 0 && this.actions[0].confirmed) {
        lastPrunedAction = this.actions.shift(); // Remove confirmed first action

        if (lastPrunedAction.type === OSTATE.CAPTURED) {
          this.knownCaptured = true;
          this.actions = [];
          stopTracking = true;
          break;
        }
      }

      if (lastPrunedAction && lastPrunedAction.type === OSTATE.MOVED) {
        this.knownX = lastPrunedAction.toX;
        this.knownY = lastPrunedAction.toY;
        this.knownCaptured = false;
        this.originalPiece.x = this.knownX;
        this.originalPiece.y = this.knownY;
      }

      if (this.actions.length === 0) {
        stopTracking = true;
      }
    }

    if (stopTracking) {
      return { decision: ODECISION.STOP_TRACKING };
    } else {
      if (
        this.actions[impactedActionIndex]?.type === OSTATE.CAPTURED &&
        this.actions[impactedActionIndex]?.confirmed
      ) {
        this.knownCaptured = true;
      }
      return { decision: ODECISION.NO_ACTION };
    }
  }

  _reject({ impactedSquares }) {
    const impactedMoveTokens = this.actions.map((a) => a.moveToken);
    const impliedState = this.impliedState();
    if (impliedState === null || impliedState === OSTATE.CAPTURED) {
      return {
        decision: ODECISION.REVERT,
        impactedMoveTokens,
        state: OSTATE.APPEARED,
        impactedSquares,
        x: this.knownX,
        y: this.knownY,
      };
    } else if (impliedState === OSTATE.MOVED) {
      return {
        decision: ODECISION.REVERT,
        impactedMoveTokens,
        state: OSTATE.MOVED,
        impactedSquares,
        fromX: impliedState.x,
        fromY: impliedState.y,
        toX: this.knownX,
        toY: this.knownY,
      };
    }
  }

  processServerRejection({ moveToken }) {
    const relevantAction = this.actions.find((a) => a.moveToken === moveToken);
    if (relevantAction === undefined) {
      return { decision: ODECISION.NO_ACTION };
    } else {
      const impactedSquares = this.impactedSquares();
      return this._reject({ impactedSquares });
    }
  }

  processSquareRejection({ impactedSquare }) {
    const impactedSquares = this.impactedSquares();
    if (impactedSquares.has(impactedSquare)) {
      return this._reject({ impactedSquares });
    } else {
      return { decision: ODECISION.NO_ACTION };
    }
  }
}

class OptimisticState {
  constructor() {
    this.stateByPieceId = new Map();
  }

  processRevert({ ret, id, state, resp, receivedAt }) {
    if (resp.state === OSTATE.APPEARED) {
      const piece = state.originalPiece;
      piece.x = resp.x;
      piece.y = resp.y;
      ret.appearances.push({
        id,
        piece,
        x: resp.x,
        y: resp.y,
        receivedAt,
      });
    } else if (resp.state === OSTATE.MOVED) {
      const piece = state.originalPiece;
      piece.x = resp.toX;
      piece.y = resp.toY;
      ret.moves.push({
        pieceId: id,
        piece,
        fromX: resp.fromX,
        fromY: resp.fromY,
        toX: resp.toX,
        toY: resp.toY,
        receivedAt,
      });
    } else if (resp.state === OSTATE.CAPTURED) {
      ret.captures.push({
        id,
        piece: state.originalPiece,
        receivedAt,
      });
    }
  }

  // This has a bunch of operations that look expensive (N^2) but we assume that
  // N is relatively small; even if you're making 2 moves a second and each move is
  // a capture (so 2 impacted pieces) AND it takes 5 seconds to receive an ack,
  // N is still only 2 * 2 * 5 = 20.
  recursivelyCancel({ ret, moveTokens, impactedSquares }) {
    const receivedAt = performance.now();
    const processedMoveTokens = new Set();
    const processedImpactedSquares = new Set();

    const processResponse = ({ id, state, resp, idsToPop }) => {
      if (
        !resp ||
        resp.decision === ODECISION.NO_ACTION ||
        resp.decision === ODECISION.STOP_TRACKING
      ) {
        return;
      } else if (resp.decision === ODECISION.REVERT) {
        resp.impactedMoveTokens.forEach((token) => {
          if (!processedMoveTokens.has(token)) {
            moveTokens.push(token);
            processedMoveTokens.add(token);
          }
        });
        resp.impactedSquares.forEach((square) => {
          if (!processedImpactedSquares.has(square)) {
            impactedSquares.add(square);
            processedImpactedSquares.add(square);
          }
        });
        idsToPop.push(id);
        this.processRevert({ ret, id, state, resp, receivedAt });
      }
    };

    while (moveTokens.length > 0 || impactedSquares.size > 0) {
      const idsToPop = [];
      if (moveTokens.length > 0) {
        const moveToken = moveTokens.pop();
        for (const [id, state] of this.stateByPieceId) {
          const resp = state.processServerRejection({ moveToken });
          processResponse({ id, state, resp, idsToPop });
        }
      } else if (impactedSquares.size > 0) {
        const square = impactedSquares.values().next();
        for (const [id, state] of this.stateByPieceId) {
          const resp = state.processSquareRejection({ impactedSquare: square });
          processResponse({ id, state, resp, idsToPop });
        }
      }
    }

    return ret;
  }

  _recursivelyCancelOld({ ret, moveTokens }) {
    const receivedAt = performance.now();

    while (moveTokens.length > 0) {
      const moveToken = moveTokens.pop();
      const idsToPop = [];
      for (const [id, state] of this.stateByPieceId) {
        const resp = state.processServerRejection({ moveToken });
        if (
          !resp ||
          resp.decision === ODECISION.NO_ACTION ||
          resp.decision === ODECISION.STOP_TRACKING
        ) {
          continue;
        } else if (resp.decision === ODECISION.REVERT) {
          moveTokens.push(...resp.decision.impactedMoveTokens);
          idsToPop.push(id);
          this.processRevert({ ret, id, state, resp, receivedAt });
        }
      }

      idsToPop.forEach((id) => {
        this.stateByPieceId.delete(id);
      });
    }

    return ret;
  }

  processODecision({ id, s, ret, resp }) {
    if (resp === null) {
      this.stateByPieceId.delete(id);
      return ret;
    } else if (resp.decision === ODECISION.STOP_TRACKING) {
      this.stateByPieceId.delete(id);
      return ret;
    } else if (resp.decision === ODECISION.NO_ACTION) {
      // nothing to do, wahooo
      return ret;
    } else if (resp.decision === ODECISION.REVERT) {
      this.processRevert({
        ret,
        id,
        state: s,
        resp,
        receviedAt: performance.now(),
      });
      this.stateByPieceId.delete(id);
      this.recursivelyCancel({
        ret,
        moveTokens: resp.impactedMoveTokens,
        impactedSquares: resp.impactedSquares,
      });
      return ret;
    }
  }

  processServerMove({ id, fromX, fromY, toX, toY }) {
    // CR nroyalty: BUG! If {toX, toY} is a square that we're currently tracking
    // but a DIFFERENT piece has moved to it, we need to figure that out and do reversions
    const s = this.stateByPieceId.get(id);
    const ret = { moves: [], appearances: [], captures: [] };
    if (s === undefined) {
      return ret;
    }
    const resp = s.processServerMove({ fromX, fromY, toX, toY });
    return this.processODecision({ id, s, ret, resp });
  }

  processServerCapture({ id }) {
    const s = this.stateByPieceId.get(id);
    const ret = { moves: [], appearances: [], captures: [] };
    if (s === undefined) {
      return ret;
    }
    const resp = s.processServerCapture();
    return this.processODecision({ id, s, ret, resp });
  }

  processServerConfirmation({ moveToken }) {
    const idsToPop = [];
    for (const [id, s] of this.stateByPieceId) {
      const resp = s.processServerConfirmation({ moveToken });
      if (resp.decision === ODECISION.NO_ACTION) {
        continue;
      } else if (resp.decision === ODECISION.REVERT) {
        console.error(`BUG? REVERT for confirmation?? ${JSON.stringify(resp)}`);
      } else if (resp.decision === ODECISION.STOP_TRACKING) {
        idsToPop.push(id);
      }
    }
    idsToPop.forEach((id) => this.stateByPieceId.delete(id));
  }

  processServerRejection({ moveToken }) {
    const ret = { moves: [], appearances: [], captures: [] };
    return this.recursivelyCancel({
      ret,
      moveTokens: [moveToken],
      impactedSquares: new Set(),
    });
  }

  addOptimisticMove({
    moveToken,
    piece,
    fromX,
    fromY,
    toX,
    toY,
    additionalMovedPiece,
    capturedPiece,
  }) {
    const moves = [{ piece, fromX, fromY, toX, toY }];
    if (additionalMovedPiece) {
      moves.push(additionalMovedPiece);
    }

    moves.forEach((move) => {
      let s = this.stateByPieceId.get(move.id);
      if (s === undefined) {
        s = new PieceOptimisticState({
          originalPiece: move.piece,
        });
        this.stateByPieceId.set(move.id, s);
      }
      s.addOptimisticMove({
        fromX: move.fromX,
        fromY: move.fromY,
        toX: move.toX,
        toY: move.toY,
        moveToken,
      });
    });

    if (capturedPiece) {
      let s = this.stateByPieceId.get(capturedPiece.id);
      if (s === undefined) {
        s = new PieceOptimisticState({ originalPiece: capturedPiece });
        this.stateByPieceId.set(capturedPiece.id, s);
      }
      s.addOptimisticCapture({
        moveToken,
        x: capturedPiece.x,
        y: capturedPiece.y,
      });
    }
  }

  skipSnapshotSimulation({ pieceId }) {
    const state = this.stateByPieceId.get(pieceId);
    if (!state) {
      return false;
    }
    const implied = state.impliedState();
    return implied !== null;
  }

  applyOptimisticState({ piecesById }) {
    for (const [id, state] of this.stateByPieceId) {
      const implied = state.impliedState();
      if (implied === null) {
        continue;
      } else if (implied.state === OSTATE.CAPTURED) {
        piecesById.delete(id);
      } else if (implied.state === OSTATE.MOVED) {
        const relevantPiece = piecesById.get(id);
        // CR nroyalty: make sure to copy over piece attributes here
        // For example, increment number of moves, set promotion, etc
        if (relevantPiece) {
          relevantPiece.x = implied.x;
          relevantPiece.y = implied.y;
          piecesById.set(id, relevantPiece);
        } else {
          const piece = { ...state.originalPiece };
          piece.x = implied.x;
          piece.y = implied.y;
          piecesById.set(id, piece);
        }
      }
    }
  }
}

class PieceHandler {
  constructor({ statsHandler }) {
    this.statsHandler = statsHandler;
    this.piecesById = new Map();
    this.optimisticStateHandler = new OptimisticState();

    this.moveToken = 1;
    this.subscribers = [];
    this.currentCoords = { x: null, y: null };
    this.lastSnapshotCoords = { x: null, y: null };

    this.activeMoves = [];
    this.activeCaptures = [];

    this.snapshotSeqnum = { from: -2, to: -1 };
  }

  getIncrMoveToken() {
    this.moveToken++;
    return this.moveToken;
  }

  addOptimisticMove({
    moveToken,
    piece,
    fromX,
    fromY,
    toX,
    toY,
    additionalMovedPiece,
    capturedPiece,
  }) {
    const receivedAt = performance.now();
    const simulatedMoves = [
      { pieceId: piece, fromX, fromY, toX, toY, receivedAt },
    ];
    const simulatedCaptures = [];

    if (additionalMovedPiece) {
      simulatedMoves.push({
        pieceId: additionalMovedPiece.id,
        fromX: additionalMovedPiece.fromX,
        fromY: additionalMovedPiece.fromY,
        toX: additionalMovedPiece.toX,
        toY: additionalMovedPiece.toY,
        receivedAt,
      });
    }
    if (capturedPiece) {
      simulatedCaptures.push({ piece: capturedPiece, receivedAt });
    }

    this.optimisticStateHandler.addOptimisticMove({
      moveToken,
      piece,
      fromX,
      fromY,
      toX,
      toY,
      additionalMovedPiece,
      capturedPiece,
    });

    this.broadcast({
      wasSnapshot: false,
      moves: simulatedMoves,
      appearances: [],
      captures: simulatedCaptures,
    });
  }

  confirmOptimisticMove({ moveToken }) {
    this.optimisticStateHandler.processServerConfirmation({ moveToken });
  }

  rejectOptimisticMove({ moveToken }) {
    const changes = this.optimisticStateHandler.processServerReject({
      moveToken,
    });
    changes.appearances.forEach((appearance) => {
      this.piecesById.set(appearance.id, appearance.piece);
    });
    changes.moves.forEach((move) => {
      this.piecesById.set(move.pieceId, move.piece);
    });
    changes.captures.forEach((capture) => {
      this.piecesById.delete(capture.id);
    });
    this.broadcast({
      wasSnapshot: false,
      moves: changes.moves,
      appearances: changes.appearances,
      captures: changes.captures,
    });
  }

  setCurrentCoords({ x, y }) {
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

    const piecesById = new Map();
    const simulatedMoves = [];
    const simulatedCaptures = [];
    const simulatedAppearances = [];
    const now = performance.now();

    // CR nroyalty: potentially invalidate optimistic updates?
    // Maybe not...snapshots could be stale...
    snapshot.pieces.forEach((piece) => {
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
            piecesById.set(movePieceId, ourPiece);
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
          piecesById.delete(ourPiece.id);
          activeCaptures.push(capture);
        }
      }
    });
    this.activeCaptures = activeCaptures;

    // we need to do this *after* we process the active moves and captures,
    // otherwise we'll end up potentially simulating a move or capture twice!
    snapshot.pieces.forEach((piece) => {
      if (
        this.optimisticStateHandler.skipSnapshotSimulation({
          pieceId: piece.id,
        })
      ) {
        // nothing to do!
        console.log(`Not simulating anything for piece ${piece.id}`);
      }
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
        if (
          this.optimisticStateHandler.skipSnapshotSimulation({
            pieceId: oldPieceId,
          })
        ) {
          console.log(`Not checking captures for piece ${oldPieceId}`);
        } else if (!piecesById.has(oldPieceId)) {
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

    this.optimisticStateHandler.applyOptimisticState({ piecesById });

    this.piecesById = piecesById;
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

  handleMovesNew({ moves: unfilteredMoves, captures: unfilteredCaptures }) {
    let dTotalMoves = 0;
    let dWhitePieces = 0;
    let dBlackPieces = 0;
    let dWhiteKings = 0;
    let dBlackKings = 0;
    const now = performance.now();

    const stateByPieceId = new Map();
    const moves = unfilteredMoves.filter(
      (move) => move.seqNum > this.snapshotSeqnum.from
    );
    const captures = unfilteredCaptures.filter(
      (capture) => capture.seqNum > this.snapshotSeqnum.from
    );

    moves.forEach((move) => {
      const ret = this.optimisticStateHandler.processServerMove({
        id: move.pieceId,
        fromX: move.fromX,
        fromY: move.fromY,
        toX: move.toX,
        toY: move.toY,
      });
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
          const dy = Math.abs(move.toY - move.fromY);
          const justDoubleMoved =
            dy === 2 && TYPE_TO_NAME[move.pieceType] === "pawn";
          const piece = {
            id: move.pieceId,
            x: move.toX,
            y: move.toY,
            type: move.pieceType,
            isWhite: move.isWhite,
            moveCount: move.moveCount,
            captureCount: move.captureCount,
            justDoubleMoved,
          };
          simulatedAppearances.push({
            piece,
            receivedAt: now,
          });
          this.piecesById.set(move.pieceId, piece);
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

          ourPiece.x = move.toX;
          ourPiece.y = move.toY;
          ourPiece.moveCount = move.moveCount;
          ourPiece.captureCount = move.captureCount;
          const dy = Math.abs(move.toY - move.fromY);
          const justDoubleMoved =
            dy === 2 && TYPE_TO_NAME[move.pieceType] === "pawn";
          ourPiece.justDoubleMoved = justDoubleMoved;
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
          // const locKey = pieceKey(ourPiece.x, ourPiece.y);
          this.piecesById.delete(ourPiece.id);

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

  // It's a little cringe that we compute piecesByLocation dynamically on every click
  // However, we only need it when computing moveable squares after a piece is selected,
  // which should only happen when a user clicks on a new piece (not that frequent)
  // And we get a lot of value not needing to keep an up to date map of pieces by location
  // as we process updates - both speed wise but especially in terms of complexity.
  //
  // Profiling suggest this takes milliseconds even on pretty slow processors, which isn't
  // a huge deal.
  getMoveableSquares(piece) {
    const piecesByLocation = new Map();
    const now = performance.now();
    for (const piece of this.piecesById.values()) {
      const key = pieceKey(piece.x, piece.y);
      piecesByLocation.set(key, piece);
    }
    const after = performance.now();
    const diff = after - now;
    console.log(`generation took: ${diff}ms`);
    return getMoveableSquares(piece, piecesByLocation);
  }
}

export default PieceHandler;
