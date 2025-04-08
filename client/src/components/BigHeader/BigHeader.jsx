import React from "react";
import styled, { keyframes } from "styled-components";

const moveUp = keyframes`
  from {
    transform: translate(-50%, 0);
  }
  to {
    transform: translate(-50%, calc(-15px - 100%));
  }
`;

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
  /* border-bottom: 1px solid var(--color-sky-700); */
  position: absolute;
  z-index: 100;
  top: -2px;
  padding-top: 5px;
  left: 50%;
  transform: translate(-50%, 0);
  background-color: var(--color-neutral-950);
  animation: ${moveUp} 1s ease-in-out both;
  animation-delay: 1s;
  background-image:
    linear-gradient(#0c4a6e55 0.8px, transparent 0.8px),
    linear-gradient(to right, #0c4a6e55 0.8px, #0a0a0a 0.8px);
  background-size: 16px 16px;
  width: calc(min(100%, 1000px));
  border-left: 1px solid var(--color-sky-700);
  border-right: 1px solid var(--color-sky-700);
  @media (max-width: 1000px) {
    border-left: none;
    border-right: none;
  }
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

function BigHeader() {
  return (
    <Wrapper>
      <Title>One Million Chessboards</Title>
      <Subheader>moving a piece moves it for everyone!</Subheader>
    </Wrapper>
  );
}

export default BigHeader;
