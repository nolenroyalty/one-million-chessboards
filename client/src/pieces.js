import { pieceKey } from "./utils";

class Pieces {
  constructor() {
    this.pieces = new Map();
    this.subscribers = [];
    this.moves = [];
    this.snapshotSeqnum = { from: -2, to: -1 };
  }

  filterMoves({ moves, afterSeqnum }) {
    return moves.filter((move) => {
      return move.seqNum > afterSeqnum;
    });
  }

  subscribe({ id, callback }) {
    this.subscribers.push({ id, callback });
  }

  broadcast() {
    this.subscribers.forEach(({ callback }) =>
      callback({
        pieces: this.pieces,
        moves: this.moves,
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
    console.log("PIECE COUNT", pieces.size);
    const moves = this.filterMoves({
      moves: this.moves,
      afterSeqnum: startingSeqnum,
    });
    moves.forEach((move) => {
      this._applyMove({ pieces, move });
    });
    this.pieces = pieces;
    this.moves = moves;
    this.snapshotSeqnum = { from: startingSeqnum, to: endingSeqnum };
    this.broadcast();
  }

  handleMoves({ moves, captures }) {
    moves.forEach((move) => {
      const { skip } = this._applyMove({
        pieces: this.pieces,
        move,
      });
      if (!skip) {
        this.moves.push(move);
      }
    });
    console.log("captures", JSON.stringify(captures));
    this.broadcast();
  }
}

export default Pieces;
