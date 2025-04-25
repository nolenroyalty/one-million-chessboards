import React from "react";
import styled from "styled-components";
import LastTransitionDebounceDelayContext from "../LastTransitionDebounceDelayContext/LastTransitionDebounceDelayContext";
import LogicallyLoadingContext from "../LogicallyLoadingContext/LogicallyLoadingContext";
const Wrapper = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;

  background-color: var(--color-neutral-950);
  opacity: var(--opacity);
  transition: opacity 0.75s cubic-bezier(0.32, 0, 0.67, 0);
  z-index: 1000;
  pointer-events: none;
`;

const SHOW_DELAY_MS = 200;
const MIN_DISPLAY_TIME_MS = 250;

function LoadingView() {
  const { lastTransitionDebounceDelay } = React.useContext(
    LastTransitionDebounceDelayContext
  );
  const [showOverlay, setShowOverlay] = React.useState(false);
  const showTimerRef = React.useRef(null);
  const hideTimerRef = React.useRef(null);
  const overlayShowTimerRef = React.useRef(null);
  const { isLogicallyLoading } = React.useContext(LogicallyLoadingContext);

  React.useEffect(() => {
    if (isLogicallyLoading) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // 1. we aren't showing the overlay yet
      // 2. we don't have a timer running to show the overlay
      // So set the timer (or show it immediately if we know we'll need to)
      if (!showOverlay && !showTimerRef.current) {
        if (lastTransitionDebounceDelay > 0 || true) {
          setShowOverlay(true);
          overlayShowTimerRef.current = performance.now();
        } else {
          showTimerRef.current = setTimeout(() => {
            overlayShowTimerRef.current = performance.now();
            setShowOverlay(true);
            showTimerRef.current = null;
          }, SHOW_DELAY_MS);
        }
      }
    } else {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      // We're showing the overlay AND we don't have a timer running to hide it.
      if (showOverlay && !hideTimerRef.current) {
        const timeSinceShown = performance.now() - overlayShowTimerRef.current;
        // We've already shown it for long enough
        if (timeSinceShown >= MIN_DISPLAY_TIME_MS) {
          setShowOverlay(false);
          hideTimerRef.current = null;
          overlayShowTimerRef.current = null;
        } else {
          const delayRemaining = MIN_DISPLAY_TIME_MS - timeSinceShown;
          hideTimerRef.current = setTimeout(() => {
            setShowOverlay(false);
            hideTimerRef.current = null;
            overlayShowTimerRef.current = null;
          }, delayRemaining);
        }
      }
    }
  }, [isLogicallyLoading, lastTransitionDebounceDelay, showOverlay]);

  return (
    <Wrapper
      style={{
        "--opacity": showOverlay ? 0.8 : 0,
      }}
    ></Wrapper>
  );
}

export default LoadingView;
