import React from "react";
import styled from "styled-components";

const Wrapper = styled.div`
  width: calc(100% + 2 * var(--main-side-padding));
  height: 2rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-left: calc(-1 * var(--main-side-padding));
  margin-right: calc(-1 * var(--main-side-padding));
  padding: 0 var(--main-side-padding);
`;

const Stat = styled.span`
  color: var(--color-neutral-400);
`;

const Stats = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
`;

const Title = styled.span`
  color: var(--color-neutral-400);
`;

function SmallHeader() {
  return (
    <Wrapper>
      <Title>One Million Chessboards</Title>
      <Stats>
        <Stat>1000</Stat>
        <Stat>1000</Stat>
        <Stat>1000</Stat>
      </Stats>
    </Wrapper>
  );
}

export default SmallHeader;
