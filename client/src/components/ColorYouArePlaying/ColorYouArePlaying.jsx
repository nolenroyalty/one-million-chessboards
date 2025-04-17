import React from "react";
import styled from "styled-components";
import BoardControlsPanel from "../BoardControlsPanel/BoardControlsPanel";
import { QUERY } from "../../constants";
import CurrentColorContext from "../CurrentColorProvider/CurrentColorProvider";

const Wrapper = styled(BoardControlsPanel)`
  grid-area: you-are-playing;
  position: relative;
  height: 100%;
  justify-self: end;
  /* border: 1px solid var(--color-sky-700); */
  background-color: var(--color-neutral-950);
  min-width: 22ch;

  @media (${QUERY.VERY_SMALL}) {
    grid-area: stats;
    width: 100%;
    height: 100%;
    background-color: transparent;
    border: none;
    pointer-events: none;
  }
`;

const TextNotAbsolute = styled.p`
  padding: 0 0.5rem;
  text-align: center;

  @media (${QUERY.VERY_SMALL}) {
    display: none;
  }
`;

const TextAbsolute = styled.p`
  display: none;
  top: 0;
  right: 0;
  transform: translate(-8px, 5px);
  font-size: 0.75rem;
  border-radius: 0.25rem;
  /* border: 1px solid var(--color-sky-700); */

  @media (${QUERY.VERY_SMALL}) {
    display: block;
    position: absolute;
  }
`;

const WhiteTextSpan = styled.span`
  color: var(--color-neutral-100);
`;

function ColorYouArePlaying() {
  const { currentColor } = React.useContext(CurrentColorContext);
  let absoluteText = "";
  let notAbsoluteText = "";
  let absoluteTextStatic = "";
  let notAbsoluteTextStatic = "";
  if (currentColor.playingWhite === null) {
    absoluteText = "loading...";
    notAbsoluteText = "loading...";
    absoluteTextStatic = "";
    notAbsoluteTextStatic = "";
  } else {
    absoluteText = currentColor.playingWhite ? "white" : "black";
    notAbsoluteText = currentColor.playingWhite
      ? "white pieces"
      : "black pieces";
    absoluteTextStatic = "playing";
    notAbsoluteTextStatic = "you are the";
  }
  return (
    <Wrapper>
      <TextNotAbsolute>
        {notAbsoluteTextStatic} <WhiteTextSpan>{notAbsoluteText}</WhiteTextSpan>
      </TextNotAbsolute>
      <TextAbsolute>
        {absoluteTextStatic} <WhiteTextSpan>{absoluteText}</WhiteTextSpan>
      </TextAbsolute>
    </Wrapper>
  );
}

export default ColorYouArePlaying;
