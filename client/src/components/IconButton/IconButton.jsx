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

  svg {
    width: 24px;
    height: 24px;
    color: var(--color-stone-400);
    transition: color 0.2s ease-in-out;
  }

  &:hover {
    svg {
      color: var(--color-yellow-300);
    }
  }

  &:disabled {
    cursor: default;
    svg {
      color: var(--color-stone-600);
    }
  }
`;

function IconButton({ children, onClick, disabled, style }) {
  return (
    <Wrapper disabled={disabled} onClick={onClick} style={style}>
      {children}
    </Wrapper>
  );
}

export default IconButton;
