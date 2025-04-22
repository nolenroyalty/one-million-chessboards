import React from "react";
import SelectedPieceAndSquaresContext from "../SelectedPieceAndSquaresContext";
import {
  TYPE_TO_NAME,
  humanNameForPieceType,
  frameImageForPieceType,
} from "../../utils";
import styled from "styled-components";
import { QUERY } from "../../constants";
import BoardControlsPanel from "../BoardControlsPanel/BoardControlsPanel";
import { ArrowDownUp, Axe } from "lucide-react";

const MAX_CAPTURE_MOVE_COUNT = 4000;

const Middle = styled(BoardControlsPanel)`
  flex-grow: 1;
  display: flex;
  justify-content: space-between;
  height: 100%;
  padding: 0.5rem 0 0;
  grid-area: piece;

  @media (${QUERY.NO_PORTRAIT}) {
    flex-grow: 0;
    display: none;
  }
`;

const Spacer = styled.div`
  flex-grow: 1;
`;

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
  line-height: 1;
`;

const AchievementText = styled.p`
  font-size: 0.625rem;
  line-height: 1;
`;

const PromotedText = styled(AchievementText)`
  color: var(--color-sky-400);
`;

const RegicidalText = styled(AchievementText)`
  color: var(--color-violet-400);
`;

const PieceInfoOuter = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex-grow: 4;
  padding-bottom: 0.5rem;
`;

const PieceInfoInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
`;

const PieceName = styled.p`
  font-size: 1rem;
  line-height: 1;
`;

const PieceStats = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  /* align-self: flex-start; */
  gap: 0.375rem;
  /* flex-grow: 1; */
`;

const StatSquareOuter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-sky-700);
  border-radius: 0.25rem;
  padding: 2px;
`;

const StatSquareInner = styled.div`
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

const StatSquareLabel = styled.p`
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
  border-top: 1px solid var(--color-sky-700);
  border-left: 1px solid var(--color-sky-700);
  border-radius: 2px 0 4px 0;
  padding: 1px 4px 1px 4px;
  z-index: 2;
  line-height: 1;
`;

function StatSquare({ icon, getLabel }) {
  let value = getLabel();
  const isMax = value >= MAX_CAPTURE_MOVE_COUNT;
  if (isMax) {
    value = `4k+`;
  }
  return (
    <StatSquareOuter>
      <StatSquareInner>
        {icon}
        <StatSquareLabel>{value}</StatSquareLabel>
      </StatSquareInner>
    </StatSquareOuter>
  );
}

function SelectedPieceDisplay() {
  const { selectedPiece } = React.useContext(SelectedPieceAndSquaresContext);
  const imageSrc = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    return frameImageForPieceType({ pieceType: selectedPiece.type });
  }, [selectedPiece]);

  const pieceName = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    const whiteText = selectedPiece.isWhite ? "White" : "Black";
    return `${whiteText} ${humanNameForPieceType({ pieceType: selectedPiece.type })}`;
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

  const promoted = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    if (TYPE_TO_NAME[selectedPiece.type] !== "promotedPawn") {
      return null;
    }
    const idNoX = selectedPiece.id % 32000;
    const yRank = Math.floor(idNoX / 32);
    const promotionRank = selectedPiece.isWhite ? yRank + 1 : 1000 - yRank;
    return <PromotedText>Promoted - {promotionRank}</PromotedText>;
  }, [selectedPiece]);

  const regicidal = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    if (selectedPiece.kingPawner) {
      return <RegicidalText>King Pwner</RegicidalText>;
    }
    if (selectedPiece.kingKiller) {
      return <RegicidalText>Regicidal</RegicidalText>;
    }
    return null;
  }, [selectedPiece]);

  // CR nroyalty: add "far from home?"

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
            <PieceInfoInner>
              <PieceName>{pieceName}</PieceName>
              <PieceId>{pieceId}</PieceId>
              {promoted}
              {regicidal}
            </PieceInfoInner>
            <PieceStats>
              <StatSquare
                icon={<ArrowDownUp />}
                getLabel={() => selectedPiece.moveCount}
              />
              <StatSquare
                icon={<Axe />}
                getLabel={() => selectedPiece.captureCount}
              />
            </PieceStats>
          </>
        )}
      </PieceInfoOuter>
      <Spacer />
    </Middle>
  );
}
export default SelectedPieceDisplay;
