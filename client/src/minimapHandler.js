class MinimapHandler {
  constructor() {
    this.state = [];
    this.subscribers = [];
  }

  subscribe({ id, callback }) {
    this.subscribers.push({ id, callback });
  }

  broadcast({ state }) {
    this.state = state;
    this.subscribers.forEach(({ callback }) => {
      callback({ state });
    });
  }

  getState() {
    return this.state;
  }

  setState({ state }) {
    this.state = state;
    this.broadcast({ state });
  }
}

export default MinimapHandler;
