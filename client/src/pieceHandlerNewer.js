import { pieceKey, getMoveableSquares, TYPE_TO_NAME } from "./utils";

const OACTION = {
  MOVE: "move",
  CAPTURE: "capture",
};

// CR nroyalty: do we need to distinguish between moves and appearances?
const ANIMATION = {
  MOVE: "move",
  CAPTURE: "capture",
  APPEARANCE: "appearance",
};

// It's a little confusing, but we actually really really want
// fromX / fromY here, because the piece may not be rendered in pieceDisplay
// and so pieceDisplay won't know what data to use to animate it!!
function animateMove({ piece, receivedAt, fromX, fromY }) {
  return {
    type: ANIMATION.MOVE,
    fromX,
    fromY,
    piece: { ...piece },
    receivedAt,
  };
}

function animateCapture({ piece, receivedAt }) {
  return { type: ANIMATION.CAPTURE, piece: { ...piece }, receivedAt };
}

function animateAppearance({ piece, receivedAt }) {
  return { type: ANIMATION.APPEARANCE, piece: { ...piece }, receivedAt };
}

class OptimisticState {
  constructor() {
    this.actionsByPieceId = new Map(); // Map<pieceId, OptimisticAction[]>
    this.actionsByToken = new Map(); // Map<moveToken, OptimisticAction[]>
    this.lastGroundTruthSeqnumByPieceId = new Map(); // Map<pieceId, seqNum>
    this.tokensTouchingSquare = new Map(); // Map<squareKey, Set<moveToken>>
  }

  _debugDumpState(desc) {
    console.log(`OptimisticState (${desc}):`);
    let printed = false;
    for (const [pieceId, actions] of this.actionsByPieceId.entries()) {
      console.log(`Piece ${pieceId}:`);
      printed = true;
      for (const action of actions) {
        console.log(JSON.stringify(action, null, 2));
      }
      console.log("---");
    }
    if (printed) {
      console.log("---");
    }
    printed = false;
    for (const [token, actions] of this.actionsByToken.entries()) {
      console.log(`Token ${token}:`);
      printed = true;
      for (const action of actions) {
        console.log(JSON.stringify(action, null, 2));
      }
    }
    if (printed) {
      console.log("---");
    }
    printed = false;
    console.log("Tokens touching square:");
    for (const [squareKey, tokens] of this.tokensTouchingSquare.entries()) {
      console.log(`${squareKey}: ${Array.from(tokens).join(", ")}`);
      printed = true;
    }
    if (printed) {
      console.log("---");
    }
  }

  _addSquareTouch(squareKey, moveToken) {
    if (!this.tokensTouchingSquare.has(squareKey)) {
      this.tokensTouchingSquare.set(squareKey, new Set());
    }
    this.tokensTouchingSquare.get(squareKey).add(moveToken);
  }

  _removeSquareTouch(squareKey, moveToken) {
    const tokens = this.tokensTouchingSquare.get(squareKey);
    if (tokens) {
      tokens.delete(moveToken);
      if (tokens.size === 0) {
        this.tokensTouchingSquare.delete(squareKey);
      }
    }
  }

  _addForToken(moveToken, action) {
    if (!this.actionsByToken.has(moveToken)) {
      this.actionsByToken.set(moveToken, []);
    }
    this.actionsByToken.get(moveToken).push(action);
  }

  addOptimisticMove({
    moveToken,
    movedPiece,
    additionalMovedPiece,
    capturedPiece,
    receivedAt,
    groundTruthSeqNum,
  }) {
    const moves = [movedPiece];
    if (additionalMovedPiece) {
      moves.push(additionalMovedPiece);
    }

    const actions = [];
    const animations = [];

    for (const move of moves) {
      const impactedSquares = new Set();
      impactedSquares.add(pieceKey(move.piece.x, move.piece.y));
      impactedSquares.add(pieceKey(move.toX, move.toY));
      const action = {
        pieceId: move.piece.id,
        type: OACTION.MOVE,
        x: move.toX,
        y: move.toY,
        impactedSquares,
        moveToken,
      };
      actions.push(action);
      // CR nroyalty: increment capture count, increment move count,
      // handle promotion (simulated!)
      const fromX = move.piece.x;
      const fromY = move.piece.y;
      const piece = { ...move.piece, x: move.toX, y: move.toY };
      animations.push(animateMove({ piece, fromX, fromY, receivedAt }));
    }

    if (capturedPiece) {
      const impactedSquares = new Set();
      impactedSquares.add(pieceKey(capturedPiece.x, capturedPiece.y));
      const action = {
        type: OACTION.CAPTURE,
        x: capturedPiece.x,
        y: capturedPiece.y,
        pieceId: capturedPiece.id,
        impactedSquares,
        moveToken,
      };
      actions.push(action);
      animations.push(animateCapture({ piece: capturedPiece, receivedAt }));
    }

    for (const a of actions) {
      if (!this.actionsByPieceId.has(a.pieceId)) {
        this.actionsByPieceId.set(a.pieceId, []);
      }
      this.actionsByPieceId.get(a.pieceId).push(a);
      this._maybeSetLastGroundTruthSeqnum(a.pieceId, groundTruthSeqNum);
      this._addForToken(moveToken, a);
      a.impactedSquares.forEach((sq) => this._addSquareTouch(sq, moveToken));
    }

    return animations;
  }

  _maybeSetLastGroundTruthSeqnum(pieceId, groundTruthSeqNum) {
    if (!this.lastGroundTruthSeqnumByPieceId.has(pieceId)) {
      this.lastGroundTruthSeqnumByPieceId.set(pieceId, groundTruthSeqNum);
    } else {
      const lastSeqNum = this.lastGroundTruthSeqnumByPieceId.get(pieceId);
      if (lastSeqNum < groundTruthSeqNum) {
        this.lastGroundTruthSeqnumByPieceId.set(pieceId, groundTruthSeqNum);
      }
    }
  }

  maybeBumpGroundTruthSeqnum(pieceId, groundTruthSeqNum) {
    // if we're not tracking this piece, no need to maintain seqnum
    // state for it
    if (!this.lastGroundTruthSeqnumByPieceId.has(pieceId)) {
      return;
    }

    const lastSeqNum = this.lastGroundTruthSeqnumByPieceId.get(pieceId);
    if (lastSeqNum < groundTruthSeqNum) {
      this.lastGroundTruthSeqnumByPieceId.set(pieceId, groundTruthSeqNum);
    }
  }

  _removeActions(actionsToRemove) {
    const tokensAffected = new Set();
    const piecesAffected = new Set();

    for (const action of actionsToRemove) {
      tokensAffected.add(action.moveToken);
      piecesAffected.add(action.pieceId);

      action.impactedSquares.forEach((sqKey) =>
        this._removeSquareTouch(sqKey, action.moveToken)
      );
    }

    tokensAffected.forEach((token) => {
      this.actionsByToken.delete(token);
    });

    piecesAffected.forEach((pId) => {
      const pieceActions = this.actionsByPieceId.get(pId);
      if (pieceActions) {
        const remainingActions = pieceActions.filter(
          (a) => !tokensAffected.has(a.moveToken)
        );
        if (remainingActions.length === 0) {
          this.actionsByPieceId.delete(pId);
          this.lastGroundTruthSeqnumByPieceId.delete(pId);
        } else {
          this.actionsByPieceId.set(pId, remainingActions);
        }
      }
    });
  }

  getPredictedState(pieceId) {
    const actions = this.actionsByPieceId.get(pieceId) || [];
    if (actions.length === 0) {
      return null;
    }

    const lastAction = actions[actions.length - 1];

    if (lastAction.type === OACTION.MOVE) {
      return { state: OACTION.MOVE, x: lastAction.x, y: lastAction.y };
    } else if (lastAction.type === OACTION.CAPTURE) {
      return { state: OACTION.CAPTURE };
    } else {
      console.warn(
        `Unknown last action type for piece ${pieceId}: ${lastAction.type}`
      );
      return null;
    }
  }

  processConfirmation(moveToken) {
    const confirmedActions = this.actionsByToken.get(moveToken) || [];
    if (confirmedActions.length === 0) {
      return { groundTruthUpdates: [] };
    }

    const groundTruthUpdates = [];
    const finalStates = new Map();

    confirmedActions.forEach((action) => {
      if (action.type === OACTION.MOVE) {
        finalStates.set(action.pieceId, {
          state: OACTION.MOVE,
          x: action.x,
          y: action.y,
        });
      } else if (action.type === OACTION.CAPTURE) {
        finalStates.set(action.pieceId, { state: OACTION.CAPTURE });
      }
    });

    finalStates.forEach((state, pieceId) => {
      const lastGroundTruthSeqnum =
        this.lastGroundTruthSeqnumByPieceId.get(pieceId);
      if (state.state === OACTION.CAPTURE) {
        groundTruthUpdates.push({ pieceId, state: OACTION.CAPTURE });
      } else {
        groundTruthUpdates.push({
          pieceId,
          state: OACTION.MOVE,
          x: state.x,
          y: state.y,
          lastGroundTruthSeqnum,
        });
      }
    });

    this._removeActions(confirmedActions);
    return { groundTruthUpdates };
  }

  _calculateDependencySet({ tokens = new Set(), pieceIds = new Set() }) {
    const allPiecesToRevert = new Set(pieceIds);
    const allActionsToConsider = new Set();
    const tokensToProcess = new Set(tokens);
    const processedTokens = new Set();

    pieceIds.forEach((pieceId) => {
      const actions = this.actionsByPieceId.get(pieceId) || [];
      actions.forEach((action) => {
        tokensToProcess.add(action.moveToken);
      });
    });

    while (tokensToProcess.size > 0) {
      const currentToken = tokensToProcess.values().next().value;
      tokensToProcess.delete(currentToken);
      processedTokens.add(currentToken);

      const actionsForCurrentToken =
        this.actionsByToken.get(currentToken) || [];

      actionsForCurrentToken.forEach((action) => {
        if (allActionsToConsider.has(action)) return;

        allActionsToConsider.add(action);

        const primaryPieceId = action.pieceId;
        if (!allPiecesToRevert.has(primaryPieceId)) {
          allPiecesToRevert.add(primaryPieceId);
          const otherActions = this.actionsByPieceId.get(primaryPieceId) || [];
          otherActions.forEach((oa) => {
            if (!processedTokens.has(oa.moveToken)) {
              tokensToProcess.add(oa.moveToken);
            }
          });
        }

        action.impactedSquares.forEach((sq) => {
          const tokensTouching = this.tokensTouchingSquare.get(sq) || new Set();
          tokensTouching.forEach((tt) => {
            if (!processedTokens.has(tt)) {
              tokensToProcess.add(tt);
            }
          });
        });
      });
    }

    return {
      allPiecesToRevert,
      allActionsToRemove: Array.from(allActionsToConsider),
    };
  }

  processRevert({ tokens = new Set(), pieceIds = new Set() }) {
    const { allPiecesToRevert, allActionsToRemove } =
      this._calculateDependencySet({ tokens, pieceIds });

    if (allActionsToRemove.length === 0) {
      return { preRevertVisualStates: new Map() };
    }

    const preRevertVisualStates = new Map();
    allPiecesToRevert.forEach((pieceId) => {
      const optimisticState = this.getPredictedState(pieceId);
      preRevertVisualStates.set(pieceId, optimisticState);
    });

    this._removeActions(allActionsToRemove);

    return { preRevertVisualStates };
  }

  allPredictedStatesAndPositions() {
    const predictedStateByPieceId = new Map();
    const predictedLocToPieceId = new Map();
    for (const pieceId of this.actionsByPieceId.keys()) {
      const predictedState = this.getPredictedState(pieceId);
      if (predictedState) {
        predictedStateByPieceId.set(pieceId, predictedState);
        if (predictedState.state === OACTION.CAPTURE) {
          // nothing else to do
        } else if (predictedState.state === OACTION.MOVE) {
          // CR nroyalty: complain if this is already set for another
          // piece?
          predictedLocToPieceId.set(
            pieceKey(predictedState.x, predictedState.y),
            pieceId
          );
        }
      } else {
        console.warn(`BUG? No predicted state for piece ${pieceId}`);
      }
    }
    return { predictedStateByPieceId, predictedLocToPieceId };
  }
}

class PieceHandler {
  constructor({ statsHandler }) {
    this.statsHandler = statsHandler;
    this.piecesById = new Map();
    this.optimisticStateHandler = new OptimisticState();
    this.snapshotSeqnum = { from: -2, to: -1 };

    this.moveToken = 1;
    this.subscribers = [];
    this.currentCoords = { x: null, y: null };
    // CR nroyalty: omg. We need to actually set last snapshot coords
    // based on the data we get from new snapshots!!!!
    this.lastSnapshotCoords = { x: null, y: null };

    this.activeMoves = [];
    this.activeCaptures = [];

    this.cachedCombinedView = null;
    this.isCombinedViewCacheValid = false;
  }

  _invalidateCaches() {
    this.isCombinedViewCacheValid = false;
    this.cachedCombinedView = null;
  }

  getIncrMoveToken() {
    this.moveToken++;
    return this.moveToken;
  }

  broadcastAnimations({ animations, wasSnapshot }) {
    const finalPieceStates = new Map();
    for (const animation of animations) {
      const last = finalPieceStates.get(animation.piece.id);
      if (last && last.type === ANIMATION.CAPTURE) {
        // No need to keep animating a piece if it's been captured
        // Shouldn't ever happen but you know
      } else {
        finalPieceStates.set(animation.piece.id, animation);
      }
    }
    const moves = [];
    const captures = [];
    const appearances = [];
    for (const animation of finalPieceStates.values()) {
      if (animation.type === ANIMATION.CAPTURE) {
        captures.push(animation);
      } else if (animation.type === ANIMATION.MOVE) {
        moves.push(animation);
      } else {
        appearances.push(animation);
      }
    }
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

  addOptimisticMove({
    moveToken,
    movedPiece,
    toX,
    toY,
    additionalMovedPiece,
    capturedPiece,
  }) {
    const receivedAt = performance.now();
    const animations = this.optimisticStateHandler.addOptimisticMove({
      moveToken,
      movedPiece: { piece: movedPiece, toX, toY },
      additionalMovedPiece,
      capturedPiece,
      receivedAt,
    });
    this.broadcastAnimations({ animations, wasSnapshot: false });
  }

  confirmOptimisticMove({ moveToken, asOfSeqnum }) {
    console.log(
      `move token confirmed: ${moveToken} (asOfSeqnum: ${asOfSeqnum})`
    );
    // this.optimisticStateHandler._debugDumpState("before");
    const { groundTruthUpdates } =
      this.optimisticStateHandler.processConfirmation(moveToken);
    // this.optimisticStateHandler._debugDumpState("after");
    const animations = [];

    // It really shouldn't happen, but if we get a late confirmation for a piece
    // and already have more up to date ground truth state for it, we want to avoid
    // updating our ground truth state based on the ack!
    groundTruthUpdates.forEach((update) => {
      const lastGroundTruthSeqnum = update.lastGroundTruthSeqnum;
      if (
        lastGroundTruthSeqnum !== undefined &&
        lastGroundTruthSeqnum > asOfSeqnum
      ) {
        // we have a ground truth update for this piece that is *NEWER* than the
        // confirmation that we received. In practice this should roughly never happen
        // based on how the server is designed, but let's be careful to handle it correctly
        console.log(
          `Ground truth update for piece ${update.pieceId} is newer than the confirmation that we received.`
        );
        const ourPiece = this.piecesById.get(update.pieceId);
        if (!ourPiece && update.state === OACTION.CAPTURE) {
          // This is expected...if the piece is confirmed captured, what else is there to say?
        } else if (ourPiece && update.state === OACTION.CAPTURE) {
          // This should be impossible - we should have already deleted the piece!
          console.warn(
            `BUG? Piece ${update.pieceId} is confirmed captured but still exists in our state`
          );
          this.piecesById.delete(update.pieceId);
        } else if (!ourPiece && update.state === OACTION.MOVE) {
          // Either the piece is captured and this is a late confirmation, or we've moved
          // to a new part of the grid. If it's the former there's nothing to do and if it's
          // the latter we don't care about this piece because we're not looking at it.
          console.debug(
            `Ignoring move confirmation for ${update.pieceId} because we do not have ground truth state for it`
          );
        } else if (ourPiece && update.state === OACTION.MOVE) {
          // If the simulated state for this piece doesn't line up with the ground truth
          // we should simulate a move to get the piece into the right place.
          if (ourPiece.x !== update.x || ourPiece.y !== update.y) {
            animations.push(
              animateMove({
                fromX: update.x,
                fromY: update.y,
                piece: ourPiece,
                receivedAt: performance.now(),
              })
            );
          }
        }
      } else {
        if (update.state === OACTION.MOVE) {
          const ourPiece = this.piecesById.get(update.pieceId);
          if (ourPiece) {
            ourPiece.x = update.x;
            ourPiece.y = update.y;
            this.piecesById.set(update.pieceId, ourPiece);
          } else {
            // maybe we've moved to another part of the grid? don't worry about it
            console.log(
              `Move confirmation for unknown piece, skipping: ${update.pieceId}`
            );
          }
        } else if (update.state === OACTION.CAPTURE) {
          this.piecesById.delete(update.pieceId);
        }
      }
    });

    if (animations.length > 0) {
      this.broadcastAnimations({ animations, wasSnapshot: false });
    }
  }

  // As far as I can tell, we *don't* need to pass a sequence number for a rejection.
  // If our move is rejected, there is no reason to expect that any state associated
  // with our optimistic move is relevant in any way, so we can just revert to the
  // ground truth unconditionally.
  rejectOptimisticMove({ moveToken }) {
    console.log(`move token rejected: ${moveToken}`);
    const { preRevertVisualStates } = this.optimisticStateHandler.processRevert(
      {
        tokens: new Set([moveToken]),
        pieceIds: new Set(),
      }
    );
    const animations = [];
    for (const [pieceId, visualState] of preRevertVisualStates.entries()) {
      const ourPiece = this.piecesById.get(pieceId);
      if (!ourPiece && visualState.state === OACTION.CAPTURE) {
        // nothing to do!
      } else if (ourPiece && visualState.state === OACTION.CAPTURE) {
        // There's a piece in the server state that we captured optimistically,
        // revert it by re-appearing it
        animations.push(
          animateAppearance({ piece: ourPiece, receivedAt: performance.now() })
        );
      } else if (ourPiece && visualState.state === OACTION.MOVE) {
        // There's a piece in the server state that we moved optimistically,
        // maybe revert it if it's not in the right spot (it probably isn't)
        const ourX = ourPiece.x;
        const ourY = ourPiece.y;
        const visualX = visualState.x;
        const visualY = visualState.y;
        if (ourX !== visualX || ourY !== visualY) {
          console.log(
            `reverting move for ${ourPiece.id} from ${ourX},${ourY} to ${visualX},${visualY}`
          );
          const move = animateMove({
            fromX: visualX,
            fromY: visualY,
            piece: ourPiece,
            receivedAt: performance.now(),
          });
          animations.push(move);
        }
      } else if (!ourPiece && visualState.state === OACTION.MOVE) {
        // ok SO this is tricky.
        // it feels like we need to simulate a capture for a piece that doesn't exist.
        // but if the piece doesn't exist, we should already have simulated the capture,
        // unless we've moved to another area of the grid.
        // it's probably fine to do nothing here.
      }
    }
    if (animations.length > 0) {
      this.broadcastAnimations({ animations, wasSnapshot: false });
    }
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

  // CR nroyalty: I think we can get rid of this; it doesn't
  // really make sense in a world where we fabricate lots of moves...
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
    const piecesById = new Map();
    const activeMoves = [];
    const activeCaptures = [];
    const animations = [];

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

    // CR nroyalty: potentially invalidate optimistic updates?
    // Maybe not...snapshots could be stale...
    snapshot.pieces.forEach((piece) => {
      piecesById.set(piece.id, piece);
    });

    this.activeMoves.forEach((move) => {
      if (move.seqNum > snapshot.startingSeqnum) {
        const movePieceId = move.piece.id;
        const ourPiece = piecesById.get(movePieceId);
        activeMoves.push(move);
        if (ourPiece) {
          if (ourPiece.x !== move.x || ourPiece.y !== move.y) {
            ourPiece.x = move.x;
            ourPiece.y = move.y;
            piecesById.set(movePieceId, ourPiece);
          }
        } else {
          const oldPiece = this.piecesById.get(movePieceId);
          if (!oldPiece) {
            // Move isn't in our snapshot, and also we haven't
            // processed it in the past? This seems insane
            console.warn(
              `BUG? ${JSON.stringify(move)} is not in old or new snapshot`
            );
          } else {
            // Move isn't in snapshot, but we processed it in the past
            // And added it to our old state
            oldPiece.x = move.x;
            oldPiece.y = move.y;
            piecesById.set(movePieceId, oldPiece);
          }
        }
      }
    });

    this.activeCaptures.forEach((capture) => {
      if (capture.seqNum > snapshot.startingSeqnum) {
        activeCaptures.push(capture);
        if (piecesById.has(capture.pieceId)) {
          piecesById.delete(capture.pieceId);
        }
      }
    });

    const receivedAt = performance.now();

    // we need to do this *after* we process the active moves and captures,
    // otherwise we'll end up potentially simulating a move or capture twice!
    snapshot.pieces.forEach((piece) => {
      // CR nroyalty: we need to check whether this piece creates a conflict
      if (this.piecesById.has(piece.id)) {
        const oldPiece = this.piecesById.get(piece.id);
        if (oldPiece.x !== piece.x || oldPiece.y !== piece.y) {
          // potential conflict: friendly piece intersects with the simulated final
          // position of on optimistic move
          // MAYBE some conflicts where a piece isn't where we expect it to be too
          // but we can probably rely on optimistic move cancellation to fix this
          animations.push(
            animateMove({
              fromX: oldPiece.x,
              fromY: oldPiece.y,
              piece: piece,
              receivedAt,
            })
          );
        }
      } else {
        // No need to compute appearances if the snapshot is far away from our
        // last one
        if (shouldComputeSimulatedChanges) {
          // potential conflict: friendly piece intersects with the simulated final
          // position of on optimistic move
          // Maybe other conflicts? I'm not sure.
          animations.push(animateAppearance({ piece, receivedAt }));
        }
      }
    });

    // No need to compute captures if this snapshot is far away from our last
    // one (we'll be missing lots of pieces regardless)
    // CR nroyalty: we could make this a little smarter by asking "should we expect
    // the missing piece to exist in the new snapshot window"
    if (shouldComputeSimulatedChanges) {
      for (const [oldPieceId, oldPiece] of this.piecesById) {
        if (!piecesById.has(oldPieceId)) {
          // This check probably shouldn't matter but it should be relatively cheap
          const existsInRecentCaptures = this.activeCaptures.some((elt) => {
            return elt.pieceId === oldPieceId;
          });
          if (!existsInRecentCaptures) {
            animations.push(animateCapture({ piece: oldPiece, receivedAt }));
          }
        }
      }
    }

    // CR nroyalty: make sure that optimistic stuff is overlaid here
    // CR nroyalty: invalidate our optimistic piece by location cache
    this.activeMoves = activeMoves;
    this.activeCaptures = activeCaptures;
    this.piecesById = piecesById;
    this.snapshotSeqnum = {
      from: snapshot.startingSeqnum,
      to: snapshot.endingSeqnum,
    };
    this.broadcastAnimations({ animations, wasSnapshot: true });
  }

  handleMoves({ moves, captures }) {
    let dTotalMoves = 0;
    let dWhitePieces = 0;
    let dBlackPieces = 0;
    let dWhiteKings = 0;
    let dBlackKings = 0;
    const receivedAt = performance.now();

    const animationsByPieceId = new Map();

    moves.forEach((move) => {
      if (move.seqNum <= this.snapshotSeqnum.from) {
        // nothing to do!
      } else {
        const ourPiece = this.piecesById.get(move.pieceId);
        // CR nroyalty: THIS IS SO MUCH BETTER WHEN WE JUST SUPPLY
        // PIECEDATA DIRECTLY, DO THAT SOON PLEASE
        const dy = Math.abs(move.toY - move.fromY);
        const justDoubleMoved =
          dy === 2 && TYPE_TO_NAME[move.pieceType] === "pawn";
        const movedPiece = {
          id: move.pieceId,
          x: move.toX,
          y: move.toY,
          type: move.pieceType,
          isWhite: move.isWhite,
          moveCount: move.moveCount,
          captureCount: move.captureCount,
          justDoubleMoved,
        };
        this.activeMoves.push({ seqNum: move.seqNum, piece: movedPiece });
        if (ourPiece === undefined) {
          const animation = animateAppearance({
            piece: movedPiece,
            receivedAt,
          });
          animationsByPieceId.set(movedPiece.id, animation);
          this.piecesById.set(movedPiece.id, movedPiece);
        } else {
          if (ourPiece.x === movedPiece.x && ourPiece.y === movedPiece.y) {
            this.piecesById.set(movedPiece.id, movedPiece);
          } else {
            this.piecesById.set(movedPiece.id, movedPiece);
            dTotalMoves++;
            const animation = animateMove({
              fromX: ourPiece.x,
              fromY: ourPiece.y,
              piece: movedPiece,
              receivedAt,
            });
            animationsByPieceId.set(movedPiece.id, animation);
          }
        }
      }
    });

    // CR nroyalty: we want to get rid of seqnums from captures. I think what we can
    // do is just maintain a buffer of recent captures and keep them around until
    // we get a snapshot that doesn't contain the piece. The only problem here is
    // around server restarts and captures getting reverted, which we'll need to
    // figure out down the line
    captures.forEach((capture) => {
      if (capture.seqNum <= this.snapshotSeqnum.from) {
        // do nothing
      } else {
        const ourPiece = this.piecesById.get(capture.capturedPieceId);
        this.activeCaptures.push({
          pieceId: capture.capturedPieceId,
          seqNum: capture.seqNum,
        });
        if (ourPiece === undefined) {
          // Do nothing?
          // Maybe we can still deal with invalidation if we get a capture
          // and it references a piece with x and y coordinates that disagree
          // with our optimistic update
        } else {
          this.piecesById.delete(ourPiece.id);
          // INVALIDATION: handle the case that we have a simulated move active
          // for a piece that was captured

          const pieceType = TYPE_TO_NAME[ourPiece.type];
          const wasWhite = ourPiece.isWhite;
          const wasKing = pieceType === "king";
          const animation = animateCapture({ piece: ourPiece, receivedAt });
          animationsByPieceId.set(ourPiece.id, animation);
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

    const unprocessedAnimations__DONOTRETURN = Array.from(
      animationsByPieceId.values()
    );
    const { predictedStateByPieceId, predictedLocToPieceId } =
      this.optimisticStateHandler.allPredictedStatesAndPositions();
    const predictedStateToRevert = new Map();

    const revertPieceId = (pieceId) => {
      const { preRevertVisualStates } =
        this.optimisticStateHandler.processRevert({
          tokens: new Set(),
          pieceIds: new Set([pieceId]),
        });

      for (const [revertId, pState] of preRevertVisualStates) {
        predictedStateByPieceId.delete(revertId);
        predictedStateToRevert.set(revertId, pState);
      }
    };

    for (const anim of unprocessedAnimations__DONOTRETURN) {
      const pieceId = anim.piece.id;
      if (anim.type === ANIMATION.CAPTURE) {
        const predictedState = predictedStateByPieceId.get(pieceId);
        if (predictedState?.state === OACTION.CAPTURE) {
          // Predicted capture. Already animated a capture. No work to do
          continue;
        } else if (predictedState?.state === OACTION.MOVE) {
          // predicted move, piece was captured, our move must be wrong
          revertPieceId(pieceId);
        }
      } else if (
        anim.type === ANIMATION.APPEARANCE ||
        anim.type === ANIMATION.MOVE
      ) {
        // We could make this substantially smarter. But for the time being we say
        // "if we get a new location for this piece, we still just hope that our
        // current location is valid - maybe we moved from the new location to our
        // current one." To make this really check out, we need to consider whether
        // we could have moved from the new current location to our tracked one.
        // But let's not worry about that for now. We'll get a reversion soon anyway
        //
        // Given the above, our concern with appearances or moved is actually whether
        // they invalidate *another* piece (e.g. if we're moving a white piece on top
        // of the predicted location of another white piece)
        const loc = pieceKey(anim.piece.x, anim.piece.y);
        const predictedPieceId = predictedLocToPieceId.get(loc);
        if (predictedPieceId !== undefined) {
          // uhoh, we have a piece there!
          const predictedPiece = this.piecesById.get(predictedPieceId);
          if (predictedPieceId === anim.piece.id) {
            // everything lines up. Nothing to do.
            animationsByPieceId.delete(predictedPieceId);
          } else if (!predictedPiece) {
            // wut
            console.warn(`unresolveable reversion for ${predictedPieceId}`);
          } else if (anim.piece.isWhite === predictedPiece.isWhite) {
            // another piece of the same color overlaps with the piece we're predicting
            // this cannot be true and almost certainly means that we're wrong
            revertPieceId(predictedPieceId);
          } else if (anim.piece.isWhite !== predictedPiece.isWhite) {
            // We *hope* that what happened is that `anim.piece` moved to the location
            // that we moved a piece to *before* we moved there, which means that
            // we captured the piece
            // CR nroyalty: handle this case!!
            revertPieceId(predictedPieceId);
          }
        } else {
          // override the actual move with our predicted move
          animationsByPieceId.delete(pieceId);
        }
      }
    }

    for (const [pieceId, predictedState] of predictedStateToRevert) {
      const ourPiece = this.piecesById.get(pieceId);
      if (!ourPiece && predictedState.state === OACTION.CAPTURE) {
        // convenient. Nothing to do.
        animationsByPieceId.delete(pieceId);
      } else if (!ourPiece && predictedState.state === OACTION.MOVE) {
        // we *should* already have a capture animation here
      } else if (ourPiece && predictedState.state === OACTION.CAPTURE) {
        const appearance = animateAppearance({ piece: ourPiece, receivedAt });
        animationsByPieceId.set(pieceId, appearance);
      } else if (ourPiece && predictedState.state === OACTION.MOVE) {
        const move = animateMove({
          piece: ourPiece,
          receivedAt,
          fromX: predictedState.x,
          fromY: predictedState.y,
        });
        animationsByPieceId.set(pieceId, move);
      }
    }

    this.statsHandler.applyPieceHandlerDelta({
      dTotalMoves,
      dWhitePieces,
      dBlackPieces,
      dWhiteKings,
      dBlackKings,
    });

    this.broadcastAnimations({
      wasSnapshot: false,
      animations: animationsByPieceId.values(),
    });
  }

  // CR nroyalty: do this using our optimistic piece overlay
  getPieceById(id) {
    return this.piecesById.get(id);
  }

  // CR nroyalty: do this using our optimistic piece overlay
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

/* GOD DAMN I AM TOO TIRED TO KEEP CODING

Thoughts:
* Standardize on an animation type that we pass to PieceDisplay. 
  Add helper functions consistent with the output we expect over there
  eventually it'd be nice if we didn't pass so much data to piece display and it could
  figure things out from its own data, but idk whatever
DONE

* port over functions from pieceHandlerNew, DO NOT add optimistic update support yet, just
  get the new animations API working
  Ideally figure out how to remove the fromX/fromY stuff at this point, it'll be annoying
  to get that removed later!
DONE

* Implement addition and subtraction of optimistic moves. Don't do anything else. 
  No state processing or move / capture processing. 
  Make sure that this works

IN PROGRESS
TODO:
* DONE test with multiple clients
* DONE test manually with invalid moves, confirm rejections work
* DONE track more state so that we can handle captures of pieces that don't exist
  - this isn't totally necessary, if pieces don't exist we don't need to show them
* DONE provide sequence numbers for rejections and acceptances 
* MAYBE TIE OPTIMISTIC MOVES TO CURRENT COORDS AND CLEAR THEM IF WE MOVE TO A NEW SQUARE

* Figure out how to make everything work with move and capture processing

* Once that works, figure out how to make everything work with state snapshot processing.
I think you can run this against just the delta that we compute?

* Remember, the most controversial rule is "if you currently have a 
simulated piece position that occupies a square that is now occupied by a piece
of the opposing color, you should pretend that you captured that piece." Handling this
is going to be tricky; To do it correctly I think
we need to create an additional fake optimistic move associated with the relevant
move token? Alternatively, maybe we can just handle it in our function that creates
a simulated view of the world?? Doing that seems preferrable if we can swing it

Finally, don't forget that we need to remove all optimistic moves 
when we disconnect from the server. And relatedly we need to display whether we're connected

Don't forget that you need to fix the zoomed out view :(
 */
