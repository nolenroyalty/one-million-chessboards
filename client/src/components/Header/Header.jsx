import React from "react";
import styled from "styled-components";

const Wrapper = styled.header`
  gap: 0.5rem;
  width: 100%;
  display: grid;
  grid-template-areas: "by title count";
  grid-template-columns: 1fr auto 1fr;
  align-items: baseline;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  grid-area: title;
  line-height: 1;

  @media (min-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Count = styled.p`
  grid-area: count;
`;

const By = styled.p`
  grid-area: by;
`;

function Header({ runBot }) {
  return (
    <Wrapper>
      <Title style={{ color: runBot ? "var(--color-yellow-300)" : null }}>
        One Million Chessboards
      </Title>
      <Count>hi</Count>
      <By>
        a website by <a href="https://eieio.games">eieio</a>
      </By>
    </Wrapper>
  );
}

export default Header;
