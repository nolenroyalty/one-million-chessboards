import { intervalWithJitter } from "./utils";
const BASE_STATS_REFRESH_INTERVAL = 2200;
const INTERVAL_VARIANCE = 400;

class RecentCapturesHandler {
  constructor() {
    this.recentCaptures = [];
    this.pollLoopTimeout = null;
    this.playingWhite = null;
    this.subscribers = [];
  }

  setColorAndRunPollLoop({ playingWhite }) {
    if (this.pollLoopTimeout) {
      clearTimeout(this.pollLoopTimeout);
    }
    this.playingWhite = playingWhite;
    this.runPollLoop();
  }

  runPollLoop() {
    if (this.playingWhite === null) {
      return;
    }
    if (this.pollLoopTimeout) {
      clearTimeout(this.pollLoopTimeout);
    }
    console.log("fetching recent captures");
    fetch(`/api/recently-captured/${this.playingWhite ? "white" : "black"}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("recent captures", data);
        this.recentCaptures = data.captures;
        this.broadcast();
      });
    const interval = intervalWithJitter({
      baseInterval: BASE_STATS_REFRESH_INTERVAL,
      jitter: INTERVAL_VARIANCE,
    });
    this.pollLoopTimeout = setTimeout(() => this.runPollLoop(), interval);
  }

  getRecentCaptures() {
    return this.recentCaptures;
  }

  randomRecentCapture({ preferFurtherFromCoords }) {
    const recentCaptures = this.getRecentCaptures();
    const DISTANCE_FAR_THRESHOLD = 100;
    const DISTANCE_SEMI_FAR_THRESHOLD = 50;
    const farCaptures = [];
    const semiFarCaptures = [];
    const closeCaptures = [];
    for (const capture of recentCaptures) {
      const taxiCabDistance =
        Math.abs(capture.x - preferFurtherFromCoords.x) +
        Math.abs(capture.y - preferFurtherFromCoords.y);
      if (taxiCabDistance > DISTANCE_FAR_THRESHOLD) {
        farCaptures.push(capture);
      } else if (taxiCabDistance > DISTANCE_SEMI_FAR_THRESHOLD) {
        semiFarCaptures.push(capture);
      } else {
        closeCaptures.push(capture);
      }
    }

    let ret = null;
    if (farCaptures.length > 0) {
      ret = farCaptures[Math.floor(Math.random() * farCaptures.length)];
    } else if (semiFarCaptures.length > 0) {
      ret = semiFarCaptures[Math.floor(Math.random() * semiFarCaptures.length)];
    } else if (closeCaptures.length > 0) {
      ret = closeCaptures[Math.floor(Math.random() * closeCaptures.length)];
    }
    if (ret) {
      return { x: ret.x, y: ret.y };
    }
    return null;
  }

  stopPollLoop() {
    if (this.pollLoopTimeout) {
      clearTimeout(this.pollLoopTimeout);
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
    this.subscribers.forEach((subscriber) =>
      subscriber.callback(this.recentCaptures)
    );
  }
}

export default RecentCapturesHandler;
