import React from "react";
import styled from "styled-components";
import BoardControlsPanel from "../BoardControlsPanel/BoardControlsPanel";

const Wrapper = styled(BoardControlsPanel)`
  grid-area: you-are-playing;
  position: relative;
  height: 100%;
  justify-self: end;
  /* border: 1px solid var(--color-sky-700); */
  background-color: var(--color-neutral-950);
  min-width: 22ch;
`;

const TextNotAbsolute = styled.p`
  padding: 0 0.5rem;
  text-align: center;
`;

const WhiteTextSpan = styled.span`
  color: var(--color-neutral-100);
`;

function ColorYouArePlaying({ isWhite }) {
  const text = isWhite ? "white pieces" : "black pieces";
  return (
    <Wrapper>
      <TextNotAbsolute>
        you are the <WhiteTextSpan>{text}</WhiteTextSpan>
      </TextNotAbsolute>
    </Wrapper>
  );
}

export default ColorYouArePlaying;
