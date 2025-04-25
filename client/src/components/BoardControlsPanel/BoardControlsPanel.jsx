import styled from "styled-components";

export const PANEL_BORDER_SIZE = 4;
const BoardControlsPanel = styled.div`
  background-color: var(--color-neutral-950);
  border: ${PANEL_BORDER_SIZE}px double var(--color-sky-700);
  user-select: none;
`;

export default BoardControlsPanel;
