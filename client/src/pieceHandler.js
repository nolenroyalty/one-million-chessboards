import { pieceKey, getMoveableSquares, TYPE_TO_NAME } from "./utils";

class PieceHandler {
  constructor({ statsHandler }) {
    this.statsHandler = statsHandler;
    this.piecesByLocation = new Map();
    this.piecesById = new Map();
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
    return this.piecesByLocation;
  }

  getPieceById(id) {
    return this.piecesById.get(id);
  }

  getCaptures() {
    return this.captures;
  }

  getMoveableSquares(piece) {
    return getMoveableSquares(piece, this.piecesByLocation);
  }

  broadcast({ recentMoves, recentCaptures, wasSnapshot }) {
    this.subscribers.forEach(({ callback }) =>
      callback({
        pieces: this.piecesByLocation,
        moves: this.moves,
        recentMoves,
        recentCaptures,
        wasSnapshot,
      })
    );
  }

  unsubscribe({ id }) {
    this.subscribers = this.subscribers.filter(
      ({ id: subscriberId }) => subscriberId !== id
    );
  }

  _applyMove({ pieces, piecesById, afterSeqnum, move }) {
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
    piecesById.set(move.pieceId, piece);
    return { skip: false };
  }

  _piecesOfSnapshot({ snapshot }) {
    const pieces = new Map();
    const piecesById = new Map();
    snapshot.pieces.forEach((piece) => {
      pieces.set(pieceKey(piece.x, piece.y), piece);
      piecesById.set(piece.id, piece);
    });
    return {
      pieces,
      piecesById,
      startingSeqnum: snapshot.startingSeqnum,
      endingSeqnum: snapshot.endingSeqnum,
    };
  }

  handleSnapshot({ snapshot }) {
    if (snapshot.endingSeqnum <= this.snapshotSeqnum.from) {
      console.log("skipping STALE snapshot");
      return;
    }
    const { pieces, piecesById, startingSeqnum, endingSeqnum } =
      this._piecesOfSnapshot({
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
      this._applyMove({ pieces, piecesById, move, afterSeqnum: 0 });
    });
    this.piecesByLocation = pieces;
    this.piecesById = piecesById;
    this.moves = moves;
    this.snapshotSeqnum = { from: startingSeqnum, to: endingSeqnum };
    this.broadcast({ recentMoves: [], recentCaptures: [], wasSnapshot: true });
  }

  addReceivedAt(item, now) {
    item.receivedAt = now;
  }

  handleMoves({ moves, captures }) {
    let dTotalMoves = 0;
    let dWhitePieces = 0;
    let dBlackPieces = 0;
    let dWhiteKings = 0;
    let dBlackKings = 0;
    const now = performance.now();
    moves.forEach((move) => {
      const { skip } = this._applyMove({
        pieces: this.piecesByLocation,
        piecesById: this.piecesById,
        move,
        afterSeqnum: this.snapshotSeqnum.from,
      });
      if (!skip) {
        this.addReceivedAt(move, now);
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
        this.addReceivedAt(capture, now);
        recentCaptures.push(capture);
        this.captures.push(capture);
        this.piecesById.delete(capture.capturedPieceId);
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
    this.broadcast({ recentMoves: moves, recentCaptures, wasSnapshot: false });
  }
}

export default PieceHandler;
