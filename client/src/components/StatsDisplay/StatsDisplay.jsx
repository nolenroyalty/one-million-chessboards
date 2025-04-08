import React from "react";
import styled from "styled-components";
import BoardControlsPanel from "../BoardControlsPanel/BoardControlsPanel";
import { clamp } from "../../utils";
import HandlersContext from "../HandlersContext/HandlersContext";
const Wrapper = styled(BoardControlsPanel)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  grid-area: stats;
  padding: 0.5rem;
  height: 100%;
`;

const TextLinesWrapper = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.25rem 0.5rem;
  font-size: 0.75rem;
  width: 100%;
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
  align-items: center;
  border-radius: 0.25rem;
  overflow: hidden;
`;

const WhiteValueOuter = styled.div`
  justify-self: flex-end;
  width: 100%;
  height: 1.2em;
  position: relative;
  display: grid;
  grid-template-areas: "single";
  align-items: center;
  background-color: var(--color-gray-400);
  overflow: hidden;
`;

const BlackValueOuter = styled.div`
  justify-self: flex-start;
  width: 100%;
  height: 1.2em;
  position: relative;
  display: grid;
  align-items: center;
  grid-template-areas: "single";
  background-color: var(--color-gray-500);
  overflow: hidden;
`;

const WhiteValue = styled.p`
  grid-area: single;
  line-height: 1;
  color: var(--color-gray-900);
  text-align: right;
  width: 100%;
  padding-right: 0.25rem;
  z-index: 1;
`;

const BlackValue = styled.div`
  grid-area: single;
  line-height: 1;
  width: 100%;
  text-align: left;
  padding-left: 0.25rem;
  color: var(--color-gray-100);
  z-index: 1;
`;

const WhiteValueBar = styled.div`
  grid-area: single;
  display: flex;
  background-color: var(--color-gray-100);
  height: 100%;
  width: 100%;
  transform: scaleX(var(--scale-x));
  transform-origin: right;
  transition: transform 0.2s ease-in-out;
`;

const BlackValueBar = styled.div`
  grid-area: single;
  background-color: var(--color-gray-800);
  width: 100%;
  height: 100%;
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
      <TextLine
        label="Players Online"
        value={stats.connectedUsers === 0 ? "" : stats.connectedUsers}
      />
      <TextLine label="Your Captures" value={stats.yourCaptures} />
      <TextLine label="Your Moves" value={stats.yourMoves} />
      <TextLine label="Total Moves" value={stats.totalMoves} />
      <WhiteBlackDisplay
        label="Pieces"
        blackValue={stats.blackPiecesRemaining}
        whiteValue={stats.whitePiecesRemaining}
        maxValue={(stats.whitePiecesRemaining + stats.blackPiecesRemaining) / 2}
      />
      <WhiteBlackDisplay
        label="Kings"
        blackValue={stats.blackKingsRemaining}
        whiteValue={stats.whiteKingsRemaining}
        maxValue={(stats.whiteKingsRemaining + stats.blackKingsRemaining) / 2}
      />
    </TextLinesWrapper>
  );
}

function StatsDisplay() {
  const { statsHandler } = React.useContext(HandlersContext);
  const [stats, setStats] = React.useState(statsHandler.current.getStats());
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

export default React.memo(StatsDisplay);
