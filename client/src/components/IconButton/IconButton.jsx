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
    color: var(--color-gray-700);
    transition: color 0.2s ease-in-out;
  }

  &:hover {
    svg {
      color: var(--color-gray-900);
    }
  }

  &:disabled {
    cursor: default;
    svg {
      color: var(--color-gray-500);
    }
  }
`;

function IconButton({ children, onClick, disabled }) {
  return (
    <Wrapper disabled={disabled} onClick={onClick}>
      {children}
    </Wrapper>
  );
}

export default IconButton;
