import { pieceKey, getMoveableSquares, TYPE_TO_NAME } from "./utils";

const OACTION = {
  MOVE: "move",
  CAPTURE: "capture",
};

const ANIMATION = {
  MOVE: "move",
  CAPTURE: "capture",
  APPEARANCE: "appearance",
};

function animateMove({ pieceId, x, y }) {
  return { type: ANIMATION.MOVE, pieceId, x, y };
}

function animateCapture({ pieceId }) {
  return { type: ANIMATION.CAPTURE, pieceId };
}

class OptimisticState {
  constructor() {
    this.actionsByPieceId = new Map(); // Map<pieceId, OptimisticAction[]>
    this.actionsByToken = new Map(); // Map<moveToken, OptimisticAction[]>
    this.tokensTouchingSquare = new Map(); // Map<squareKey, Set<moveToken>>
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
    pieceId,
    fromX,
    fromY,
    toX,
    toY,
    additionalMovedPiece,
    capturedPiece,
  }) {
    const moves = [{ pieceId, fromX, fromY, toX, toY, moveToken }];
    if (additionalMovedPiece) {
      moves.push({ ...additionalMovedPiece, moveToken });
    }

    const actions = [];

    for (const move of moves) {
      const impactedSquares = new Set();
      impactedSquares.add(pieceKey(move.fromX, move.fromY));
      impactedSquares.add(pieceKey(move.toX, move.toY));
      const action = {
        ...move,
        type: OACTION.MOVE,
        impactedSquares,
      };
      actions.push(action);
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
      };
      actions.push(action);
    }

    const animations = [];

    for (const a of actions) {
      if (!this.actionsByPieceId.has(a.pieceId)) {
        this.actionsByPieceId.set(a.pieceId, []);
      }
      this.actionsByPieceId.get(a.pieceId).push(a);
      this._addForToken(moveToken, a);
      a.impactedSquares.forEach((sq) => this._addSquareTouch(sq, moveToken));
      if (a.type === OACTION.MOVE) {
        animations.push({ type: ANIMATION.MOVE, x: a.toX, y: toY });
      } else if (a.type === OACTION.CAPTURE) {
        animations.push({ type: ANIMATION.CAPTURE });
      }
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
      return { state: OACTION.MOVE, x: lastAction.toX, y: lastAction.toY };
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
          x: action.toX,
          y: action.toY,
        });
      } else if (action.type === OACTION.CAPTURE) {
        finalStates.set(action.pieceId, { state: OACTION.CAPTURE });
      }
    });

    finalStates.forEach((state, pieceId) => {
      if (state.state === OACTION.CAPTURE) {
        groundTruthUpdates.push({ pieceId, state: OACTION.CAPTURE });
      } else {
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

  _calculateDependencySet({ tokens = new Set(), pieces = new Set() }) {
    const allPiecesToRevert = new Set(pieces);
    const allActionsToConsider = new Set();
    const tokensToProcess = new Set(tokens);
    const processedTokens = new Set();

    pieces.forEach((pieceId) => {
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

  processRevert({ tokens = new Set(), pieces = new Set() }) {
    const { allPiecesToRevert, allActionsToRemove } =
      this._calculateDependencySet({ tokens, pieces });

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
}

class PieceHandler {
  constructor({ statsHandler }) {
    this.statsHandler = statsHandler;
    this.piecesById = new Map(); // Ground Truth Piece State
    this.optimisticStateHandler = new OptimisticState();
    this.groundTruthSeqNum = -1;

    this.moveToken = 1;
    this.subscribers = [];
    this.currentCoords = { x: null, y: null };

    this.cachedCombinedView = null;
    this.isCombinedViewCacheValid = false;
  }

  _invalidateCombinedViewCache() {
    this.isCombinedViewCacheValid = false;
    this.cachedCombinedView = null;
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
    // const simulatedMoves = [
    //   { pieceId: piece, fromX, fromY, toX, toY, receivedAt },
    // ];
    // const simulatedCaptures = [];

    // if (additionalMovedPiece) {
    //   simulatedMoves.push({
    //     pieceId: additionalMovedPiece.id,
    //     fromX: additionalMovedPiece.fromX,
    //     fromY: additionalMovedPiece.fromY,
    //     toX: additionalMovedPiece.toX,
    //     toY: additionalMovedPiece.toY,
    //     receivedAt,
    //   });
    // }
    // if (capturedPiece) {
    //   simulatedCaptures.push({ piece: capturedPiece, receivedAt });
    // }

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
  }
}

/* GOD DAMN I AM TOO TIRED TO KEEP CODING

Thoughts:
* Standardize on an animation type that we pass to PieceDisplay. 
  Add helper functions consistent with the output we expect over there
  eventually it'd be nice if we didn't pass so much data to piece display and it could
  figure things out from its own data, but idk whatever
* port over functions from pieceHandlerNew, DO NOT add optimistic update support yet, just
  get the new animations API working
  Ideally figure out how to remove the fromX/fromY stuff at this point, it'll be annoying
  to get that removed later!

* Implement addition and subtraction of optimistic moves. Don't do anything else. 
  No state processing or move / capture processing. 
  Make sure that this works

* Figure out how to make everything work with move and capture processing

* Once that works, figure out how to make everything work with state snapshot processing.
I think you can run this against just the delta that we compute?
 */
