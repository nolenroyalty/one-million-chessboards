import React from "react";
import styled from "styled-components";
import { clamp } from "../../utils";
import IconButton from "../IconButton/IconButton";
import { CirclePlus, CircleMinus, Flame, ArrowDownUp, Axe } from "lucide-react";
import { imageForPieceType, TYPE_TO_NAME } from "../../utils";

const Wrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: start;
  width: 100%;
  justify-content: space-between;
  gap: 0.5rem;
  background-color: var(--color-neutral-900);
  padding: 0.5rem;
  border-radius: 0 0 0.25rem 0.25rem;
  border-top: 4px solid var(--color-neutral-400);
`;

const PlusMinusControls = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.25rem;
  align-items: center;
  justify-content: flex-end;
`;

const AllBoardButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Middle = styled.div`
  flex-grow: 1;
  align-self: stretch;
  background-color: var(--color-neutral-800);
  padding: 0.25rem;
  display: flex;
  justify-content: space-between;
`;
const Spacer = styled.div`
  flex-grow: 1;
`;

const MINIMAP_WRAPPER_SIZE = 80;
const MINIMAP_BORDER_SIZE = 4;
const MINIMAP_DOT_SIZE = 10;
const MinimapWrapper = styled.div`
  width: ${MINIMAP_WRAPPER_SIZE + MINIMAP_BORDER_SIZE * 2}px;
  height: ${MINIMAP_WRAPPER_SIZE + MINIMAP_BORDER_SIZE * 2}px;
  background-color: var(--color-neutral-800);
  border: ${MINIMAP_BORDER_SIZE}px solid var(--color-neutral-700);
  border-radius: 0.125rem;
  position: relative;
  cursor: pointer;
`;

const MinimapDot = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: ${MINIMAP_DOT_SIZE}px;
  height: ${MINIMAP_DOT_SIZE}px;
  background-color: var(--color-green-400);
  border-radius: 2px;
  transform: translate(var(--x), var(--y));
`;

function Minimap({ coords, setCoords }) {
  const ref = React.useRef(null);
  const minPos = React.useMemo(() => 2 + MINIMAP_DOT_SIZE / 2, []);
  const maxPos = React.useMemo(() => MINIMAP_WRAPPER_SIZE - minPos, [minPos]);
  const xPercent = coords.x / 8000;
  const yPercent = coords.y / 8000;
  const maxAdjust = maxPos - minPos;
  const x = minPos + xPercent * maxAdjust;
  const y = minPos + yPercent * maxAdjust;

  const handleClick = React.useCallback(
    (e) => {
      const rect = ref.current.getBoundingClientRect();
      const x = e.clientX - MINIMAP_BORDER_SIZE - minPos - rect.left;
      const y = e.clientY - MINIMAP_BORDER_SIZE - minPos - rect.top;
      const width = maxPos - minPos;
      const xPct = clamp(x / width, 0, 1);
      const yPct = clamp(y / width, 0, 1);
      let xCoord = Math.floor(xPct * 8000);
      let yCoord = Math.floor(yPct * 8000);
      setCoords({ x: xCoord, y: yCoord });
    },
    [maxPos, minPos, setCoords]
  );

  return (
    <MinimapWrapper ref={ref} onClick={handleClick}>
      <MinimapDot
        style={{
          "--x": `calc(${x}px - 50%)`,
          "--y": `calc(${y}px - 50%)`,
        }}
      />
    </MinimapWrapper>
  );
}

const PieceImage = styled.img`
  width: 40px;
  height: 40px;
  object-fit: contain;
  filter: drop-shadow(0 0 4px var(--color-cyan-500))
    drop-shadow(0 0 8px var(--color-cyan-500));
`;

const PieceImageWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const PieceImageAndStat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  align-self: center;
`;

const PieceId = styled.p`
  font-size: 0.625rem;
`;

const PieceInfoOuter = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  flex-grow: 4;
`;

const PieceName = styled.p`
  font-size: 1rem;
  line-height: 1.1;
`;

const PieceStat = styled.p`
  font-size: 0.875rem;
`;

const YourStats = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  gap: 0.375rem;
  flex-grow: 1;
`;

const YourStatSquare = styled.div`
  --size: 2rem;
  width: var(--size);
  height: var(--size);
  border: 2px solid var(--color-green-400);
  border-radius: 0.25rem;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;

  svg {
    color: var(--color-gray-500);
    width: var(--size);
    height: var(--size);
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.5;
  }
`;

const YourStatSquareLabel = styled.p`
  font-size: 0.75rem;
  color: var(--color-gray-200);
  text-align: right;
  padding-right: 0.125rem;
  line-height: 1;
`;

function StatSquare({ icon, getLabel }) {
  return (
    <YourStatSquare>
      {icon}
      <YourStatSquareLabel>{getLabel()}</YourStatSquareLabel>
    </YourStatSquare>
  );
}
function SelectedPiece({ selectedPiece }) {
  const imageSrc = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    const name = TYPE_TO_NAME[selectedPiece.type];
    if (!name) {
      return null;
    }
    return `/pieces/frames/${name}.png`;
  }, [selectedPiece]);

  const pieceName = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    const whiteText = selectedPiece.isWhite ? "White" : "Black";
    const typeName = TYPE_TO_NAME[selectedPiece.type];
    // capitalize first letter
    const capitalizedTypeName =
      typeName.charAt(0).toUpperCase() + typeName.slice(1);
    return `${whiteText} ${capitalizedTypeName}`;
  }, [selectedPiece]);

  const pieceCoords = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    return `${selectedPiece.x},${selectedPiece.y}`;
  }, [selectedPiece]);

  const pieceId = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    return "#" + selectedPiece.id;
  }, [selectedPiece]);

  return (
    <Middle>
      <PieceImageAndStat>
        {selectedPiece && (
          <>
            <PieceImageWrapper>
              {imageSrc && <PieceImage src={imageSrc} />}
            </PieceImageWrapper>
            <PieceId>{pieceCoords}</PieceId>
          </>
        )}
      </PieceImageAndStat>
      <Spacer />
      <PieceInfoOuter>
        {selectedPiece && (
          <>
            <PieceName>{pieceName}</PieceName>
            <PieceId>{pieceId}</PieceId>
            <YourStats>
              <StatSquare icon={<ArrowDownUp />} getLabel={() => "2"} />
              <StatSquare icon={<Axe />} getLabel={() => "2"} />
            </YourStats>
          </>
        )}
      </PieceInfoOuter>
      <Spacer />
    </Middle>
  );
}

function BoardControls({
  coords,
  setCoords,
  showLargeBoard,
  setShowLargeBoard,
  selectedPiece,
}) {
  return (
    <Wrapper>
      <Minimap coords={coords} setCoords={setCoords} />
      <SelectedPiece selectedPiece={selectedPiece} />
      <AllBoardButtons>
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let [x, y] = e.target[0].value.split(",");
              x = parseInt(x);
              y = parseInt(y);
              if (isNaN(x) || isNaN(y)) {
                console.log("invalid coords");
                return;
              }
              setCoords({ x, y });
              e.target[0].value = "";
            }}
          >
            <input
              type="text"
              placeholder={`${coords.x},${coords.y}`}
              style={{ width: "10ch" }}
            />
            <button type="submit">jump</button>
          </form>
        </div>
        <PlusMinusControls>
          <IconButton style={{ transform: "translate(10%, -3%)" }}>
            <Flame />
          </IconButton>
          <IconButton
            disabled={!showLargeBoard}
            onClick={() => setShowLargeBoard(false)}
          >
            <CirclePlus />
          </IconButton>
          <IconButton
            disabled={showLargeBoard}
            onClick={() => setShowLargeBoard(true)}
          >
            <CircleMinus />
          </IconButton>
        </PlusMinusControls>
      </AllBoardButtons>
    </Wrapper>
  );
}

export default BoardControls;
