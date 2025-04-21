import React from "react";
import styled from "styled-components";
import BoardControlsPanel from "../BoardControlsPanel/BoardControlsPanel";
import { useElementDimensions } from "../../hooks/use-element-dimensions";
import { clamp } from "../../utils";
import { QUERY } from "../../constants";
import HandlersContext from "../HandlersContext/HandlersContext";
import CoordsContext from "../CoordsContext/CoordsContext";
const WHITE_ADVANTAGE_COLORS_HEX = ["#9ca3af", "#d1d5db", "#e5e7eb"];
const BLACK_ADVANTAGE_COLORS_HEX = ["#4b5563", "#374151", "#1f2937"];
const MINIMAP_RECT_STROKE_OUTER_COLOR = "#0a0a0a";
const MINIMAP_RECT_STROKE_INNER_COLOR = "#0a0a0a";

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const WHITE_ADVANTAGE_COLORS_RGB = WHITE_ADVANTAGE_COLORS_HEX.map((hex) =>
  hexToRgb(hex)
);
const BLACK_ADVANTAGE_COLORS_RGB = BLACK_ADVANTAGE_COLORS_HEX.map((hex) =>
  hexToRgb(hex)
);

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 200;

const Wrapper = styled.div`
  height: 100%;
  max-height: 100%;
  position: relative;
  grid-area: minimap;
  padding-top: 15px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  justify-self: stretch;

  @media (${QUERY.VERY_SMALL}) {
    align-items: flex-start;
  }
`;

const CoordsWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, calc(-50% - 21px));
  font-size: 0.75rem;
  padding: 0.125rem;
  min-width: 9ch;
  min-height: 1.4rem;
  text-align: center;
  border-radius: 0.25rem;
  background-color: var(--color-neutral-950);
  border: 1px solid var(--color-sky-700);
`;

function CoordsDisplay({ coords }) {
  const s =
    coords.x !== null && coords.y !== null ? `${coords.x},${coords.y}` : "";
  return (
    <CoordsWrapper>
      <p>{s}</p>
    </CoordsWrapper>
  );
}

const CanvasWrapper = styled(BoardControlsPanel)`
  height: 100%;
  max-height: 100%;
  max-width: 100%;
  aspect-ratio: 1 / 1;
  position: relative;
`;

const CoordsCanvas = styled.canvas`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  cursor: crosshair;
`;

const DrawingCanvas = styled.canvas`
  background-color: var(--color-gray-500);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const MINIMAP_DOT_SIZE = 10;

function MinimapCanvas({ coords, setCoords }) {
  const coordsCanvasRef = React.useRef(null);
  const elementDimensions = useElementDimensions(coordsCanvasRef);
  const minimapDataCanvasRef = React.useRef(null);
  const { minimapHandler } = React.useContext(HandlersContext);

  const [minimapState, setMinimapState] = React.useState(
    minimapHandler.current.getState()
  );

  React.useEffect(() => {
    let minimap = minimapHandler.current;
    minimap.subscribe({
      id: "minimap",
      callback: ({ state }) => {
        setMinimapState(state);
      },
    });
    return () => {
      minimap.unsubscribe({
        id: "minimap",
      });
    };
  }, [minimapHandler]);

  React.useEffect(() => {
    const minimapDataCanvas = minimapDataCanvasRef.current;
    const ctx = minimapDataCanvas.getContext("2d");
    ctx.clearRect(0, 0, minimapDataCanvas.width, minimapDataCanvas.height);
    const imageData = ctx.createImageData(MINIMAP_WIDTH, MINIMAP_HEIGHT);
    const data = imageData.data;

    for (let i = 0; i < minimapState.length; i++) {
      const cell = minimapState[i];
      const index = i * 4;
      let amount = cell & 0x7;
      const whiteAhead = ((cell >> 3) & 1) === 1;
      if (amount > 0) {
        amount = clamp(amount, 1, 3);
        let rgb;
        if (whiteAhead) {
          rgb = WHITE_ADVANTAGE_COLORS_RGB[amount - 1];
        } else {
          rgb = BLACK_ADVANTAGE_COLORS_RGB[amount - 1];
        }
        data[index] = rgb.r;
        data[index + 1] = rgb.g;
        data[index + 2] = rgb.b;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [minimapState]);

  React.useEffect(() => {
    const canvas = coordsCanvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pctWidth = coords.x / 8000;
    const pctHeight = coords.y / 8000;
    const xCenter = pctWidth * ctx.canvas.width;
    const yCenter = pctHeight * ctx.canvas.height;
    const xStart = Math.max(0, xCenter - MINIMAP_DOT_SIZE / 2);
    const yStart = Math.max(0, yCenter - MINIMAP_DOT_SIZE / 2);
    const xEnd = Math.min(ctx.canvas.width, xCenter + MINIMAP_DOT_SIZE / 2);
    const yEnd = Math.min(ctx.canvas.height, yCenter + MINIMAP_DOT_SIZE / 2);
    ctx.strokeStyle = MINIMAP_RECT_STROKE_OUTER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(xStart, yStart, xEnd - xStart, yEnd - yStart);
  }, [coords]);

  const onClick = React.useCallback(
    (e) => {
      if (!elementDimensions) {
        return;
      }
      const x = e.clientX - elementDimensions.left;
      const y = e.clientY - elementDimensions.top;
      let pctWidth = x / elementDimensions.width;
      let pctHeight = y / elementDimensions.height;
      pctWidth = clamp(pctWidth, 0, 1);
      pctHeight = clamp(pctHeight, 0, 1);
      const xCoord = Math.round(pctWidth * 8000);
      const yCoord = Math.round(pctHeight * 8000);
      setCoords({ x: xCoord, y: yCoord });
    },
    [elementDimensions, setCoords]
  );

  return (
    <CanvasWrapper>
      <CoordsDisplay coords={coords} />
      <DrawingCanvas
        ref={minimapDataCanvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
      />
      <CoordsCanvas
        ref={coordsCanvasRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        onClick={onClick}
      />
    </CanvasWrapper>
  );
}

function Minimap() {
  const { coords, setCoords } = React.useContext(CoordsContext);
  const { minimapHandler } = React.useContext(HandlersContext);
  return (
    <Wrapper>
      {/* <CoordsDisplay coords={coords} /> */}
      <MinimapCanvas
        coords={coords}
        setCoords={setCoords}
        minimapHandler={minimapHandler}
      />
    </Wrapper>
  );
}

export default Minimap;
