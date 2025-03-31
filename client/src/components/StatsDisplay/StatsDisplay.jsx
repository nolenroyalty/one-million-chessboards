import React from "react";
import styled from "styled-components";
import BoardControlsPanel from "../BoardControlsPanel/BoardControlsPanel";

const Wrapper = styled(BoardControlsPanel)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  grid-area: stats;
  min-height: 100px;
  min-width: 100px;
`;

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
      <div>Total Moves: {stats.totalMoves}</div>
      <div>White Pieces Remaining: {stats.whitePiecesRemaining}</div>
      <div>Black Pieces Remaining: {stats.blackPiecesRemaining}</div>
    </Wrapper>
  );
}

export default StatsDisplay;
