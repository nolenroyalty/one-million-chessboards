import { intervalWithJitter, isZstd } from "./utils";
import { decompress } from "fzstd";

const MINIMAP_REFRESH_INTERVAL = 25 * 1000;
const MINIMAP_REFRESH_INTERVAL_JITTER = 4500;

function parseJson(buf) {
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch (e) {
    if (isZstd(new Uint8Array(buf))) {
      try {
        console.log("decompressing minimap data");
        const decompressed = decompress(new Uint8Array(buf));
        return JSON.parse(new TextDecoder().decode(decompressed));
      } catch (e2) {
        console.error("Error decoding zstd-compressed minimap data", e2);
        return null;
      }
    }
    console.error("Error decoding minimap data", e);
    return null;
  }
}

class MinimapHandler {
  constructor() {
    this.state = { initialized: false, aggregations: [] };
    this.subscribers = [];
    this.pollLoopTimeout = null;
  }

  runPollLoop() {
    let error = false;
    fetch("/api/minimap")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.arrayBuffer();
      })
      .then((buf) => {
        const data = parseJson(buf);
        if (!data) {
          throw new Error("Failed to decode minimap data");
        }
        this.setState({
          initialized: true,
          aggregations: data.aggregations,
        });
      })
      .catch((error) => {
        console.error("Error fetching minimap data:", error);
        error = true;
      });
    const interval = intervalWithJitter({
      baseInterval: MINIMAP_REFRESH_INTERVAL,
      jitter: MINIMAP_REFRESH_INTERVAL_JITTER,
      error,
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
