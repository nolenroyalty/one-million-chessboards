const YOUR_MOVES_KEY = "yourMoves";
const YOUR_CAPTURES_KEY = "yourCaptures";
const STATS_REFRESH_INTERVAL = 4 * 1000;

class StatsHandler {
  constructor() {
    this.totalMoves = 0;
    this.whitePiecesRemaining = 0;
    this.blackPiecesRemaining = 0;
    this.whiteKingsRemaining = 0;
    this.blackKingsRemaining = 0;
    this.connectedUsers = 0;
    this.seqNum = 0;
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

    this.resetLocalDelta();
    this.resetPieceHandlerDelta();

    this.subscribers = [];
    this.pollPeriodically();
  }

  pollOnce() {
    fetch("/global-game-stats")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((stats) => {
        this.setGlobalStats(stats);
      })
      .catch((error) => {
        console.error("Error fetching global game stats:", error);
      });
  }

  pollPeriodically() {
    this.pollOnce();
    setInterval(this.pollOnce.bind(this), STATS_REFRESH_INTERVAL);
  }

  resetLocalDelta() {
    this.localDelta = {
      totalMoves: 0,
      whitePiecesRemaining: 0,
      blackPiecesRemaining: 0,
      whiteKingsRemaining: 0,
      blackKingsRemaining: 0,
    };
  }

  resetPieceHandlerDelta() {
    this.pieceHandlerDelta = {
      totalMoves: 0,
      whitePiecesRemaining: 0,
      blackPiecesRemaining: 0,
      whiteKingsRemaining: 0,
      blackKingsRemaining: 0,
    };
  }

  subscribe({ id, callback }) {
    this.subscribers.push({ id, callback });
  }

  unsubscribe({ id }) {
    this.subscribers = this.subscribers.filter(
      (subscriber) => subscriber.id !== id
    );
  }

  getStats() {
    return {
      totalMoves:
        this.totalMoves +
        this.localDelta.totalMoves +
        this.pieceHandlerDelta.totalMoves,
      whitePiecesRemaining:
        this.whitePiecesRemaining +
        this.localDelta.whitePiecesRemaining +
        this.pieceHandlerDelta.whitePiecesRemaining,
      blackPiecesRemaining:
        this.blackPiecesRemaining +
        this.localDelta.blackPiecesRemaining +
        this.pieceHandlerDelta.blackPiecesRemaining,
      whiteKingsRemaining:
        this.whiteKingsRemaining +
        this.localDelta.whiteKingsRemaining +
        this.pieceHandlerDelta.whiteKingsRemaining,
      blackKingsRemaining:
        this.blackKingsRemaining +
        this.localDelta.blackKingsRemaining +
        this.pieceHandlerDelta.blackKingsRemaining,
      hasReceivedUpdate: this.hasReceivedUpdate,
      yourMoves: this.yourMoves,
      yourCaptures: this.yourCaptures,
      connectedUsers: this.connectedUsers,
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

  applyPieceHandlerDelta({
    dTotalMoves = 0,
    dWhitePieces = 0,
    dBlackPieces = 0,
    dWhiteKings = 0,
    dBlackKings = 0,
  }) {
    this.pieceHandlerDelta.totalMoves += dTotalMoves;
    this.pieceHandlerDelta.whitePiecesRemaining += dWhitePieces;
    this.pieceHandlerDelta.blackPiecesRemaining += dBlackPieces;
    this.pieceHandlerDelta.whiteKingsRemaining += dWhiteKings;
    this.pieceHandlerDelta.blackKingsRemaining += dBlackKings;
    this.resetLocalDelta();
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

  setGlobalStats(stats) {
    this.totalMoves = stats.totalMoves;
    this.whitePiecesRemaining = stats.whitePiecesRemaining;
    this.blackPiecesRemaining = stats.blackPiecesRemaining;
    this.whiteKingsRemaining = stats.whiteKingsRemaining;
    this.blackKingsRemaining = stats.blackKingsRemaining;
    this.connectedUsers = stats.connectedUsers;
    this.hasReceivedUpdate = true;
    this.resetLocalDelta();
    this.resetPieceHandlerDelta();
    this.broadcast();
  }
}

export default StatsHandler;
