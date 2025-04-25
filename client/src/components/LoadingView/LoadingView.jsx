import React from "react";
import styled from "styled-components";
import LogicallyLoadingContext from "../LogicallyLoadingContext/LogicallyLoadingContext";

const LoadingInfo = styled.div`
  position: absolute;
  left: 50%;
  bottom: 0%;
  transform: translate(-50%, var(--translate-y));
  background-color: var(--color-neutral-950);
  color: var(--color-neutral-50);
  padding: 10px;
  border-radius: 0.25rem 0.25rem 0 0;
  z-index: 1000;
  transition: transform 0.3s cubic-bezier(0.45, 0, 0.55, 1);
  min-width: 9ch;
`;

function LoadingView() {
  const { isLogicallyLoading } = React.useContext(LogicallyLoadingContext);

  const showTimerRef = React.useRef(null);
  const hideTimerRef = React.useRef(null);
  const whenDisplayedRef = React.useRef(0);
  const [show, setShow] = React.useState(false);
  const [loadingDots, setLoadingDots] = React.useState(0);

  React.useEffect(() => {
    if (isLogicallyLoading) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      showTimerRef.current = setTimeout(() => {
        whenDisplayedRef.current = performance.now();
        showTimerRef.current = null;
        setShow(true);
      }, 500);
    } else {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
        setShow(false);
      } else {
        const timeSinceShown = performance.now() - whenDisplayedRef.current;
        whenDisplayedRef.current = 0;
        if (timeSinceShown < 25) {
          setShow(false);
        } else if (timeSinceShown > 320) {
          setShow(false);
        } else {
          hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            setShow(false);
          }, 320 - timeSinceShown);
        }
      }
    }

    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [isLogicallyLoading]);

  React.useEffect(() => {
    if (show) {
      setLoadingDots(0);
      const interval = setInterval(() => {
        setLoadingDots((dots) => (dots + 1) % 4);
      }, 300);
      return () => {
        clearInterval(interval);
      };
    }
  }, [show]);

  return (
    <LoadingInfo style={{ "--translate-y": show ? "0%" : "100%" }}>
      <div>Loading{loadingDots > 0 ? ".".repeat(loadingDots) : ""}</div>
    </LoadingInfo>
  );
}

// this code just kinda sucked no matter how many times I tried to get the opacity
// fade in to look ok for all simulated latencies. I think it's just that fading the
// whole screen is kind of a bad idea unless I can sync it better with fading in the pieces.

// const Wrapper = styled.div`
//   position: absolute;
//   left: 0;
//   top: 0;
//   bottom: 0;
//   right: 0;
//   width: 100%;
//   height: 100%;

//   background-color: var(--color-neutral-950);
//   opacity: var(--opacity);
//   transition: opacity 0.4s cubic-bezier(0.45, 0, 0.55, 1);

//   /* transition: opacity 1s cubic-bezier(1, -0.01, 0.74, 0.93); */
//   z-index: 1000;

//   pointer-events: none;
// `;
// const SHOW_DELAY_MS = 200;
// const IMMEDIATE_REVERT_IF_UNDER_MS = 200;
// const MIN_DISPLAY_TIME_OTHERWISE_MS = 1000;

// function LoadingViewOld() {
//   const [showOverlay, setShowOverlay] = React.useState(false);
//   const showTimerRef = React.useRef(null);
//   const hideTimerRef = React.useRef(null);
//   const overlayShowTimerRef = React.useRef(null);
//   const { isLogicallyLoading } = React.useContext(LogicallyLoadingContext);

//   React.useEffect(() => {
//     if (isLogicallyLoading) {
//       if (hideTimerRef.current) {
//         clearTimeout(hideTimerRef.current);
//         hideTimerRef.current = null;
//       }

//       // 1. we aren't showing the overlay yet
//       // 2. we don't have a timer running to show the overlay
//       // So set the timer (or show it immediately if we know we'll need to)
//       if (!showOverlay && !showTimerRef.current) {
//         setShowOverlay(true);
//         overlayShowTimerRef.current = performance.now();
//         // if (lastTransitionDebounceDelay > 0 || true) {
//         // } else {
//         //   showTimerRef.current = setTimeout(() => {
//         //     overlayShowTimerRef.current = performance.now();
//         //     setShowOverlay(true);
//         //     showTimerRef.current = null;
//         //   }, SHOW_DELAY_MS);
//         // }
//       }
//     } else {
//       if (showTimerRef.current) {
//         clearTimeout(showTimerRef.current);
//         showTimerRef.current = null;
//       }
//       // We're showing the overlay AND we don't have a timer running to hide it.
//       if (showOverlay && !hideTimerRef.current) {
//         const timeSinceShown = performance.now() - overlayShowTimerRef.current;
//         // either we got data really fast, or we've been showing it long enough
//         console.log(timeSinceShown);
//         if (
//           timeSinceShown <= IMMEDIATE_REVERT_IF_UNDER_MS ||
//           timeSinceShown >= MIN_DISPLAY_TIME_OTHERWISE_MS
//         ) {
//           console.log("FLIP");
//           setShowOverlay(false);
//           hideTimerRef.current = null;
//           overlayShowTimerRef.current = null;
//         } else {
//           // somewhere in between - don't flicker the overlay
//           const delayRemaining = MIN_DISPLAY_TIME_OTHERWISE_MS - timeSinceShown;
//           hideTimerRef.current = setTimeout(() => {
//             setShowOverlay(false);
//             hideTimerRef.current = null;
//             overlayShowTimerRef.current = null;
//           }, delayRemaining);
//         }
//       }
//     }

//     return () => {
//       if (showTimerRef.current) {
//         clearTimeout(showTimerRef.current);
//         showTimerRef.current = null;
//       }
//       if (hideTimerRef.current) {
//         clearTimeout(hideTimerRef.current);
//         hideTimerRef.current = null;
//       }
//       if (overlayShowTimerRef.current) {
//         overlayShowTimerRef.current = null;
//       }
//     };
//   }, [isLogicallyLoading, showOverlay]);

//   return (
//     <Wrapper
//       style={{
//         "--opacity": showOverlay ? 0.8 : 0,
//         "--transition-delay": showOverlay ? "0.3s" : "0s",
//       }}
//     ></Wrapper>
//   );
// }

export default LoadingView;
