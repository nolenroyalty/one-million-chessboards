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
    this.moveSeqnumsToApply = [];
    this.capturesToApply = [];
    this.seqnum = 0;
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

    this.resetPieceHandlerDelta();

    this.subscribers = [];
    this.pollPeriodically();
  }

  pollOnce() {
    fetch("/api/global-game-stats")
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
      totalMoves: this.totalMoves + this.pieceHandlerDelta.totalMoves,
      whitePiecesRemaining:
        this.whitePiecesRemaining + this.pieceHandlerDelta.whitePiecesRemaining,
      blackPiecesRemaining:
        this.blackPiecesRemaining + this.pieceHandlerDelta.blackPiecesRemaining,
      whiteKingsRemaining:
        this.whiteKingsRemaining + this.pieceHandlerDelta.whiteKingsRemaining,
      blackKingsRemaining:
        this.blackKingsRemaining + this.pieceHandlerDelta.blackKingsRemaining,
      hasReceivedUpdate: this.hasReceivedUpdate,
      yourMoves: this.yourMoves,
      yourCaptures: this.yourCaptures,
      connectedUsers: this.connectedUsers,
    };
  }

  updateLocalStats({ incrLocalMoves, incrLocalCaptures }) {
    if (incrLocalMoves) {
      this._incrementMoves();
    }
    if (incrLocalCaptures) {
      this._incrementCaptures();
    }
    this.broadcast();
  }

  addNewMovesAndCaptures({ moveSeqnums, captures }) {
    for (const moveSeqnum of moveSeqnums) {
      if (moveSeqnum > this.seqnum) {
        this.moveSeqnumsToApply.push(moveSeqnum);
        this.pieceHandlerDelta.totalMoves++;
      }
    }

    for (const capture of captures) {
      if (capture.seqnum > this.seqnum) {
        this.capturesToApply.push(capture);
        if (capture.wasWhite) {
          this.pieceHandlerDelta.whitePiecesRemaining--;
          if (capture.wasKing) {
            this.pieceHandlerDelta.whiteKingsRemaining--;
          }
        } else {
          this.pieceHandlerDelta.blackPiecesRemaining--;
          if (capture.wasKing) {
            this.pieceHandlerDelta.blackKingsRemaining--;
          }
        }
      }
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

  setGlobalStats(stats) {
    this.totalMoves = stats.totalMoves;
    this.whitePiecesRemaining = stats.whitePiecesRemaining;
    this.blackPiecesRemaining = stats.blackPiecesRemaining;
    this.whiteKingsRemaining = stats.whiteKingsRemaining;
    this.blackKingsRemaining = stats.blackKingsRemaining;
    this.connectedUsers = stats.connectedUsers;
    this.hasReceivedUpdate = true;
    this.seqnum = stats.seqnum;
    this.resetPieceHandlerDelta();
    const moveSeqnumsToApply = [];
    const capturesToApply = [];
    for (const moveSeqnum of this.moveSeqnumsToApply) {
      if (moveSeqnum > this.seqnum) {
        this.pieceHandlerDelta.totalMoves++;
        moveSeqnumsToApply.push(moveSeqnum);
      }
    }

    for (const capture of this.capturesToApply) {
      if (capture.seqnum > this.seqnum) {
        capturesToApply.push(capture);
        if (capture.wasWhite) {
          this.pieceHandlerDelta.whitePiecesRemaining--;
          if (capture.wasKing) {
            this.pieceHandlerDelta.whiteKingsRemaining--;
          }
        } else {
          this.pieceHandlerDelta.blackPiecesRemaining--;
          if (capture.wasKing) {
            this.pieceHandlerDelta.blackKingsRemaining--;
          }
        }
      }
    }
    this.moveSeqnumsToApply = moveSeqnumsToApply;
    this.capturesToApply = capturesToApply;

    this.broadcast();
  }
}

export default StatsHandler;
