import React from "react";
import styled from "styled-components";
import BoardControlsPanel from "../BoardControlsPanel/BoardControlsPanel";
import { clamp } from "../../utils";

const Wrapper = styled(BoardControlsPanel)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  grid-area: stats;
  min-height: 100px;
  min-width: 100px;
  padding: 0.5rem;
`;

const TextLinesWrapper = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.25rem 0.25rem;
  font-size: 0.75rem;
  width: 100%;

  & p {
    text-align: left;
    margin: 0;
    line-height: 1.2;
  }

  & p:nth-child(2n) {
    text-align: left;
  }
`;

const TextLabelOrValue = styled.p`
  text-align: left;
  margin: 0;
  line-height: 1.2;
`;

const WhiteBlackDisplayWrapper = styled.div`
  display: grid;
  grid-template-columns: 50% 50%;
  height: 100%;
  background-color: var(--color-neutral-800);
`;

const WhiteValueOuter = styled.div`
  justify-self: flex-end;
  width: 100%;
  height: 100%;
  position: relative;
  display: grid;
  grid-template-areas: "single";
`;

const BlackValueOuter = styled.div`
  justify-self: flex-start;
  width: 100%;
  height: 100%;

  position: relative;
  display: grid;
  grid-template-areas: "single";
`;

const WhiteValue = styled.div`
  grid-area: single;
  color: var(--color-neutral-700);
  text-align: right;
  padding-right: 0.25rem;
  z-index: 1;
`;

const BlackValue = styled.div`
  grid-area: single;
  text-align: left;
  padding-left: 0.25rem;
  color: var(--color-neutral-100);
  z-index: 1;
`;

const WhiteValueBar = styled.div`
  grid-area: single;
  background-color: var(--color-gray-400);
  height: 100%;
  width: 100%;
  transform: scaleX(var(--scale-x));
  transform-origin: right;
  transition: transform 0.2s ease-in-out;
`;

const BlackValueBar = styled.div`
  grid-area: single;
  background-color: var(--color-gray-600);
  height: 100%;
  width: 100%;
  transform: scaleX(var(--scale-x));
  transform-origin: left;
  transition: transform 0.2s ease-in-out;
`;

function WhiteBlackDisplay({ label, blackValue, whiteValue, maxValue }) {
  const blackScale = React.useMemo(() => {
    const scale = clamp((blackValue / maxValue) * 100, 0, 100);
    return `${scale}%`;
  }, [blackValue, maxValue]);
  const whiteScale = React.useMemo(() => {
    const scale = clamp((whiteValue / maxValue) * 100, 0, 100);
    return `${scale}%`;
  }, [whiteValue, maxValue]);
  return (
    <>
      <TextLabelOrValue>{label}</TextLabelOrValue>
      <WhiteBlackDisplayWrapper>
        <WhiteValueOuter>
          <WhiteValueBar style={{ "--scale-x": whiteScale }} />
          <WhiteValue>{whiteValue}</WhiteValue>
        </WhiteValueOuter>
        <BlackValueOuter>
          <BlackValueBar style={{ "--scale-x": blackScale }} />
          <BlackValue>{blackValue}</BlackValue>
        </BlackValueOuter>
      </WhiteBlackDisplayWrapper>
    </>
  );
}

function TextLine({ label, value }) {
  return (
    <>
      <TextLabelOrValue>{label}</TextLabelOrValue>
      <TextLabelOrValue>{value}</TextLabelOrValue>
    </>
  );
}

function TextLines({ stats }) {
  return (
    <TextLinesWrapper>
      <TextLine label="Your Captures" value={stats.yourCaptures} />
      <TextLine label="Your Moves" value={stats.yourMoves} />
      <TextLine label="Total Moves" value={stats.totalMoves} />
      <WhiteBlackDisplay
        label="Pieces Remaining"
        blackValue={stats.blackPiecesRemaining}
        whiteValue={2000000}
        maxValue={32000000}
      />
      <WhiteBlackDisplay
        label="Kings Remaining"
        blackValue={stats.blackKingsRemaining}
        whiteValue={stats.whiteKingsRemaining}
        maxValue={1000000}
      />
    </TextLinesWrapper>
  );
}

function StatsDisplay({ statsHandler }) {
  const [stats, setStats] = React.useState(statsHandler.current.getStats());
  console.log("stats", stats);
  React.useEffect(() => {
    statsHandler.current.subscribe({
      id: "stats",
      callback: (data) => {
        setStats(data.stats);
      },
    });
    return () => {
      statsHandler.current.unsubscribe("stats");
    };
  }, [statsHandler]);
  return (
    <Wrapper>
      <TextLines stats={stats} />
    </Wrapper>
  );
}

export default StatsDisplay;
