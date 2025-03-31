class StatsHandler {
  constructor() {
    this.totalMoves = 0;
    this.whitePiecesRemaining = 0;
    this.blackPiecesRemaining = 0;
    this.whiteKingsRemaining = 0;
    this.blackKingsRemaining = 0;
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
    };
  }

  applyLocalDelta(
    {
      dMoves = 0,
      dWhitePieces = 0,
      dBlackPieces = 0,
      dWhiteKings = 0,
      dBlackKings = 0,
    } = {
      dMoves: 0,
      dWhitePieces: 0,
      dBlackPieces: 0,
      dWhiteKings: 0,
      dBlackKings: 0,
    }
  ) {
    this.localDelta.totalMoves += dMoves;
    this.localDelta.whitePiecesRemaining += dWhitePieces;
    this.localDelta.blackPiecesRemaining += dBlackPieces;
    this.localDelta.whiteKingsRemaining += dWhiteKings;
    this.localDelta.blackKingsRemaining += dBlackKings;
    this.broadcast();
  }

  broadcast() {
    const stats = this.getStats();
    this.subscribers.forEach(({ callback }) => {
      callback({ stats });
    });
  }

  setState({ stats }) {
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
