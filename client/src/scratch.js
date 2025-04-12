import { pieceKey, getMoveableSquares, TYPE_TO_NAME } from "./utils";

const OActionType = {
  MOVE: "move",
  CAPTURE: "capture", // Represents the capture action associated with a move
};

class OptimisticState {
  constructor() {
    this.actionsByPieceId = new Map(); // Map<pieceId, OptimisticAction[]>
    this.actionsByToken = new Map(); // Map<moveToken, OptimisticAction[]>
    this.tokensTouchingSquare = new Map(); // Map<squareKey, Set<moveToken>>
    this.optimisticPieces = new Set(); // Set<pieceId>
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

  addOptimisticAction(actionData) {
    const { moveToken, pieceId } = actionData;
    const impactedSquares = new Set();

    // Calculate impacted squares internally
    if (actionData.type === OActionType.MOVE) {
      impactedSquares.add(pieceKey(actionData.fromX, actionData.fromY));
      impactedSquares.add(pieceKey(actionData.toX, actionData.toY));
      // Also add capture square if applicable (relevant for square contention)
      if (actionData.captureX !== undefined) {
        impactedSquares.add(pieceKey(actionData.captureX, actionData.captureY));
      }
    } else if (actionData.type === OActionType.CAPTURE) {
      impactedSquares.add(pieceKey(actionData.captureX, actionData.captureY));
    }

    const action = { ...actionData, impactedSquares };

    // Track by Piece
    if (!this.actionsByPieceId.has(pieceId)) {
      this.actionsByPieceId.set(pieceId, []);
    }
    this.actionsByPieceId.get(pieceId).push(action);
    this.optimisticPieces.add(pieceId);

    // Track by Token
    if (!this.actionsByToken.has(moveToken)) {
      this.actionsByToken.set(moveToken, []);
    }
    this.actionsByToken.get(moveToken).push(action);

    // Track by Square
    impactedSquares.forEach((sqKey) => this._addSquareTouch(sqKey, moveToken));
  }

  removeActions(actionsToRemove) {
    const tokensAffected = new Set();
    const piecesAffected = new Set();

    for (const action of actionsToRemove) {
      tokensAffected.add(action.moveToken);
      piecesAffected.add(action.pieceId);

      action.impactedSquares.forEach((sqKey) =>
        this._removeSquareTouch(sqKey, action.moveToken)
      );
    }

    // Remove from token tracking
    tokensAffected.forEach((token) => {
      this.actionsByToken.delete(token); // Remove all actions for this token
    });

    // Remove from piece tracking
    piecesAffected.forEach((pId) => {
      const pieceActions = this.actionsByPieceId.get(pId);
      if (pieceActions) {
        const remainingActions = pieceActions.filter(
          (a) => !tokensAffected.has(a.moveToken) // Keep only actions from unaffected tokens
        );
        if (remainingActions.length === 0) {
          this.actionsByPieceId.delete(pId);
          this.optimisticPieces.delete(pId);
        } else {
          this.actionsByPieceId.set(pId, remainingActions);
        }
      }
    });
  }

  getPredictedState(pieceId, initialPieceState) {
    const actions = this.actionsByPieceId.get(pieceId) || [];
    const initialPos = initialPieceState
      ? {
          state: OActionType.MOVE,
          x: initialPieceState.x,
          y: initialPieceState.y,
        }
      : { state: OActionType.CAPTURE };

    if (actions.length === 0) {
      return initialPos;
    }

    let currentState = initialPos;
    for (const action of actions) {
      // Only process actions directly affecting *this* piece's state
      if (action.pieceId !== pieceId) continue;

      if (currentState.state === OActionType.CAPTURE) break; // Already captured

      if (action.type === OActionType.MOVE) {
        currentState = {
          state: OActionType.MOVE,
          x: action.toX,
          y: action.toY,
        };
      } else if (action.type === OActionType.CAPTURE) {
        currentState = { state: OActionType.CAPTURE };
      }
    }
    return currentState;
  }

  getCurrentVisualState(pieceId, initialPieceState) {
    // For now, visual state matches predicted state
    return this.getPredictedState(pieceId, initialPieceState);
  }

  processConfirmation(moveToken) {
    const actionsToRemove = this.actionsByToken.get(moveToken) || [];
    if (actionsToRemove.length > 0) {
      this.removeActions(actionsToRemove);
    }
    // No return needed, PieceHandler doesn't use it
  }

  processRejection(moveToken) {
    const actionsForToken = this.actionsByToken.get(moveToken) || [];
    const piecesToRevert = new Set();
    actionsForToken.forEach((a) => {
      piecesToRevert.add(a.pieceId);
    });
    // Let PieceHandler call calculateFullRevertSet
    return { piecesToRevert, actionsToRemove: actionsForToken };
  }

  calculateFullRevertSet(initialPiecesToRevert) {
    const allPiecesToRevert = new Set(initialPiecesToRevert);
    const allActionsToRemove = new Set();
    const tokensToProcess = new Set();
    const squaresToProcess = new Set(); // Squares potentially involved
    const processedTokens = new Set();

    // Seed with tokens from initial pieces
    initialPiecesToRevert.forEach((pieceId) => {
      const actions = this.actionsByPieceId.get(pieceId) || [];
      actions.forEach((action) => {
        if (!processedTokens.has(action.moveToken)) {
          tokensToProcess.add(action.moveToken);
        }
      });
    });

    while (tokensToProcess.size > 0) {
      const token = tokensToProcess.values().next().value;
      tokensToProcess.delete(token);
      processedTokens.add(token);

      const actions = this.actionsByToken.get(token) || [];
      actions.forEach((action) => {
        if (allActionsToRemove.has(action)) return;

        allActionsToRemove.add(action);
        const pieceId = action.pieceId;
        if (!allPiecesToRevert.has(pieceId)) {
          allPiecesToRevert.add(pieceId);
          // If we just added a piece, check its *other* actions for dependent tokens
          const otherActions = this.actionsByPieceId.get(pieceId) || [];
          otherActions.forEach((oa) => {
            if (!processedTokens.has(oa.moveToken)) {
              tokensToProcess.add(oa.moveToken);
            }
          });
        }

        // Check squares this action touched for other potentially dependent tokens
        action.impactedSquares.forEach((sq) => {
          const touchingTokens = this.tokensTouchingSquare.get(sq) || new Set();
          touchingTokens.forEach((tt) => {
            if (!processedTokens.has(tt)) {
              tokensToProcess.add(tt);
            }
          });
        });
      });
    }

    return {
      allPiecesToRevert,
      allActionsToRemove: Array.from(allActionsToRemove),
    };
  }

  getTokensTouchingSquare(squareKey) {
    return this.tokensTouchingSquare.get(squareKey) || new Set();
  }

  getActionsForToken(moveToken) {
    return this.actionsByToken.get(moveToken) || [];
  }

  isPieceOptimistic(pieceId) {
    return this.optimisticPieces.has(pieceId);
  }

  getOptimisticPieces() {
    return this.optimisticPieces;
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

  addOptimisticMove({ piece, toX, toY, additionalMovedPiece, capturedPiece }) {
    const moveToken = this.getIncrMoveToken();
    const receivedAt = performance.now();
    const initialAnimations = [];

    const mainMoveActionData = {
      type: OActionType.MOVE,
      moveToken,
      pieceId: piece.id,
      fromX: piece.x,
      fromY: piece.y,
      toX,
      toY,
      // Add capture coords for square tracking, but not capturedPieceId
      captureX: capturedPiece?.x,
      captureY: capturedPiece?.y,
    };
    this.optimisticStateHandler.addOptimisticAction(mainMoveActionData);
    initialAnimations.push({
      type: "move",
      pieceId: piece.id,
      fromX: piece.x,
      fromY: piece.y,
      toX: toX,
      toY: toY,
      receivedAt,
    });

    if (capturedPiece) {
      const captureActionData = {
        type: OActionType.CAPTURE,
        moveToken,
        pieceId: capturedPiece.id,
        captureX: capturedPiece.x,
        captureY: capturedPiece.y,
      };
      this.optimisticStateHandler.addOptimisticAction(captureActionData);
      initialAnimations.push({
        type: "capture",
        piece: capturedPiece,
        receivedAt,
      });
    }

    if (additionalMovedPiece) {
      const addPiece = additionalMovedPiece.piece;
      const addMoveActionData = {
        type: OActionType.MOVE,
        moveToken,
        pieceId: addPiece.id,
        fromX: addPiece.x,
        fromY: addPiece.y,
        toX: additionalMovedPiece.toX,
        toY: additionalMovedPiece.toY,
      };
      this.optimisticStateHandler.addOptimisticAction(addMoveActionData);
      initialAnimations.push({
        type: "move",
        pieceId: addPiece.id,
        fromX: addPiece.x,
        fromY: addPiece.y,
        toX: additionalMovedPiece.toX,
        toY: additionalMovedPiece.toY,
        receivedAt,
      });
    }

    this._invalidateCombinedViewCache();
    this.broadcast({ animations: initialAnimations, wasSnapshot: false });
  }

  confirmOptimisticMove({ moveToken }) {
    this.optimisticStateHandler.processConfirmation(moveToken);
    this._invalidateCombinedViewCache();
    // Optional broadcast if needed
  }

  rejectOptimisticMove({ moveToken }) {
    const { piecesToRevert, actionsToRemove } =
      this.optimisticStateHandler.processRejection(moveToken);

    if (actionsToRemove.length === 0) return;

    const { allPiecesToRevert, allActionsToRemove } =
      this.optimisticStateHandler.calculateFullRevertSet(piecesToRevert);

    // Target state for rejection is current ground truth
    const revertAnimations = this._calculateRevertAnimations(
      allPiecesToRevert,
      this.piecesById
    );
    this.optimisticStateHandler.removeActions(allActionsToRemove);

    this._invalidateCombinedViewCache();
    this.broadcast({ animations: revertAnimations, wasSnapshot: false });
  }

  handleSnapshot({ snapshot }) {
    if (snapshot.seqNum <= this.groundTruthSeqNum) {
      console.log(
        `Ignoring stale snapshot ${snapshot.seqNum} <= ${this.groundTruthSeqNum}`
      );
      return;
    }
    console.log(`Processing snapshot ${snapshot.seqNum}`);

    const receivedAt = performance.now();
    const piecesToRevert = new Set();
    const finalAnimations = new Map();

    const newGroundTruth = new Map();
    snapshot.pieces.forEach((p) => newGroundTruth.set(p.id, p));

    // Conflict Check (Aggressive Optimism Rules)
    this.optimisticStateHandler.getOptimisticPieces().forEach((pieceId) => {
      const currentGroundTruthPiece = this.piecesById.get(pieceId);
      const predictedState = this.optimisticStateHandler.getPredictedState(
        pieceId,
        currentGroundTruthPiece
      );
      const snapshotPiece = newGroundTruth.get(pieceId);
      const snapshotState = snapshotPiece
        ? { state: OActionType.MOVE, x: snapshotPiece.x, y: snapshotPiece.y }
        : { state: OActionType.CAPTURE };

      let revert = false;

      // Rule 4: Snapshot says captured, prediction didn't
      if (
        snapshotState.state === OActionType.CAPTURE &&
        predictedState.state !== OActionType.CAPTURE
      ) {
        revert = true;
      }
      // Rule 5: Friendly Block at Destination
      else if (predictedState.state === OActionType.MOVE) {
        const destKey = pieceKey(predictedState.x, predictedState.y);
        const blockingPiece = Array.from(newGroundTruth.values()).find(
          (p) =>
            p.id !== pieceId &&
            p.x === predictedState.x &&
            p.y === predictedState.y
        );
        if (
          blockingPiece &&
          snapshotPiece && // Ensure snapshotPiece exists to check color
          blockingPiece.isWhite === snapshotPiece.isWhite
        ) {
          revert = true;
        }
      }

      // Rule 6: Failed Dynamic Re-validation (Simplified check)
      if (
        !revert &&
        snapshotState.state === OActionType.MOVE &&
        predictedState.state === OActionType.MOVE &&
        (snapshotState.x !== predictedState.x ||
          snapshotState.y !== predictedState.y)
      ) {
        const anchorState = currentGroundTruthPiece
          ? { x: currentGroundTruthPiece.x, y: currentGroundTruthPiece.y }
          : null;
        if (
          !anchorState ||
          snapshotState.x !== anchorState.x ||
          snapshotState.y !== anchorState.y
        ) {
          // Snapshot differs from prediction AND anchor -> Unexpected state
          // TODO: Add dynamic revalidation check here if desired
          revert = true;
        }
      }

      if (revert) {
        piecesToRevert.add(pieceId);
      }
    });

    // Resolve Dependencies & Calculate Revert Animations
    let allPiecesToRevert = piecesToRevert;
    let allActionsToRemove = [];
    if (piecesToRevert.size > 0) {
      const result =
        this.optimisticStateHandler.calculateFullRevertSet(piecesToRevert);
      allPiecesToRevert = result.allPiecesToRevert;
      allActionsToRemove = result.allActionsToRemove;

      const revertAnimations = this._calculateRevertAnimations(
        allPiecesToRevert,
        newGroundTruth // Target state is the snapshot state
      );
      revertAnimations.forEach((anim) =>
        finalAnimations.set(this._getAnimationKey(anim), anim)
      );
      this.optimisticStateHandler.removeActions(allActionsToRemove);
    }

    // Calculate Standard Diff Animations
    const oldPieces = new Set(this.piecesById.keys());
    const newPieces = new Set(newGroundTruth.keys());
    const allPieceIds = new Set([...oldPieces, ...newPieces]);

    allPieceIds.forEach((pieceId) => {
      const oldPiece = this.piecesById.get(pieceId);
      const newPiece = newGroundTruth.get(pieceId);
      const animationKey = pieceId; // Use pieceId as key

      // Skip if handled by revert logic OR if no change occurred
      if (allPiecesToRevert.has(pieceId)) return;
      if (
        oldPiece &&
        newPiece &&
        oldPiece.x === newPiece.x &&
        oldPiece.y === newPiece.y &&
        oldPiece.type === newPiece.type
      )
        return; // No change relevant to animation
      if (!oldPiece && !newPiece) return; // Should not happen

      let animation = null;
      if (oldPiece && !newPiece) {
        animation = { type: "capture", piece: oldPiece, receivedAt };
      } else if (!oldPiece && newPiece) {
        animation = { type: "appearance", piece: newPiece, receivedAt };
      } else if (oldPiece && newPiece) {
        // Position or type must have changed
        animation = {
          type: "move",
          pieceId: pieceId,
          fromX: oldPiece.x,
          fromY: oldPiece.y,
          toX: newPiece.x,
          toY: newPiece.y,
          receivedAt,
        };
      }

      if (animation) {
        // Only add if not already covered by a revert animation for the same piece
        if (!finalAnimations.has(animationKey)) {
          finalAnimations.set(animationKey, animation);
        }
      }
    });

    // Update State
    this.piecesById = newGroundTruth;
    this.groundTruthSeqNum = snapshot.seqNum;
    this._invalidateCombinedViewCache();

    // Broadcast
    this.broadcast({
      animations: Array.from(finalAnimations.values()),
      wasSnapshot: true,
    });
  }

  handleMoves({ moves, captures }) {
    const receivedAt = performance.now();
    const piecesToRevert = new Set();
    const finalAnimations = new Map();

    const relevantMoves = moves.filter(
      (m) => m.seqNum > this.groundTruthSeqNum
    );
    const relevantCaptures = captures.filter(
      (c) => c.seqNum > this.groundTruthSeqNum
    );
    if (relevantMoves.length === 0 && relevantCaptures.length === 0) return;

    let maxSeqNum = this.groundTruthSeqNum;
    relevantMoves.forEach((m) => (maxSeqNum = Math.max(maxSeqNum, m.seqNum)));
    relevantCaptures.forEach(
      (c) => (maxSeqNum = Math.max(maxSeqNum, c.seqNum))
    );

    // Create the target state after applying this batch
    const nextGroundTruth = new Map(this.piecesById);
    relevantMoves.forEach((m) => {
      let piece = nextGroundTruth.get(m.pieceId);
      if (!piece) {
        // Piece appeared
        piece = { id: m.pieceId, isWhite: m.isWhite, type: m.pieceType }; // Add base info
        nextGroundTruth.set(m.pieceId, piece);
      }
      piece.x = m.toX;
      piece.y = m.toY;
      piece.moveCount = m.moveCount;
      const dy = Math.abs(m.toY - m.fromY);
      piece.justDoubleMoved = dy === 2 && TYPE_TO_NAME[m.pieceType] === "pawn";
      // piece.captureCount = m.captureCount; // Assuming server sends this
      // piece.type = m.pieceType; // Handle promotion
    });
    relevantCaptures.forEach((c) => {
      nextGroundTruth.delete(c.capturedPieceId);
    });

    // Conflict Check
    relevantMoves.forEach((move) => {
      const movedPieceId = move.pieceId;
      const destKey = pieceKey(move.toX, move.toY);
      const movedPieceData = nextGroundTruth.get(movedPieceId);

      // Rule 3: Friendly Block by Server Event
      const blockingPiece = Array.from(nextGroundTruth.values()).find(
        (p) => p.id !== movedPieceId && p.x === move.toX && p.y === move.toY
      );
      if (
        blockingPiece &&
        movedPieceData &&
        blockingPiece.isWhite === movedPieceData.isWhite
      ) {
        // Check if the *blocked* square was an optimistic target
        this.optimisticStateHandler
          .getTokensTouchingSquare(destKey)
          .forEach((token) => {
            this.optimisticStateHandler
              .getActionsForToken(token)
              .forEach((action) => {
                if (
                  action.type === OActionType.MOVE &&
                  action.toX === move.toX &&
                  action.toY === move.toY
                ) {
                  piecesToRevert.add(action.pieceId);
                }
              });
          });
      }

      // Rule 2: Direct contradiction for the moved piece
      if (this.optimisticStateHandler.isPieceOptimistic(movedPieceId)) {
        const optimisticPieceGround = this.piecesById.get(movedPieceId);
        const predictedState = this.optimisticStateHandler.getPredictedState(
          movedPieceId,
          optimisticPieceGround
        );
        if (
          predictedState.state === OActionType.MOVE &&
          (predictedState.x !== move.toX || predictedState.y !== move.toY)
        ) {
          piecesToRevert.add(movedPieceId);
        } else if (predictedState.state === OActionType.CAPTURE) {
          piecesToRevert.add(movedPieceId);
        }
      }
    });

    relevantCaptures.forEach((capture) => {
      const capturedPieceId = capture.capturedPieceId;
      // Rule 2: Check if captured piece had non-capture prediction
      if (this.optimisticStateHandler.isPieceOptimistic(capturedPieceId)) {
        const optimisticPieceGround = this.piecesById.get(capturedPieceId);
        const predictedState = this.optimisticStateHandler.getPredictedState(
          capturedPieceId,
          optimisticPieceGround
        );
        if (predictedState.state !== OActionType.CAPTURE) {
          piecesToRevert.add(capturedPieceId);
        }
      }
    });

    // Resolve Dependencies & Calculate Revert Animations
    let allPiecesToRevert = piecesToRevert;
    let allActionsToRemove = [];
    if (piecesToRevert.size > 0) {
      const result =
        this.optimisticStateHandler.calculateFullRevertSet(piecesToRevert);
      allPiecesToRevert = result.allPiecesToRevert;
      allActionsToRemove = result.allActionsToRemove;

      const revertAnimations = this._calculateRevertAnimations(
        allPiecesToRevert,
        nextGroundTruth // Target state is after applying this batch
      );
      revertAnimations.forEach((anim) =>
        finalAnimations.set(this._getAnimationKey(anim), anim)
      );
      this.optimisticStateHandler.removeActions(allActionsToRemove);
    }

    // Calculate Standard Diff Animations
    const oldPieces = new Set(this.piecesById.keys());
    const newPieces = new Set(nextGroundTruth.keys());
    const allPieceIds = new Set([...oldPieces, ...newPieces]);

    allPieceIds.forEach((pieceId) => {
      if (allPiecesToRevert.has(pieceId)) return;

      const oldPiece = this.piecesById.get(pieceId);
      const newPiece = nextGroundTruth.get(pieceId);
      const animationKey = pieceId;

      if (oldPiece && !newPiece) {
        if (!finalAnimations.has(animationKey)) {
          finalAnimations.set(animationKey, {
            type: "capture",
            piece: oldPiece,
            receivedAt,
          });
        }
      } else if (!oldPiece && newPiece) {
        if (!finalAnimations.has(animationKey)) {
          finalAnimations.set(animationKey, {
            type: "appearance",
            piece: newPiece,
            receivedAt,
          });
        }
      } else if (
        oldPiece &&
        newPiece &&
        (oldPiece.x !== newPiece.x || oldPiece.y !== newPiece.y)
      ) {
        if (!finalAnimations.has(animationKey)) {
          finalAnimations.set(animationKey, {
            type: "move",
            pieceId: pieceId,
            fromX: oldPiece.x,
            fromY: oldPiece.y,
            toX: newPiece.x,
            toY: newPiece.y,
            receivedAt,
          });
        }
      }
    });

    // Update State
    this.piecesById = nextGroundTruth;
    this.groundTruthSeqNum = maxSeqNum;
    this._invalidateCombinedViewCache();

    // Broadcast
    this.broadcast({
      animations: Array.from(finalAnimations.values()),
      wasSnapshot: false,
    });
  }

  _getAnimationKey(animation) {
    // Helper to get a consistent key for the finalAnimations map
    return animation.pieceId || animation.piece?.id;
  }

  _calculateRevertAnimations(piecesToRevert, targetStateMap) {
    const animations = [];
    const now = performance.now();
    piecesToRevert.forEach((pieceId) => {
      const currentGroundTruth = this.piecesById.get(pieceId);
      // Pass ground truth here, getPredictedState handles null correctly
      const displayState = this.optimisticStateHandler.getCurrentVisualState(
        pieceId,
        currentGroundTruth
      );
      const targetPiece = targetStateMap.get(pieceId);
      const targetState = targetPiece
        ? { state: OActionType.MOVE, x: targetPiece.x, y: targetPiece.y }
        : { state: OActionType.CAPTURE };

      let animation = null;
      if (
        displayState.state === OActionType.MOVE &&
        targetState.state === OActionType.MOVE
      ) {
        if (
          displayState.x !== targetState.x ||
          displayState.y !== targetState.y
        ) {
          animation = {
            type: "move",
            pieceId: pieceId,
            fromX: displayState.x,
            fromY: displayState.y,
            toX: targetState.x,
            toY: targetState.y,
            receivedAt: now,
          };
        }
      } else if (
        displayState.state === OActionType.MOVE &&
        targetState.state === OActionType.CAPTURE
      ) {
        // Need to reconstruct a minimal piece object for the animation
        const pieceForAnim = {
          id: pieceId,
          x: displayState.x,
          y: displayState.y,
          ...(currentGroundTruth || {}),
        };
        animation = { type: "capture", piece: pieceForAnim, receivedAt: now };
      } else if (
        displayState.state === OActionType.CAPTURE &&
        targetState.state === OActionType.MOVE
      ) {
        // Need the full piece info from the target state
        animation = { type: "appearance", piece: targetPiece, receivedAt: now };
      }

      if (animation) {
        animations.push(animation);
      }
    });
    return animations;
  }

  broadcast({ animations, wasSnapshot }) {
    const viewPiecesById = this._generateCombinedView(); // Use cached or generate

    this.subscribers.forEach(({ callback }) => {
      callback({
        // Split animations by type for PieceDisplay
        moves: animations.filter((a) => a.type === "move"),
        captures: animations.filter((a) => a.type === "capture"),
        appearances: animations.filter((a) => a.type === "appearance"),
        piecesById: viewPiecesById,
        wasSnapshot,
      });
    });
  }

  _generateCombinedView() {
    if (this.isCombinedViewCacheValid) {
      return this.cachedCombinedView;
    }

    const combinedView = new Map(this.piecesById);
    this.optimisticStateHandler.getOptimisticPieces().forEach((pieceId) => {
      const groundTruthPiece = this.piecesById.get(pieceId);
      const predictedState = this.optimisticStateHandler.getPredictedState(
        pieceId,
        groundTruthPiece // Pass ground truth state here
      );

      if (predictedState.state === OActionType.CAPTURE) {
        combinedView.delete(pieceId);
      } else if (predictedState.state === OActionType.MOVE) {
        const piece = combinedView.get(pieceId);
        if (piece) {
          // Create a new object to avoid mutating the ground truth map's values
          const updatedPiece = { ...piece };
          updatedPiece.x = predictedState.x;
          updatedPiece.y = predictedState.y;
          combinedView.set(pieceId, updatedPiece);
        } else {
          // This case (optimistic move for non-existent piece) should ideally
          // not happen if addOptimisticMove always starts from ground truth.
          // Log a warning if it occurs.
          console.warn(
            `Optimistic move state for non-existent ground truth piece ${pieceId}`
          );
        }
      }
    });

    this.cachedCombinedView = combinedView;
    this.isCombinedViewCacheValid = true;
    return combinedView;
  }

  getPieceById(id) {
    const combinedView = this._generateCombinedView();
    return combinedView.get(id);
  }

  getPiecesById() {
    return this._generateCombinedView();
  }

  getMoveableSquares(piece) {
    const currentView = this.getPiecesById();
    const pieceInView = currentView.get(piece.id);

    if (!pieceInView) return [];

    const piecesByLocation = new Map();
    for (const p of currentView.values()) {
      const key = pieceKey(p.x, p.y);
      piecesByLocation.set(key, p);
    }
    return getMoveableSquares(pieceInView, piecesByLocation);
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

  clearOptimisticState() {
    console.log("Clearing all optimistic state due to disconnect/error.");
    const allOptimisticPieces = new Set(
      this.optimisticStateHandler.getOptimisticPieces()
    );
    if (allOptimisticPieces.size > 0) {
      const revertAnimations = this._calculateRevertAnimations(
        allOptimisticPieces,
        this.piecesById
      );
      this.optimisticStateHandler = new OptimisticState(); // Reset state handler
      this._invalidateCombinedViewCache();
      this.broadcast({ animations: revertAnimations, wasSnapshot: false });
    } else {
      this.optimisticStateHandler = new OptimisticState(); // Reset just in case
      this._invalidateCombinedViewCache(); // Still invalidate cache
    }
  }
}

export default PieceHandler;
