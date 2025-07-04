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
const FAR_FROM_HOME_DISTANCE = 40;
const PACIFIST_MOVE_COUNT = 100;
const SELF_HATING_THRESHOLD = 10;

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
  width: 70px;
  height: 70px;
  object-fit: contain;
  filter: drop-shadow(0 0 4px var(--color-cyan-500))
    drop-shadow(0 0 8px var(--color-cyan-500));
`;

const PieceImageWrapper = styled.div`
  display: flex;
  padding: 0.25rem;
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

const RoyaltyKillerText = styled(AchievementText)`
  color: var(--color-violet-400);
`;

const AdoptedText = styled(AchievementText)`
  color: var(--color-amber-400);
`;

const FarFromHomeText = styled(AchievementText)`
  color: var(--color-indigo-400);
`;

const PacifistText = styled(AchievementText)`
  color: var(--color-blue-400);
`;

const SelfHatingText = styled(AchievementText)`
  color: var(--color-red-400);
`;

const AchievementsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;

  & > p:nth-child(n + 3) {
    display: none;
  }
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
  color: var(--color-neutral-300);
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
    const idNoX = (selectedPiece.id - 1) % 32000;
    const yRank = Math.floor(idNoX / 32);
    const promotionRank = selectedPiece.isWhite ? yRank + 1 : 1000 - yRank;
    return <PromotedText>Promoted - {promotionRank}</PromotedText>;
  }, [selectedPiece]);

  const adopted = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    return selectedPiece.adopted ? <AdoptedText>Adopted</AdoptedText> : null;
  }, [selectedPiece]);

  const captureAchievement = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    if (selectedPiece.kingPawner && selectedPiece.queenPawner) {
      return <RoyaltyKillerText>Pawnipotent</RoyaltyKillerText>;
    } else if (selectedPiece.adoptedKiller) {
      return <AdoptedText>Goldslayer</AdoptedText>;
    } else if (selectedPiece.kingPawner) {
      return <RoyaltyKillerText>King Pwner</RoyaltyKillerText>;
    } else if (selectedPiece.queenPawner) {
      return <RoyaltyKillerText>Queen Pwner</RoyaltyKillerText>;
    } else if (selectedPiece.kingKiller && selectedPiece.queenKiller) {
      return <RoyaltyKillerText>Regicidal</RoyaltyKillerText>;
    } else if (selectedPiece.kingKiller) {
      return <RoyaltyKillerText>Usurper</RoyaltyKillerText>;
    } else if (selectedPiece.queenKiller) {
      return <RoyaltyKillerText>Treasonous</RoyaltyKillerText>;
    } else if (
      selectedPiece.moveCount >= PACIFIST_MOVE_COUNT &&
      selectedPiece.captureCount === 0
    ) {
      return <PacifistText>Pacifist</PacifistText>;
    } else if (
      selectedPiece.captureCount >= SELF_HATING_THRESHOLD &&
      !selectedPiece.hasCapturedPieceTypeOtherThanOwn
    ) {
      return <SelfHatingText>Self-Hating</SelfHatingText>;
    }
    return null;
  }, [selectedPiece]);

  const farFromHome = React.useMemo(() => {
    if (!selectedPiece) {
      return null;
    }
    const noX = (selectedPiece.id - 1) % 32000;
    const xStart = Math.floor((selectedPiece.id - 1) / 32000);
    const yStart = Math.floor(noX / 32);
    const xCurrent = Math.floor(selectedPiece.x / 8);
    const yCurrent = Math.floor(selectedPiece.y / 8);
    const xDistance = Math.abs(xCurrent - xStart);
    const yDistance = Math.abs(yCurrent - yStart);
    const totalDistance = xDistance + yDistance;
    if (totalDistance >= FAR_FROM_HOME_DISTANCE) {
      return <FarFromHomeText>Far from Home</FarFromHomeText>;
    }
    return null;
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
            <PieceInfoInner>
              <PieceName>{pieceName}</PieceName>
              <PieceId>{pieceId}</PieceId>
              <AchievementsWrapper>
                {promoted}
                {adopted}
                {captureAchievement}
                {farFromHome}
              </AchievementsWrapper>
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
