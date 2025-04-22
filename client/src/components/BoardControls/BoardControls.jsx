import React from "react";
import styled from "styled-components";
import IconButton from "../IconButton/IconButton";
import {
  CirclePlus,
  CircleMinus,
  Skull,
  CircleArrowDown,
  CircleArrowUp,
  CircleArrowLeft,
  CircleArrowRight,
  DollarSign,
  Mail,
  Twitter,
} from "lucide-react";
import HandlersContext from "../HandlersContext/HandlersContext";

import BoardControlsPanel from "../BoardControlsPanel/BoardControlsPanel";
import Minimap from "../Minimap/Minimap";
import StatsDisplay from "../StatsDisplay/StatsDisplay";
import ColorYouArePlaying from "../ColorYouArePlaying/ColorYouArePlaying";
import { QUERY } from "../../constants";
import CoordsContext from "../CoordsContext/CoordsContext";
import ShowLargeBoardContext from "../ShowLargeBoardContext/ShowLargeBoardContext";
import SelectedPieceDisplay from "../SelectedPieceDisplay/SelectedPieceDisplay";

const Wrapper = styled.div`
  width: 100%;
  --inner-height: 170px;
  gap: 0.5rem;
  --padding: 0.5rem;
  @media (${QUERY.VERY_SMALL}) {
    --inner-height: 185px;
    --padding: 0.25rem;
  }
  // we set height manually and refer to it for our first column width
  // because firefox has a bug with grid sizing otherwise :/
  padding: var(--padding);
  padding-top: 0.5rem;
  height: calc(var(--inner-height) + 2 * var(--padding));
  /* border-radius: 0.25rem; */
  /* border: 1px solid var(--color-sky-700); */
  transform: translate(0, var(--translate-y));
  transition: transform 0.2s ease-in-out;

  display: grid;
  grid-template-areas: "minimap you-are-playing you-are-playing buttons" "minimap piece stats buttons" "minimap piece stats by";
  grid-template-rows: 1fr 2fr auto;
  grid-template-columns: var(--inner-height) minmax(150px, 2fr) 3fr auto;
  align-items: end;

  @media (${QUERY.NO_PORTRAIT}) {
    grid-template-columns: var(--inner-height) auto 3fr auto;
  }

  @media (${QUERY.VERY_SMALL}) {
    grid-template-areas: "minimap buttons buttons" "minimap stats stats" "by stats stats";
    grid-template-rows: auto auto auto;
    grid-template-columns: 125px auto 1fr;
  }
  border: none;
  border-top: 1px solid var(--color-sky-700);
  border-radius: unset;
  width: calc(100% + 2 * var(--main-side-padding));
  margin-left: calc(-1 * var(--main-side-padding));
  margin-right: calc(-1 * var(--main-side-padding));

  justify-content: space-between;

  opacity: 1;
  background-image:
    linear-gradient(#0c4a6ea6 0.8px, transparent 0.8px),
    linear-gradient(to right, #0c4a6eab 0.8px, #0a0a0a 0.8px);
  background-size: 16px 16px;
`;

const AllBoardButtonsWrapper = styled(BoardControlsPanel)`
  display: grid;
  grid-area: buttons;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0.375rem;
  padding: 0.75rem;
  grid-template-areas:
    "zoomout up zoomin"
    "left . right"
    ". down recent";
  align-self: start;
  justify-self: end;
  max-width: fit-content;

  @media (${QUERY.VERY_SMALL}) {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: none;
    padding: 0.25rem 0.5rem;
  }
`;

const ByWrapper = styled(BoardControlsPanel)`
  grid-area: by;
  padding: 0.25rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  width: max-content;

  @media (${QUERY.VERY_SMALL}) {
    font-size: 0.75rem;
  }
`;

const ByText = styled.p`
  color: var(--color-stone-400);
`;

const SVGLink = styled.a`
  color: var(--color-sky-400);
  transform: translate(0, 1px);
  transition: color 0.2s ease-in-out;

  &:hover {
    color: var(--color-sky-100);
  }

  & svg {
    width: 16px;
    height: 16px;
  }

  @media (${QUERY.VERY_SMALL}) {
    & svg {
      width: 12px;
      height: 12px;
    }
  }
`;

const ByLinks = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.125rem;
`;

function By() {
  return (
    <ByWrapper>
      <ByText>
        by <a href="https://eieio.games">eieio</a>
      </ByText>
      <ByLinks>
        <SVGLink href="https://eieio.substack.com/">
          <Mail />
        </SVGLink>
        <SVGLink href="https://buymeacoffee.com/eieio">
          <DollarSign />
        </SVGLink>
        <SVGLink href="https://x.com/itseieio">
          <Twitter />
        </SVGLink>
      </ByLinks>
    </ByWrapper>
  );
}

function RecentCapturesButton({ setCoords, coords }) {
  const { recentCapturesHandler } = React.useContext(HandlersContext);
  const [hasRecentCaptures, setHasRecentCaptures] = React.useState(() => {
    const recentCaptures = recentCapturesHandler.current.getRecentCaptures();
    return recentCaptures.length > 0;
  });

  React.useEffect(() => {
    let rch = recentCapturesHandler.current;
    rch.subscribe({
      id: "recent-captures-button",
      callback: (recentCaptures) => {
        setHasRecentCaptures(recentCaptures.length > 0);
      },
    });
    return () => {
      rch.unsubscribe({
        id: "recent-captures-button",
      });
    };
  }, [recentCapturesHandler]);

  return (
    <IconButton
      style={{ gridArea: "recent" }}
      disabled={!hasRecentCaptures}
      onClick={() => {
        const result = recentCapturesHandler.current.randomRecentCapture({
          preferFurtherFromCoords: coords,
        });
        if (result) {
          setCoords(result);
        }
      }}
    >
      <Skull />
    </IconButton>
  );
}
function AllBoardButtons() {
  const { coords, setCoords } = React.useContext(CoordsContext);
  const { showLargeBoard, setShowLargeBoard } = React.useContext(
    ShowLargeBoardContext
  );
  const delta = showLargeBoard ? 4 : 1;
  return (
    <AllBoardButtonsWrapper>
      <IconButton
        disabled={showLargeBoard}
        style={{ gridArea: "zoomout" }}
        onClick={() => setShowLargeBoard(true)}
      >
        <CircleMinus />
      </IconButton>
      <IconButton
        style={{ gridArea: "zoomin" }}
        disabled={!showLargeBoard}
        onClick={() => setShowLargeBoard(false)}
      >
        <CirclePlus />
      </IconButton>
      <RecentCapturesButton setCoords={setCoords} coords={coords} />
      <IconButton
        onClick={() => {
          setCoords((prev) => ({ x: prev.x, y: prev.y - delta }));
        }}
        style={{ gridArea: "up" }}
      >
        <CircleArrowUp />
      </IconButton>
      <IconButton
        onClick={() => {
          setCoords((prev) => ({ x: prev.x - delta, y: prev.y }));
        }}
        style={{ gridArea: "left" }}
      >
        <CircleArrowLeft />
      </IconButton>
      <IconButton
        onClick={() => {
          setCoords((prev) => ({ x: prev.x + delta, y: prev.y }));
        }}
        style={{ gridArea: "right" }}
      >
        <CircleArrowRight />
      </IconButton>
      <IconButton
        onClick={() => {
          setCoords((prev) => ({ x: prev.x, y: prev.y + delta }));
        }}
        style={{ gridArea: "down" }}
      >
        <CircleArrowDown />
      </IconButton>
    </AllBoardButtonsWrapper>
  );
}

function BoardControls() {
  const [hide, setHide] = React.useState(false);
  // add hide functionality especially for mobile...

  //   React.useEffect(() => {
  //     const handleKeyDown = (e) => {
  //       if (e.key === "Escape") {
  //         console.log("hello");
  //         setHide((prev) => !prev);
  //       }
  //     };
  //     window.addEventListener("keydown", handleKeyDown);
  //     return () => {
  //       window.removeEventListener("keydown", handleKeyDown);
  //     };
  //   }, [setHide]);

  return (
    <Wrapper style={{ "--translate-y": hide ? "100%" : "0%" }}>
      <Minimap />
      <SelectedPieceDisplay />
      <StatsDisplay />
      <ColorYouArePlaying />
      <AllBoardButtons />
      <By />
    </Wrapper>
  );
}

export default BoardControls;
