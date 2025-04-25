import React from "react";
import styled from "styled-components";
import { WebsocketContext } from "../WebsocketProvider/WebsocketProvider";
const Wrapper = styled.div`
  /* width: calc(100% + 2 * var(--main-side-padding)); */
  width: 100%;
  height: 2rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  /* margin-left: calc(-1 * var(--main-side-padding)); */
  /* margin-right: calc(-1 * var(--main-side-padding)); */
  /* padding: 0 var(--main-side-padding); */
  border-bottom: 1px solid var(--color-sky-700);
  margin-bottom: 0.25rem;
  position: relative;
`;

const Title = styled.a`
  color: var(--color-neutral-400);
  font-family: "Sunset Demi";
  text-decoration: none;
  cursor: pointer;

  &:visited {
    color: var(--color-neutral-400);
  }

  &:hover {
    color: var(--color-neutral-400);
  }
`;

const DisconnectedDiv = styled.div`
  position: absolute;
  top: 0%;
  left: 50%;
  transform: translate(-50%, var(--translate-y));
  background-color: var(--background-color);
  color: var(--color-neutral-100);
  padding: 0.25rem 0.5rem;
  border-radius: 0 0 0.25rem 0.25rem;
  transition:
    transform 0.5s ease-in-out 1.5s,
    background-color 0.5s ease-in-out 0.2s;
  min-width: 13ch;
  text-align: center;
  user-select: none;
`;

function MaybeShowDisconnected() {
  const { connected } = React.useContext(WebsocketContext);
  const text = connected ? "Connected" : "Disconnected";
  return (
    <DisconnectedDiv
      style={{
        "--translate-y": connected ? "-115%" : "0%",
        "--background-color": connected
          ? "var(--color-blue-800)"
          : "var(--color-pink-400)",
      }}
    >
      {text}
    </DisconnectedDiv>
  );
}

function SmallHeader() {
  return (
    <Wrapper>
      <MaybeShowDisconnected />
      <Title href="/">One Million Chessboards</Title>
    </Wrapper>
  );
}

export default SmallHeader;
