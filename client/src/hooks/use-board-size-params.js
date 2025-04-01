import React from "react";
import { useElementDimensions } from "./use-element-dimensions";

const MIN_PIXELS_PER_SQUARE = 28;
const MAX_NUM_ZOOMED_IN_SQUARES = 36;
const MIN_NUM_ZOOMED_IN_SQUARES = 8;

function useBoardSizeParams({ outerRef }) {
  const outerSize = useElementDimensions(outerRef);
  const [params, setParams] = React.useState({
    squarePx: 0,
    squareWidth: 0,
    squareHeight: 0,
    borderHalfWidth: 0,
    initialized: false,
  });

  const timeout = React.useRef(null);
  React.useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    const calc = () => {
      const minDist = Math.min(outerSize.width, outerSize.height);
      const maxDist = Math.max(outerSize.width, outerSize.height);
      let heightIsSmall = outerSize.height <= outerSize.width;
      let squarePx;
      let largeCount;
      let smallCount;
      if (minDist / MIN_PIXELS_PER_SQUARE < MIN_NUM_ZOOMED_IN_SQUARES) {
        squarePx = MIN_PIXELS_PER_SQUARE;
        largeCount = maxDist / squarePx;
        smallCount = minDist / squarePx;
      } else {
        squarePx = MIN_PIXELS_PER_SQUARE;
        largeCount = maxDist / squarePx;
        smallCount = minDist / squarePx;
        while (
          largeCount > MAX_NUM_ZOOMED_IN_SQUARES &&
          smallCount > MIN_NUM_ZOOMED_IN_SQUARES
        ) {
          squarePx += 2;
          largeCount = maxDist / squarePx;
          smallCount = minDist / squarePx;
        }
        largeCount = Math.min(
          Math.floor(largeCount),
          MAX_NUM_ZOOMED_IN_SQUARES
        );
        smallCount = Math.max(
          Math.floor(smallCount),
          MIN_NUM_ZOOMED_IN_SQUARES
        );
      }
      let borderHalfWidth = 1;
      if (squarePx > 26) {
        borderHalfWidth = 2;
      }
      if (squarePx > 34) {
        borderHalfWidth = 3;
      }
      let horizontalPadding, verticalPadding;
      if (heightIsSmall) {
        horizontalPadding = outerSize.width - largeCount * squarePx;
        verticalPadding = outerSize.height - smallCount * squarePx;
      } else {
        horizontalPadding = outerSize.width - smallCount * squarePx;
        verticalPadding = outerSize.height - largeCount * squarePx;
      }
      let leftPadding = Math.floor(horizontalPadding / 2);
      let rightPadding = Math.ceil(horizontalPadding / 2);
      let topPadding = Math.floor(verticalPadding / 2);
      let bottomPadding = Math.ceil(verticalPadding / 2);
      setParams({
        squarePx: squarePx,
        squareWidth: heightIsSmall ? largeCount : smallCount,
        squareHeight: heightIsSmall ? smallCount : largeCount,
        borderHalfWidth,
        leftPadding,
        rightPadding,
        topPadding,
        bottomPadding,
        left: outerSize.left + leftPadding,
        top: outerSize.top + topPadding,
        right: outerSize.right - rightPadding,
        bottom: outerSize.bottom - bottomPadding,
        initialized: true,
      });
    };

    timeout.current = setTimeout(calc, 10);
    return () => {
      clearTimeout(timeout.current);
    };
  }, [outerSize]);
  return params;
}

export default useBoardSizeParams;
