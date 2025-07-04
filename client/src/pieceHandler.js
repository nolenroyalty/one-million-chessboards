import {
  pieceKey,
  getMoveableSquares,
  TYPE_TO_NAME,
  NAME_TO_TYPE,
} from "./utils";

import { chess } from "./protoCompiled.js";

const OACTION = {
  MOVE: "move",
  CAPTURE: "capture",
};

const ANIMATION = {
  MOVE: "move",
  CAPTURE: "capture",
  APPEARANCE: "appearance",
};

const REGULARLY_LOG_DEBUG_STATE = false;

// It's a little confusing, but we actually really really want
// fromX / fromY here. PieceDisplay only renders pieces that are currently
// visible to the user. If a piece is moving *to be* visible but wasn't visible
// before, PieceDisplay won't know its prior position and providing fromX and fromY
// lets it make a good decision about what to direction to animate it from

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
    this.actionsByPieceId = new Map();
    this.actionsByToken = new Map();
    this.tokensTouchingSquare = new Map();
    this.actionId = 1;

    if (REGULARLY_LOG_DEBUG_STATE) {
      this.interval = setInterval(() => {
        this._debugDumpState("interval");
      }, 1000);
    }
  }

  getIncrActionId() {
    const id = this.actionId;
    this.actionId++;
    return id;
  }

  _debugDumpState(desc) {
    console.debug(`OptimisticState (${desc}):`);
    let printed = false;
    for (const [pieceId, actions] of this.actionsByPieceId.entries()) {
      console.debug(`Piece ${pieceId}:`);
      printed = true;
      for (const action of actions) {
        console.debug(JSON.stringify(action, null, 2));
      }
      console.debug("---");
    }
    if (printed) {
      console.debug("---");
    }
    printed = false;
    for (const [token, actions] of this.actionsByToken.entries()) {
      console.debug(`Token ${token}:`);
      printed = true;
      for (const action of actions) {
        console.debug(JSON.stringify(action, null, 2));
      }
    }
    if (printed) {
      console.debug("---");
    }
    printed = false;
    console.debug("Tokens touching square:");
    for (const [squareKey, tokens] of this.tokensTouchingSquare.entries()) {
      console.debug(`${squareKey}: ${Array.from(tokens).join(", ")}`);
      printed = true;
    }
    if (printed) {
      console.debug("---");
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
    couldBeACapture,
    captureRequired,
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
      let wasPromotion = false;
      if (TYPE_TO_NAME[move.piece.type] === "pawn") {
        wasPromotion =
          (move.toY === 0 && move.piece.isWhite) ||
          (move.toY === 7999 && !move.piece.isWhite);
      }
      const action = {
        pieceId: move.piece.id,
        type: OACTION.MOVE,
        x: move.toX,
        y: move.toY,
        impactedSquares,
        moveToken,
        wasPromotion,
        actionId: this.getIncrActionId(),
        couldBeACapture,
        weThinkItWasACapture: !!capturedPiece,
      };

      actions.push(action);
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
        actionId: this.getIncrActionId(),
        captureRequired,
      };
      actions.push(action);
      animations.push(animateCapture({ piece: capturedPiece, receivedAt }));
    }

    for (const a of actions) {
      this._addActionForPieceId(a);
      this._addForToken(moveToken, a);
      a.impactedSquares.forEach((sq) => this._addSquareTouch(sq, moveToken));
    }

    return animations;
  }

  _addActionForPieceId(action) {
    if (!this.actionsByPieceId.has(action.pieceId)) {
      this.actionsByPieceId.set(action.pieceId, []);
    }
    this.actionsByPieceId.get(action.pieceId).push(action);
  }

  addAfterTheFactSimulatedCapture({
    capturingPieceId,
    maybeCapturedPiece,
    receivedAt,
  }) {
    const actionsForCapturingPiece =
      this.actionsByPieceId.get(capturingPieceId) || [];
    if (actionsForCapturingPiece.length === 0) {
      return;
    }

    const lastActionForCapturingPiece =
      actionsForCapturingPiece[actionsForCapturingPiece.length - 1];
    if (lastActionForCapturingPiece.type !== OACTION.MOVE) {
      return;
    }

    const moveTokenForLastAction = lastActionForCapturingPiece.moveToken;
    const impactedSquares = new Set();
    impactedSquares.add(pieceKey(maybeCapturedPiece.x, maybeCapturedPiece.y));
    const action = {
      type: OACTION.CAPTURE,
      x: maybeCapturedPiece.x,
      y: maybeCapturedPiece.y,
      pieceId: maybeCapturedPiece.id,
      impactedSquares,
      moveToken: moveTokenForLastAction,
      actionId: this.getIncrActionId(),
      captureRequired: false,
    };
    this._addActionForPieceId(action);
    this._addForToken(moveTokenForLastAction, action);
    const anim = animateCapture({ piece: maybeCapturedPiece, receivedAt });
    return anim;
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

    const actionIdsToRemove = new Set(actionsToRemove.map((a) => a.actionId));

    tokensAffected.forEach((token) => {
      const actions = this.actionsByToken.get(token);
      if (actions) {
        const remainingActions = actions.filter(
          (a) => !actionIdsToRemove.has(a.actionId)
        );
        if (remainingActions.length === 0) {
          this.actionsByToken.delete(token);
        } else {
          this.actionsByToken.set(token, remainingActions);
        }
      }
    });

    piecesAffected.forEach((pId) => {
      const pieceActions = this.actionsByPieceId.get(pId);
      if (pieceActions) {
        const remainingActions = pieceActions.filter(
          (a) => !tokensAffected.has(a.moveToken)
        );
        if (remainingActions.length === 0) {
          this.actionsByPieceId.delete(pId);
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
      const incrMoves = actions.length;
      const incrCaptures = actions.filter((a) => a.weThinkItWasACapture).length;
      const wasPromotion = actions.some((a) => a.wasPromotion);
      return {
        state: OACTION.MOVE,
        x: lastAction.x,
        y: lastAction.y,
        couldBeACapture: lastAction.couldBeACapture,
        incrMoves,
        incrCaptures,
        wasPromotion,
      };
    } else if (lastAction.type === OACTION.CAPTURE) {
      return {
        state: OACTION.CAPTURE,
        captureRequired: lastAction.captureRequired,
      };
    } else {
      console.warn(
        `Unknown last action type for piece ${pieceId}: ${lastAction.type}`
      );
      return null;
    }
  }

  pieceIsOptimisticallyTracked(pieceId) {
    const actions = this.actionsByPieceId.get(pieceId) || [];
    return actions.length !== 0;
  }

  processConfirmation({ moveToken }) {
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
        finalStates.set(action.pieceId, {
          state: OACTION.CAPTURE,
          pieceId: action.pieceId,
        });
      }
    });

    finalStates.forEach((state, pieceId) => {
      if (state.state === OACTION.CAPTURE) {
        groundTruthUpdates.push({ pieceId, state: OACTION.CAPTURE });
      } else if (state.state === OACTION.MOVE) {
        groundTruthUpdates.push({
          pieceId,
          state: OACTION.MOVE,
          x: state.x,
          y: state.y,
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

  revertAll() {
    const allTokens = new Set(this.actionsByToken.keys());
    const allPieceIds = new Set(this.actionsByPieceId.keys());
    return this.processRevert({ tokens: allTokens, pieceIds: allPieceIds });
  }

  revertSinglePieceId(pieceId) {
    const actions = this.actionsByPieceId.get(pieceId) || [];
    if (actions.length === 0) {
      return null;
    }
    const preRevertVisualState = this.getPredictedState(pieceId);
    this._removeActions(actions);
    return preRevertVisualState;
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
          // CR-someday nroyalty: complain if this is already set for another
          // piece?
          predictedLocToPieceId.set(
            pieceKey(predictedState.x, predictedState.y),
            pieceId
          );
        } else {
          console.warn(
            `BUG? predicted state of ${predictedState.state} for ${pieceId}`
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
    this.snapshotSeqnum = -1;

    this.moveToken = 1;
    this.subscribers = [];
    this.coordSubscribers = [];
    this.currentCoords = { x: null, y: null };
    this.lastSnapshotCoords = { x: null, y: null };

    this.activeCapturesByPieceId = new Map(); // pieceId -> seqnum

    // CR-someday nroyalty: implement this...
    // this.cachedCombinedView = null;
    // this.isCombinedViewCacheValid = false;
    this.connected = false;
  }

  setConnected(connected) {
    const wasConnected = this.connected;
    const nowConnected = connected;
    this.connected = connected;
    if (wasConnected && !nowConnected) {
      console.log(`disconnected - reverting optimistic state, etc`);
      const { preRevertVisualStates } = this.optimisticStateHandler.revertAll();
      this.activeCapturesByPieceId.clear();
      const receivedAt = performance.now();
      const animations = [];
      for (const [pieceId, visualState] of preRevertVisualStates.entries()) {
        const animation = this.animationForRevertedPiece({
          pieceId,
          preRevertVisualState: visualState,
          receivedAt,
        });
        if (animation) {
          animations.push(animation);
        }
      }
      this.snapshotSeqnum = -1;
      if (animations.length > 0) {
        this.broadcastAnimations({ animations });
      }
    }
  }

  getIncrMoveToken() {
    if (this.moveToken > 65000) {
      this.moveToken = 0;
    }
    this.moveToken++;
    return this.moveToken;
  }

  broadcastAnimations({ animations }) {
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

    const pieceIds = new Set(this.piecesById.keys());

    this.subscribers.forEach(({ callback }) => {
      callback({
        moves,
        captures,
        appearances,
        piecesById: this.piecesById,
        pieceIds,
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
    captureRequired,
    couldBeACapture,
  }) {
    const receivedAt = performance.now();
    let captureToUse = capturedPiece;
    if (capturedPiece) {
      // nroyalty: not obvious that we should use getPieceById here instead of
      // just using our raw piece state?
      const mostRecentCapturedPiece = this.getPieceById(capturedPiece.id);
      if (
        !mostRecentCapturedPiece ||
        mostRecentCapturedPiece.x !== capturedPiece.x ||
        mostRecentCapturedPiece.y !== capturedPiece.y
      ) {
        if (captureRequired) {
          // We were making a pawn move that required a capture but the piece
          // moved; we can almost certainly bail. I guess it's possible that
          // another piece of the opposite color has moved into the way, but
          // that is too much to handle...
          return;
        }
        captureToUse = null;
      }
    }
    const animations = this.optimisticStateHandler.addOptimisticMove({
      moveToken,
      movedPiece: { piece: movedPiece, toX, toY },
      additionalMovedPiece,
      capturedPiece: captureToUse,
      receivedAt,
      couldBeACapture,
      captureRequired,
    });
    this.broadcastAnimations({ animations });
  }

  confirmOptimisticMove({ moveToken, asOfSeqnum, capturedPieceId }) {
    // this.optimisticStateHandler._debugDumpState("before");
    const { groundTruthUpdates } =
      this.optimisticStateHandler.processConfirmation({
        moveToken,
      });
    // this.optimisticStateHandler._debugDumpState("after");
    const animations = [];
    let needToSimulateAdditionalCapture = true;
    if (capturedPieceId && capturedPieceId !== 0) {
      this.activeCapturesByPieceId.set(capturedPieceId, asOfSeqnum);
    }

    groundTruthUpdates.forEach((update) => {
      if (update.state === OACTION.CAPTURE) {
        if (update.pieceId === capturedPieceId) {
          // We captured the piece that we thought we were capturing!
          needToSimulateAdditionalCapture = false;
        } else {
          // we simulated a capture for a piece that we didn't actually capture lol
          const ourPiece = this.piecesById.get(update.pieceId);
          if (ourPiece) {
            animations.push(
              animateAppearance({
                piece: ourPiece,
                receivedAt: performance.now(),
              })
            );
          } else {
            // Well, maybe we moved somewhere else? Nothing to do here.
          }
        }
      } else if (update.state === OACTION.MOVE) {
        const ourPiece = this.piecesById.get(update.pieceId);
        if (ourPiece) {
          if (ourPiece.seqnum > asOfSeqnum) {
            // ground truth state is newer than this update
            if (
              this.optimisticStateHandler.pieceIsOptimisticallyTracked(
                update.pieceId
              )
            ) {
              // we made multiple optimistic moves for the piece, one was confirmed,
              // we still have more - we'll reconcile this in the future
              console.log(
                `not moving piece ${update.pieceId} because we still have simulated state for it`
              );
            } else if (ourPiece.x !== update.x || ourPiece.y !== update.y) {
              // We have a newer state for this piece and should make that
              // visible to the client.
              animations.push(
                animateMove({
                  piece: ourPiece,
                  fromX: update.x,
                  fromY: update.y,
                  receivedAt: performance.now(),
                })
              );
            } else {
              // we have newer state for this piece but it's consistent
            }
          } else {
            // update ground truth, no need for new animations
            ourPiece.x = update.x;
            ourPiece.y = update.y;
            ourPiece.moveCount++;
            ourPiece.seqnum = asOfSeqnum;
            if (capturedPieceId) {
              ourPiece.captureCount++;
            }
            this.piecesById.set(update.pieceId, ourPiece);
          }
        } else {
          // We probably moved somewhere else on the board.
        }
      }
    });

    if (needToSimulateAdditionalCapture) {
      if (this.piecesById.has(capturedPieceId)) {
        const ourPiece = this.piecesById.get(capturedPieceId);
        animations.push(
          animateCapture({
            piece: ourPiece,
            receivedAt: performance.now(),
          })
        );
        this.piecesById.delete(capturedPieceId);
      }
    }

    if (animations.length > 0) {
      this.broadcastAnimations({ animations });
    }
  }

  // As far as I can tell, we *don't* need to pass a sequence number for a rejection.
  // If our move is rejected, there is no reason to expect that any state associated
  // with our optimistic move is relevant in any way, so we can just revert to the
  // ground truth unconditionally.
  rejectOptimisticMove({ moveToken }) {
    const { preRevertVisualStates } = this.optimisticStateHandler.processRevert(
      {
        tokens: new Set([moveToken]),
        pieceIds: new Set(),
      }
    );
    const animations = [];
    const receivedAt = performance.now();

    for (const [pieceId, visualState] of preRevertVisualStates.entries()) {
      const animation = this.animationForRevertedPiece({
        pieceId,
        preRevertVisualState: visualState,
        receivedAt,
      });
      if (animation) {
        animations.push(animation);
      }
    }
    if (animations.length > 0) {
      this.broadcastAnimations({ animations });
    }
  }

  broadcastCoordsState() {
    this.coordSubscribers.forEach(({ callback }) => {
      callback({
        lastSnapshotCoords: this.lastSnapshotCoords,
      });
    });
  }

  setCurrentCoords({ x, y }) {
    this.currentCoords = { x, y };
  }

  _setLastSnapshotCoords({ x, y }) {
    this.lastSnapshotCoords = { x, y };
    this.broadcastCoordsState();
  }

  subscribe({ id, callback, type = "pieces" }) {
    if (type === "coords") {
      this.coordSubscribers.push({ id, callback });
      callback({
        currentCoords: this.currentCoords,
        lastSnapshotCoords: this.lastSnapshotCoords,
      });
    } else if (type === "pieces") {
      this.subscribers.push({ id, callback });
    } else {
      throw new Error(`Unknown subscriber type: ${type}`);
    }
  }

  unsubscribe({ id, type = "pieces" }) {
    if (type === "coords") {
      this.coordSubscribers = this.coordSubscribers.filter(
        ({ id: subscriberId }) => subscriberId !== id
      );
    } else if (type === "pieces") {
      this.subscribers = this.subscribers.filter(
        ({ id: subscriberId }) => subscriberId !== id
      );
    } else {
      throw new Error(`Unknown subscriber type: ${type}`);
    }
  }

  processGroundTruthAnimations({ animationsByPieceId, receivedAt }) {
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
          // We already have a capture in the works, so we probably just
          // revert the predicted state and broadcast that capture
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
            const ourPredictedState = predictedStateByPieceId.get(
              predictedPiece.id
            );
            // We *hope* that what happened is that `anim.piece` moved to the location
            // that we moved a piece to *before* we moved there, which means that
            // we captured the piece. This is only valid if we did a move that
            // let us capture a piece!
            if (ourPredictedState?.couldBeACapture) {
              const capturedPieceId = pieceId;
              const animationForCapturedPiece =
                this.optimisticStateHandler.addAfterTheFactSimulatedCapture({
                  capturingPieceId: predictedPiece.id,
                  maybeCapturedPiece: anim.piece,
                  receivedAt,
                });

              if (animationForCapturedPiece) {
                animationsByPieceId.set(
                  capturedPieceId,
                  animationForCapturedPiece
                );
              } else {
                revertPieceId(predictedPieceId);
              }
            } else {
              revertPieceId(predictedPieceId);
            }
          }
        } else {
          const predictedState = predictedStateByPieceId.get(pieceId);
          if (predictedState?.state === OACTION.MOVE) {
            // override the actual move with our predicted move (hopefully it's right)
            animationsByPieceId.delete(pieceId);
          } else if (predictedState?.state === OACTION.CAPTURE) {
            // no way this capture is correct; the piece wasn't in the place we thought
            if (predictedState.captureRequired) {
              // we did a move (moved a pawn diagonally) that required a capture.
              // given that the capture would have failed, we need to back out
              // the entire move.
              revertPieceId(pieceId);
            } else {
              // No capture required, not clear that this invalidates our
              // entire move
              this.optimisticStateHandler.revertSinglePieceId(pieceId);
              predictedStateByPieceId.delete(pieceId);
              predictedStateToRevert.set(pieceId, predictedState);
            }
          }
        }
      }
    }

    for (const [pieceId, predictedState] of predictedStateToRevert) {
      const animation = this.animationForRevertedPiece({
        pieceId,
        preRevertVisualState: predictedState,
        receivedAt,
      });
      // nroyalty: in the past we deleted here if animation was null. Consider
      // bringing that back if you see weird bugs, idk.
      if (animation) {
        animationsByPieceId.set(pieceId, animation);
      }
    }

    return { processedAnimationsByPieceId: animationsByPieceId };
  }

  animationForRevertedPiece({ pieceId, preRevertVisualState, receivedAt }) {
    const ourPiece = this.piecesById.get(pieceId);
    if (!ourPiece && preRevertVisualState.state === OACTION.CAPTURE) {
      // We simulated a capture, it was wrong, but we don't have a piece.
      // This could mean that we're looking somewhere else, or that the
      // piece was captured by a different move. Nothing to do.
      return null;
    } else if (!ourPiece && preRevertVisualState.state === OACTION.MOVE) {
      // We simulated a move and it was wrong but we don't have the piece anymore.
      // If the piece was captured we've already animated a capture for it.
      // We can't revert it back to its position (we don't have it!) so nothing to do.
      return null;
    } else if (ourPiece && preRevertVisualState.state === OACTION.CAPTURE) {
      // We simulated a capture but it was wrong! Make the piece appear
      return animateAppearance({ piece: ourPiece, receivedAt });
    } else if (ourPiece && preRevertVisualState.state === OACTION.MOVE) {
      const ourX = ourPiece.x;
      const ourY = ourPiece.y;
      const oldX = preRevertVisualState.x;
      const oldY = preRevertVisualState.y;
      if (ourX !== oldX || ourY !== oldY) {
        // Animate our piece back to its last known state
        return animateMove({
          piece: ourPiece,
          receivedAt,
          fromX: oldX,
          fromY: oldY,
        });
      } else {
        // We got lucky and our piece is in the right spot? maybe someone
        // else moved it there already.
        return null;
      }
    }
  }

  handleSnapshot({ snapshot, newConnection }) {
    // A new connection might mean our seqnum decreases; prefer the new snapshot
    // on a new connection even if data seems stale (server may have bounced)
    const FORCE_KEEP_SNAPSHOT_VALUES = newConnection;

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
    const newPiecesById = new Map();
    const newActiveCapturesByPieceId = new Map();
    const animationsByPieceId = new Map();

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

    snapshot.pieces.forEach((pieceSnapshot) => {
      // nroyalty PERFORMANCE:
      // this is a little gross, but we rely on copying our piece in several places
      // the shallow copies that we do won't copy over default values (which are
      // set on the prototype only) and it feels really easy to screw something up
      // there and forget to do a toObject call.
      //
      // So we just do it here, making our code safe. This will create more work
      // and more GC churn (probably) so if we're having performance issues in prod
      // we can revisit this.
      const piece = chess.PieceDataShared.toObject(pieceSnapshot.piece, {
        defaults: true,
      });
      piece.x = pieceSnapshot.dx + snapshot.xCoord;
      piece.y = pieceSnapshot.dy + snapshot.yCoord;
      piece.seqnum = snapshot.seqnum;
      newPiecesById.set(piece.id, piece);
    });

    for (const [pieceId, seqnum] of this.activeCapturesByPieceId) {
      if (seqnum > snapshot.seqnum) {
        newActiveCapturesByPieceId.set(pieceId, seqnum);
        if (newPiecesById.has(pieceId)) {
          newPiecesById.delete(pieceId);
        }
      }
    }

    const receivedAt = performance.now();
    // we need to do this *after* we process the active moves and captures,
    // otherwise we'll end up potentially simulating a move or capture twice!
    const snapshotSeqnum = snapshot.seqnum;
    let stalePieceCount = 0;
    for (const piece of newPiecesById.values()) {
      if (this.piecesById.has(piece.id)) {
        const oldPiece = this.piecesById.get(piece.id);
        if (FORCE_KEEP_SNAPSHOT_VALUES || oldPiece.seqnum < snapshotSeqnum) {
          if (oldPiece.x !== piece.x || oldPiece.y !== piece.y) {
            const animation = animateMove({
              fromX: oldPiece.x,
              fromY: oldPiece.y,
              piece: piece,
              receivedAt,
            });
            animationsByPieceId.set(piece.id, animation);
          }
        } else if (oldPiece.seqnum > snapshotSeqnum) {
          stalePieceCount++;
          newPiecesById.set(piece.id, oldPiece);
        } else {
          if (oldPiece.x !== piece.x || oldPiece.y !== piece.y) {
            console.warn(
              `BUG? piece ${piece.id} has same seqnum but different coords`
            );
          }
        }
      } else {
        const animation = animateAppearance({ piece, receivedAt });
        animationsByPieceId.set(piece.id, animation);
      }
    }

    if (stalePieceCount > 0) {
      console.warn(`${stalePieceCount} stale pieces in snapshot`);
    }

    // No need to compute captures if this snapshot is far away from our last
    // one (we'll be missing lots of pieces regardless)
    // CR-someday nroyalty: we should make this a little smarter by asking "should we expect
    // the missing piece to exist in the new snapshot window"
    if (shouldComputeSimulatedChanges) {
      for (const [oldPieceId, oldPiece] of this.piecesById) {
        if (!newPiecesById.has(oldPieceId)) {
          // This check probably shouldn't matter but it should be relatively cheap
          const existsInRecentCaptures =
            this.activeCapturesByPieceId.has(oldPieceId);
          if (!existsInRecentCaptures) {
            const animation = animateCapture({ piece: oldPiece, receivedAt });
            animationsByPieceId.set(oldPieceId, animation);
          }
        }
      }
    }

    this.activeCapturesByPieceId = newActiveCapturesByPieceId;
    this.piecesById = newPiecesById;
    this.snapshotSeqnum = Math.max(this.snapshotSeqnum, snapshot.seqnum);

    const { processedAnimationsByPieceId } = this.processGroundTruthAnimations({
      animationsByPieceId,
      receivedAt,
    });

    this._setLastSnapshotCoords({
      x: snapshot.xCoord,
      y: snapshot.yCoord,
    });

    this.broadcastAnimations({
      animations: processedAnimationsByPieceId.values(),
    });
  }

  handleAdoption({ adoptedIds }) {
    adoptedIds.forEach((id) => {
      const piece = this.piecesById.get(id);
      if (piece) {
        piece.adopted = true;
      }
    });
  }

  handleBulkCapture({ capturedIds, seqnum }) {
    const captures = capturedIds.map((id) => {
      return {
        capturedPieceId: id,
        seqnum,
      };
    });
    this.handleMoves({ moves: [], captures });
  }

  handleMoves({ moves, captures }) {
    const receivedAt = performance.now();
    const animationsByPieceId = new Map();
    const moveSeqnumsForStatsHandler = [];
    const capturesForStatsHandler = [];

    // this is annoying, but we want to remember the original location
    // of a piece in the case that we receive multiple moves for it in the
    // same tick
    const originalLocationByPieceId = new Map();

    moves.forEach((pieceDataForMove) => {
      const { seqnum, x, y, piece: pieceDataShared } = pieceDataForMove;
      const piece = chess.PieceDataShared.toObject(pieceDataShared, {
        defaults: true,
      });
      piece.seqnum = pieceDataForMove.seqnum;
      piece.x = x;
      piece.y = y;
      const currentPiece = this.piecesById.get(piece.id);
      moveSeqnumsForStatsHandler.push(seqnum);
      if (this.activeCapturesByPieceId.has(piece.id)) {
        // nothing to do here; this could happen if we've already receive an ack
        // for our move but haven't received the actual capture update yet
      } else if (!currentPiece) {
        // CR-someday nroyalty: only add move if it's somewhat close to where
        // we're looking!
        this.piecesById.set(piece.id, piece);
        const animation = animateAppearance({ piece, receivedAt });
        animationsByPieceId.set(piece.id, animation);
      } else if (seqnum < currentPiece.seqnum) {
        // Nothing to do! We already know about this state
      } else {
        // we only want to set this once, since our goal is to animate from
        // the original location before receiving any moves this tick
        if (!originalLocationByPieceId.has(piece.id)) {
          originalLocationByPieceId.set(piece.id, {
            x: currentPiece.x,
            y: currentPiece.y,
          });
        }
        this.piecesById.set(piece.id, piece);
        if (currentPiece.x === piece.x && currentPiece.y === piece.y) {
          // Weird, but nothing to do
        } else {
          let fromX = currentPiece.x;
          let fromY = currentPiece.y;
          if (originalLocationByPieceId.has(piece.id)) {
            fromX = originalLocationByPieceId.get(piece.id).x;
            fromY = originalLocationByPieceId.get(piece.id).y;
          }
          const animation = animateMove({
            fromX,
            fromY,
            piece,
            receivedAt,
          });
          animationsByPieceId.set(piece.id, animation);
        }
      }
    });

    captures.forEach((capture) => {
      const ourPiece = this.piecesById.get(capture.capturedPieceId);
      let wasKing = null;
      let wasWhite = null;
      if (ourPiece) {
        const pieceType = TYPE_TO_NAME[ourPiece.type];
        wasKing = pieceType === "king";
        wasWhite = ourPiece.isWhite;
        capturesForStatsHandler.push({
          seqnum: capture.seqnum,
          wasWhite,
          wasKing,
        });
      }

      if (capture.seqnum <= this.snapshotSeqnum) {
        // do nothing
      } else {
        if (ourPiece === undefined) {
          // probably a capture for somewhere we're not looking anymore?
        } else {
          this.activeCapturesByPieceId.set(
            capture.capturedPieceId,
            capture.seqnum
          );
          this.piecesById.delete(ourPiece.id);
          const animation = animateCapture({ piece: ourPiece, receivedAt });
          animationsByPieceId.set(ourPiece.id, animation);
        }
      }
    });

    this.statsHandler.addNewMovesAndCaptures({
      moveSeqnums: moveSeqnumsForStatsHandler,
      captures: capturesForStatsHandler,
    });

    const { processedAnimationsByPieceId } = this.processGroundTruthAnimations({
      animationsByPieceId,
      receivedAt,
    });

    this.broadcastAnimations({
      animations: processedAnimationsByPieceId.values(),
    });
  }

  getAllPieceIds() {
    return new Set(this.piecesById.keys());
  }

  // nroyalty performance: maybe this should take in the coords we want to
  // search for and not return the piece if it's outside those coords? would
  // let us avoid some copying
  getPieceById(id) {
    const predictedState = this.optimisticStateHandler.getPredictedState(id);
    const piece = this.piecesById.get(id);
    if (!piece) {
      return undefined;
    } else if (piece && predictedState) {
      if (predictedState.state === OACTION.CAPTURE) {
        return undefined;
      } else if (predictedState.state === OACTION.MOVE) {
        let type = piece.type;
        if (predictedState.wasPromotion && TYPE_TO_NAME[type] === "pawn") {
          type = NAME_TO_TYPE["promotedPawn"];
        }

        return {
          ...piece,
          moveCount: piece.moveCount + predictedState.incrMoves,
          captureCount: piece.captureCount + predictedState.incrCaptures,
          x: predictedState.x,
          y: predictedState.y,
          type,
        };
      }
    }
    return piece;
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
    const { predictedStateByPieceId, predictedLocToPieceId } =
      this.optimisticStateHandler.allPredictedStatesAndPositions();

    for (const piece of this.piecesById.values()) {
      const key = pieceKey(piece.x, piece.y);
      if (predictedLocToPieceId.has(key)) {
        // predicted piece exists here - we may be simulating a capture or
        // other weird state for this piece
        continue;
      } else if (predictedStateByPieceId.has(piece.id)) {
        // we're optimistically tracking something for this piece -
        // skip it for now
        continue;
      } else {
        piecesByLocation.set(key, piece);
      }
    }

    for (const [pieceId, predictedState] of predictedStateByPieceId) {
      if (predictedState.state === OACTION.CAPTURE) {
        // no need to consider captures for this!
        continue;
      } else if (predictedState.state === OACTION.MOVE) {
        const key = pieceKey(predictedState.x, predictedState.y);
        const piece = this.piecesById.get(pieceId);
        if (piece) {
          const dup = { ...piece, x: predictedState.x, y: predictedState.y };
          piecesByLocation.set(key, dup);
        } else {
          // maybe this means we've moved to another part of the board.
          console.warn(
            `Have predicted move for a piece that isn't in our state: ${pieceId}`
          );
        }
      }
    }
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

* DONE-ISH Figure out how to make everything work with move and capture processing
IN PROGRESS:
* add logic to resolve optimistic location / actual location mismatch for getPieceById
  functionality
* overlay optimistic locations on piecesByLocation map (related)
* don't roll back on color mismatch IF the relevant piece was capturable

DONE ^


* Once that works, figure out how to make everything work with state snapshot processing.
I think you can run this against just the delta that we compute?

DONE ^

* Remember, the most controversial rule is "if you currently have a 
simulated piece position that occupies a square that is now occupied by a piece
of the opposing color, you should pretend that you captured that piece." Handling this
is going to be tricky; To do it correctly I think
we need to create an additional fake optimistic move associated with the relevant
move token? Alternatively, maybe we can just handle it in our function that creates
a simulated view of the world?? Doing that seems preferrable if we can swing it

DONE ^

Finally, don't forget that we need to remove all optimistic moves 
when we disconnect from the server. 

DONE ^

And relatedly we need to display whether we're connected

DONE ^

Don't forget that you need to fix the zoomed out view :(

DONE ^ (could be better)
 */
