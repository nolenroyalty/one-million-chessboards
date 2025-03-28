import React from "react";
import styled from "styled-components";

const Wrapper = styled.header`
  gap: 0.25rem;
  width: 100%;
  display: grid;
  grid-template-areas: "by title count" "subheader subheader subheader";
  grid-template-columns: 1fr auto 1fr;
  align-items: baseline;
  margin-bottom: 0.125rem;
  padding-bottom: 0.5rem;
  margin-top: 0.125rem;
  border-bottom: 1px solid var(--color-sky-700);
`;

const Title = styled.h1`
  font-size: 1.5rem;
  grid-area: title;
  line-height: 1;

  @media (min-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Subheader = styled.h2`
  font-family: "Apercu Italic Pro", sans-serif;
  font-size: 0.875rem;
  font-style: italic;
  grid-area: subheader;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  color: var(--color-neutral-400);
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
      <Subheader>moving a piece moves it for everyone!</Subheader>
    </Wrapper>
  );
}

export default Header;
