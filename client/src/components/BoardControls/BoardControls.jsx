import React from "react";
import styled from "styled-components";
import { clamp } from "../../utils";
import IconButton from "../IconButton/IconButton";
import {
  CirclePlus,
  CircleMinus,
  Flame,
  ArrowDownUp,
  Axe,
  SendHorizontal,
  CircleArrowDown,
  CircleArrowUp,
  CircleArrowLeft,
  CircleArrowRight,
  DollarSign,
  Mail,
  Twitter,
} from "lucide-react";
import { TYPE_TO_NAME, getPieceMoves, getPieceCaptures } from "../../utils";

const Wrapper = styled.div`
  width: 100%;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0 0 0.25rem 0.25rem;
  border: 1px solid var(--color-sky-700);

  display: grid;
  grid-template-areas: "minimap jump buttons" "minimap piece buttons" "minimap piece by";
  grid-template-rows: auto 1fr auto;
  grid-template-columns: auto minmax(150px, 250px) auto;
  align-items: end;

  justify-content: space-between;

  /* background-color: var(--color-gray-900); */

  background-color: #0a0a0a;
  opacity: 1;
  background-image:
    linear-gradient(#0c4a6e 0.8px, transparent 0.8px),
    linear-gradient(to right, #0c4a6e 0.8px, #0a0a0a 0.8px);
  background-size: 16px 16px;
`;

const PANEL_BORDER_SIZE = 4;
const Panel = styled.div`
  background-color: var(--color-neutral-950);
  border: ${PANEL_BORDER_SIZE}px double var(--color-sky-700);
`;

const AllBoardButtonsWrapper = styled(Panel)`
  display: grid;
  grid-area: buttons;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0.375rem;
  padding: 0.75rem;
  grid-template-areas:
    "zoomout up zoomin"
    "left . right"
    "hot down .";
  align-self: start;
  justify-self: end;
  max-width: fit-content;
`;

const JumpInput = styled.input`
  background-color: var(--color-neutral-950);
  border-radius: 0.25rem;
  color: var(--color-stone-300);
  border: none;
  max-width: 12ch;

  &:focus {
    outline: none;
  }
`;

const Middle = styled(Panel)`
  flex-grow: 1;
  display: flex;
  justify-content: space-between;
  max-height: 120px;
  height: 120px;
  padding: 0.5rem 0 0;
  grid-area: piece;
`;

const ByWrapper = styled(Panel)`
  grid-area: by;
  padding: 0.25rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
`;

const ByText = styled.p`
  color: var(--color-stone-400);
`;

const SVGLink = styled.a`
  color: var(--color-sky-400);
  transform: translate(0, 1px);
  transition: color 0.2s ease-in-out;

  &:hover {
    color: var(--color-sky-100);
  }

  & svg {
    width: 16px;
    height: 16px;
  }
`;

const ByLinks = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.125rem;
`;

function By() {
  return (
    <ByWrapper>
      <ByText>
        by <a href="https://eieio.games">eieio</a>
      </ByText>
      <ByLinks>
        <SVGLink href="https://eieio.substack.com/">
          <Mail />
        </SVGLink>
        <SVGLink href="https://buymeacoffee.com/eieio">
          <DollarSign />
        </SVGLink>
        <SVGLink href="https://x.com/itseieio">
          <Twitter />
        </SVGLink>
      </ByLinks>
    </ByWrapper>
  );
}

const Spacer = styled.div`
  flex-grow: 1;
`;

const MINIMAP_WRAPPER_SIZE = 140;

const MINIMAP_DOT_SIZE = 10;
const MinimapWrapper = styled(Panel)`
  width: ${MINIMAP_WRAPPER_SIZE + PANEL_BORDER_SIZE * 2}px;
  height: ${MINIMAP_WRAPPER_SIZE + PANEL_BORDER_SIZE * 2}px;
  aspect-ratio: 1 / 1;
  max-height: 100%;
  border-radius: 0.125rem;
  position: relative;
  cursor: pointer;
  grid-area: minimap;
`;

const MinimapDot = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: ${MINIMAP_DOT_SIZE}px;
  height: ${MINIMAP_DOT_SIZE}px;
  border: 1px solid var(--color-stone-300);
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
      const x = e.clientX - PANEL_BORDER_SIZE - minPos - rect.left;
      const y = e.clientY - PANEL_BORDER_SIZE - minPos - rect.top;
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
  width: 80px;
  height: 80px;
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
  /* gap: 0.25rem; */
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

const YourStats = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  gap: 0.375rem;
  flex-grow: 1;
`;

const StatSquareOuter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-blue-500);
  border-radius: 0.25rem;
  padding: 2px;
`;

const YourStatSquare = styled.div`
  --size: 2rem;
  width: var(--size);
  height: var(--size);
  border: 2px dashed var(--color-gray-600);

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
  background-color: var(--color-neutral-800);
  width: fit-content;
  /* align-self: flex-end; */
  position: absolute;
  bottom: -4px;
  right: -4px;
  border-top: 1px solid var(--color-blue-500);
  border-left: 1px solid var(--color-blue-500);
  border-radius: 2px;
  padding: 1px 4px 1px 4px;
  z-index: 2;
  line-height: 1;
`;

function AllBoardButtons({ setShowLargeBoard, showLargeBoard, setCoords }) {
  const delta = showLargeBoard ? 4 : 1;
  return (
    <AllBoardButtonsWrapper>
      <IconButton
        disabled={showLargeBoard}
        style={{ gridArea: "zoomout" }}
        onClick={() => setShowLargeBoard(true)}
      >
        <CircleMinus />
      </IconButton>
      <IconButton
        style={{ gridArea: "zoomin" }}
        disabled={!showLargeBoard}
        onClick={() => setShowLargeBoard(false)}
      >
        <CirclePlus />
      </IconButton>
      <IconButton style={{ gridArea: "hot" }}>
        <Flame />
      </IconButton>
      <IconButton
        onClick={() => {
          setCoords((prev) => ({ x: prev.x, y: prev.y - delta }));
        }}
        style={{ gridArea: "up" }}
      >
        <CircleArrowUp />
      </IconButton>
      <IconButton
        onClick={() => {
          setCoords((prev) => ({ x: prev.x - delta, y: prev.y }));
        }}
        style={{ gridArea: "left" }}
      >
        <CircleArrowLeft />
      </IconButton>
      <IconButton
        onClick={() => {
          setCoords((prev) => ({ x: prev.x + delta, y: prev.y }));
        }}
        style={{ gridArea: "right" }}
      >
        <CircleArrowRight />
      </IconButton>
      <IconButton
        onClick={() => {
          setCoords((prev) => ({ x: prev.x, y: prev.y + delta }));
        }}
        style={{ gridArea: "down" }}
      >
        <CircleArrowDown />
      </IconButton>
    </AllBoardButtonsWrapper>
  );
}

function StatSquare({ icon, getLabel }) {
  return (
    <StatSquareOuter>
      <YourStatSquare>
        {icon}
        <YourStatSquareLabel>{getLabel()}</YourStatSquareLabel>
      </YourStatSquare>
    </StatSquareOuter>
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
              <StatSquare
                icon={<ArrowDownUp />}
                getLabel={() => getPieceMoves(selectedPiece.id)}
              />
              <StatSquare
                icon={<Axe />}
                getLabel={() => getPieceCaptures(selectedPiece.id)}
              />
            </YourStats>
          </>
        )}
      </PieceInfoOuter>
      <Spacer />
    </Middle>
  );
}

const JumpWrapper = styled(Panel)`
  justify-content: space-between;
  padding: 0.25rem;
  grid-area: jump;
`;

function JumpControl({ coords, setCoords }) {
  const [currentInput, setCurrentInput] = React.useState({
    value: "",
    parsed: null,
  });
  const onChange = React.useCallback(
    (e) => {
      const s = e.target.value;
      let parsed = null;
      try {
        let [x, y] = s.split(",");
        x = parseInt(x);
        y = parseInt(y);
        if (isNaN(x) || isNaN(y)) {
          parsed = null;
        } else {
          parsed = { x, y };
        }
      } catch (e) {
        parsed = null;
      }
      console.log("parsed", parsed, "value", s);
      setCurrentInput({ value: s, parsed });
    },
    [setCurrentInput]
  );
  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();
      if (currentInput.parsed === null) {
        return;
      }
      setCoords(currentInput.parsed);
      setCurrentInput({ value: "", parsed: null });
      e.target[0].blur();
    },
    [currentInput, setCoords]
  );
  return (
    <JumpWrapper>
      <form
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "0.25rem",
          justifyContent: "space-between",
        }}
        onSubmit={onSubmit}
      >
        <JumpInput
          type="text"
          placeholder={`${coords.x},${coords.y}`}
          value={currentInput.value}
          onChange={onChange}
          // keypad for input on mobile
        />
        <IconButton type="submit" disabled={currentInput.parsed === null}>
          <SendHorizontal />
        </IconButton>
      </form>
    </JumpWrapper>
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
      <JumpControl coords={coords} setCoords={setCoords} />
      <AllBoardButtons
        setShowLargeBoard={setShowLargeBoard}
        showLargeBoard={showLargeBoard}
        setCoords={setCoords}
      />
      <By />
    </Wrapper>
  );
}

export default BoardControls;
