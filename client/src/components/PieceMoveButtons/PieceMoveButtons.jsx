import React from "react";
import {
  keyToCoords,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
} from "../../utils";
import styled from "styled-components";

const MoveButton = styled.button`
  all: unset;
  cursor: pointer;
  pointer-events: auto;
  width: var(--size);
  height: var(--size);
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(var(--x), var(--y));
  background-color: transparent;
`;

function PieceMoveButtons({
  moveableSquares,
  coords,
  width,
  height,
  selectedPiece,
  moveAndClear,
  size,
}) {
  const { startingX, startingY } = getStartingAndEndingCoords({
    coords,
    width,
    height,
  });
  return Array.from(moveableSquares.values()).map((key) => {
    const [x, y] = keyToCoords(key);
    const { x: screenX, y: screenY } = getScreenRelativeCoords({
      x,
      y,
      startingX,
      startingY,
    });
    return (
      <MoveButton
        key={key}
        style={{
          "--x": `${screenX * size}px`,
          "--y": `${screenY * size}px`,
          "--size": `${size}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          moveAndClear({ piece: selectedPiece, toX: x, toY: y });
        }}
      />
    );
  });
}

export default PieceMoveButtons;
