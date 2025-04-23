import { intervalWithJitter } from "./utils";

const MINIMAP_REFRESH_INTERVAL = 25 * 1000;
const MINIMAP_REFRESH_INTERVAL_JITTER = 4500;

class MinimapHandler {
  constructor() {
    this.state = { initialized: false, aggregations: [] };
    this.subscribers = [];
    this.pollLoopTimeout = null;
  }

  runPollLoop() {
    fetch("/api/minimap", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        this.setState({
          initialized: true,
          aggregations: data.aggregations,
        });
      })
      .catch((error) => {
        console.error("Error fetching minimap data:", error);
      });
    const interval = intervalWithJitter({
      baseInterval: MINIMAP_REFRESH_INTERVAL,
      jitter: MINIMAP_REFRESH_INTERVAL_JITTER,
    });
    this.pollLoopTimeout = setTimeout(() => this.runPollLoop(), interval);
  }

  stopPollLoop() {
    if (this.pollLoopTimeout) {
      clearTimeout(this.pollLoopTimeout);
      this.pollLoopTimeout = null;
    }
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
