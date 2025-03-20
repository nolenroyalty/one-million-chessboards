import React from "react";
import {
  keyToCoords,
  getStartingAndEndingCoords,
  getScreenRelativeCoords,
} from "../../utils";
import styled from "styled-components";

const MoveButton = styled.button`
  all: unset;
  cursor: var(--cursor);
  pointer-events: var(--pointer-events);
  width: var(--size);
  height: var(--size);
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(var(--x), var(--y));
  background-color: transparent;
  opacity: var(--opacity);
  transition: opacity 0.3s ease-in-out;
`;

function PieceMoveButtons({
  moveableSquares,
  coords,
  numSquares,
  selectedPiece,
  moveAndClear,
  size,
  hidden,
}) {
  const { startingX, startingY } = getStartingAndEndingCoords({
    coords,
    width: numSquares,
    height: numSquares,
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
          "--opacity": hidden ? 0 : 1,
          "--pointer-events": hidden ? "none" : "auto",
          "--cursor": hidden ? "none" : "pointer",
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
