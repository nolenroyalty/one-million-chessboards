const YOUR_MOVES_KEY = "yourMoves";
const YOUR_CAPTURES_KEY = "yourCaptures";

class StatsHandler {
  constructor() {
    this.totalMoves = 0;
    this.whitePiecesRemaining = 0;
    this.blackPiecesRemaining = 0;
    this.whiteKingsRemaining = 0;
    this.blackKingsRemaining = 0;
    try {
      const yourMoves = localStorage.getItem(YOUR_MOVES_KEY);
      this.yourMoves = yourMoves ? parseInt(yourMoves) : 0;
    } catch (e) {
      console.error("Error getting moves from localStorage", e);
      this.yourMoves = 0;
    }
    try {
      const yourCaptures = localStorage.getItem(YOUR_CAPTURES_KEY);
      this.yourCaptures = yourCaptures ? parseInt(yourCaptures) : 0;
    } catch (e) {
      console.error("Error getting captures from localStorage", e);
      this.yourCaptures = 0;
    }
    this.hasReceivedUpdate = false;

    this.localDelta = {
      totalMoves: 0,
      whitePiecesRemaining: 0,
      blackPiecesRemaining: 0,
      whiteKingsRemaining: 0,
      blackKingsRemaining: 0,
    };

    this.subscribers = [];
  }

  subscribe({ id, callback }) {
    this.subscribers.push({ id, callback });
  }

  getStats() {
    return {
      totalMoves: this.totalMoves + this.localDelta.totalMoves,
      whitePiecesRemaining:
        this.whitePiecesRemaining + this.localDelta.whitePiecesRemaining,
      blackPiecesRemaining:
        this.blackPiecesRemaining + this.localDelta.blackPiecesRemaining,
      whiteKingsRemaining:
        this.whiteKingsRemaining + this.localDelta.whiteKingsRemaining,
      blackKingsRemaining:
        this.blackKingsRemaining + this.localDelta.blackKingsRemaining,
      hasReceivedUpdate: this.hasReceivedUpdate,
      yourMoves: this.yourMoves,
      yourCaptures: this.yourCaptures,
    };
  }

  applyLocalDelta(
    {
      dMoves = 0,
      dWhitePieces = 0,
      dBlackPieces = 0,
      dWhiteKings = 0,
      dBlackKings = 0,
      incrLocalMoves = false,
      incrLocalCaptures = false,
    } = {
      dMoves: 0,
      dWhitePieces: 0,
      dBlackPieces: 0,
      dWhiteKings: 0,
      dBlackKings: 0,
      incrLocalMoves: false,
      incrLocalCaptures: false,
    }
  ) {
    this.localDelta.totalMoves += dMoves;
    this.localDelta.whitePiecesRemaining += dWhitePieces;
    this.localDelta.blackPiecesRemaining += dBlackPieces;
    this.localDelta.whiteKingsRemaining += dWhiteKings;
    this.localDelta.blackKingsRemaining += dBlackKings;
    if (incrLocalMoves) {
      this._incrementMoves();
    }
    if (incrLocalCaptures) {
      this._incrementCaptures();
    }
    this.broadcast();
  }

  _incrementMoves() {
    this.yourMoves++;
    localStorage.setItem(YOUR_MOVES_KEY, this.yourMoves);
  }

  _incrementCaptures() {
    this.yourCaptures++;
    localStorage.setItem(YOUR_CAPTURES_KEY, this.yourCaptures);
  }

  broadcast() {
    const stats = this.getStats();
    this.subscribers.forEach(({ callback }) => {
      callback({ stats });
    });
  }

  setGlobalStats({ stats }) {
    this.totalMoves = stats.totalMoves;
    this.whitePiecesRemaining = stats.whitePiecesRemaining;
    this.blackPiecesRemaining = stats.blackPiecesRemaining;
    this.whiteKingsRemaining = stats.whiteKingsRemaining;
    this.blackKingsRemaining = stats.blackKingsRemaining;
    this.hasReceivedUpdate = true;
    this.localDelta = {
      totalMoves: 0,
      whitePiecesRemaining: 0,
      blackPiecesRemaining: 0,
      whiteKingsRemaining: 0,
      blackKingsRemaining: 0,
    };
    this.broadcast();
  }
}

export default StatsHandler;
