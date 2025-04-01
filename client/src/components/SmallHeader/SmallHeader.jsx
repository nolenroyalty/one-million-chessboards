import React from "react";
import styled from "styled-components";

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
  padding: 0 var(--main-side-padding);
  border-bottom: 1px solid var(--color-sky-700);
  margin-bottom: 0.25rem;
`;

const Title = styled.span`
  color: var(--color-neutral-400);
  font-family: "Sunset Demi";
`;

function SmallHeader() {
  return (
    <Wrapper>
      <Title>One Million Chessboards</Title>
    </Wrapper>
  );
}

export default SmallHeader;
