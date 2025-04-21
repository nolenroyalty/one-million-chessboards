const MINIMAP_REFRESH_INTERVAL = 30 * 1000;

class MinimapHandler {
  constructor() {
    this.state = { initialized: false, aggregations: [] };
    this.subscribers = [];
    this.pollPeriodically();
  }

  pollOnce() {
    console.log("polling minimap data");
    fetch("/api/minimap")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("refreshed minimap data");
        this.setState({
          initialized: true,
          aggregations: data.aggregations,
        });
      })
      .catch((error) => {
        console.error("Error fetching minimap data:", error);
      });
  }

  pollPeriodically() {
    this.pollOnce();
    setInterval(this.pollOnce.bind(this), MINIMAP_REFRESH_INTERVAL);
  }

  subscribe({ id, callback }) {
    this.subscribers.push({ id, callback });
  }

  unsubscribe({ id }) {
    this.subscribers = this.subscribers.filter(
      (subscriber) => subscriber.id !== id
    );
  }

  broadcast() {
    this.subscribers.forEach(({ callback }) => {
      callback({ state: this.state });
    });
  }

  getState() {
    return this.state;
  }

  setState(state) {
    this.state = state;
    this.broadcast();
  }
}

export default MinimapHandler;
