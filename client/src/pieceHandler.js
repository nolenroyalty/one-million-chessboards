import { pieceKey, getMoveableSquares, TYPE_TO_NAME } from "./utils";

class PieceHandler {
  constructor({ statsHandler }) {
    this.statsHandler = statsHandler;
    this.pieces = new Map();
    this.subscribers = [];
    this.moves = [];
    this.captures = [];
    this.snapshotSeqnum = { from: -2, to: -1 };
  }

  filterBySeqnum({ list, afterSeqnum }) {
    return list.filter((item) => {
      return item.seqNum > afterSeqnum;
    });
  }

  subscribe({ id, callback }) {
    this.subscribers.push({ id, callback });
  }

  getMoves() {
    return this.moves;
  }

  getMoveMapByPieceId() {
    const ret = new Map();
    this.moves.forEach((move) => {
      ret.set(move.pieceId, move);
    });
    return ret;
  }

  getPieces() {
    return this.pieces;
  }

  getCaptures() {
    return this.captures;
  }

  getMoveableSquares(piece) {
    return getMoveableSquares(piece, this.pieces);
  }

  broadcast({ recentMoves, recentCaptures }) {
    this.subscribers.forEach(({ callback }) =>
      callback({
        pieces: this.pieces,
        moves: this.moves,
        recentMoves,
        recentCaptures,
      })
    );
  }

  unsubscribe({ id }) {
    this.subscribers = this.subscribers.filter(
      ({ id: subscriberId }) => subscriberId !== id
    );
  }

  _applyMove({ pieces, afterSeqnum, move }) {
    if (move.seqNum <= afterSeqnum) {
      return { skip: true };
    }

    const { fromX, fromY, toX, toY } = move;
    const fromKey = pieceKey(fromX, fromY);
    const toKey = pieceKey(toX, toY);

    pieces.delete(fromKey);
    const piece = {
      id: move.pieceId,
      x: toX,
      y: toY,
      type: move.pieceType,
      isWhite: move.isWhite,
      moveState: move.moveState,
    };
    pieces.set(toKey, piece);

    return { skip: false };
  }

  _piecesOfSnapshot({ snapshot }) {
    const pieces = new Map();
    snapshot.pieces.forEach((piece) => {
      pieces.set(pieceKey(piece.x, piece.y), piece);
    });
    return {
      pieces,
      startingSeqnum: snapshot.startingSeqnum,
      endingSeqnum: snapshot.endingSeqnum,
    };
  }

  handleSnapshot({ snapshot }) {
    const { pieces, startingSeqnum, endingSeqnum } = this._piecesOfSnapshot({
      snapshot,
    });
    const moves = this.filterBySeqnum({
      list: this.moves,
      afterSeqnum: startingSeqnum,
    });
    this.captures = this.filterBySeqnum({
      list: this.captures,
      afterSeqnum: startingSeqnum,
    });
    moves.forEach((move) => {
      this._applyMove({ pieces, move });
    });
    this.pieces = pieces;
    this.moves = moves;
    this.snapshotSeqnum = { from: startingSeqnum, to: endingSeqnum };
    this.broadcast({ recentMoves: [], recentCaptures: [] });
  }

  addReceivedAt(move) {
    move.receivedAt = performance.now();
  }

  handleMoves({ moves, captures }) {
    let dTotalMoves = 0;
    let dWhitePieces = 0;
    let dBlackPieces = 0;
    let dWhiteKings = 0;
    let dBlackKings = 0;
    moves.forEach((move) => {
      const { skip } = this._applyMove({
        pieces: this.pieces,
        move,
        afterSeqnum: this.snapshotSeqnum.from,
      });
      if (!skip) {
        this.addReceivedAt(move);
        this.moves.push(move);
        dTotalMoves++;
      } else {
        console.log("skipping move", move);
      }
    });
    const recentCaptures = [];
    captures.forEach((capture) => {
      if (capture.seqNum <= this.snapshotSeqnum.from) {
        console.log("skipping capture", capture);
      } else {
        this.addReceivedAt(capture);
        recentCaptures.push(capture);
        this.captures.push(capture);
        const pieceType = TYPE_TO_NAME[capture.capturedType];
        const wasKing = pieceType === "king";
        if (capture.wasWhite) {
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
    });
    this.statsHandler.applyPieceHandlerDelta({
      dTotalMoves,
      dWhitePieces,
      dBlackPieces,
      dWhiteKings,
      dBlackKings,
    });
    this.broadcast({ recentMoves: moves, recentCaptures });
  }
}

export default PieceHandler;
