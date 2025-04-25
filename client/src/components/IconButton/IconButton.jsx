import React from "react";
import styled from "styled-components";

const Wrapper = styled.button`
  background-color: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  svg {
    width: var(--size);
    height: var(--size);
    color: var(--color-stone-400);
    transition: color 0.2s ease-in-out;
  }

  @media (hover: hover) {
    &:hover {
      svg {
        color: var(--color-yellow-300);
      }
    }
  }

  &:disabled {
    cursor: default;
    svg {
      color: var(--color-stone-600);
    }
  }
`;

function IconButton({ children, onClick, disabled, style, size = 24 }) {
  return (
    <Wrapper
      disabled={disabled}
      onClick={onClick}
      style={{ ...style, "--size": size + "px" }}
    >
      {children}
    </Wrapper>
  );
}

export default IconButton;
