import React from "react";
import styled from "styled-components";
import Panzoom from "@panzoom/panzoom";
import CoordsContext from "../CoordsContext/CoordsContext";
import ShowLargeBoardContext from "../ShowLargeBoardContext/ShowLargeBoardContext";
const PanzoomWrapper = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  inset: 0;
`;

function PanzoomBox({ clearSelectedPieceAndSquares }) {
  const { setCoords } = React.useContext(CoordsContext);
  const { showLargeBoard } = React.useContext(ShowLargeBoardContext);

  const ref = React.useRef(null);
  const lastPanzoom = React.useRef({ lastX: 0, lastY: 0, accX: 0, accY: 0 });
  React.useEffect(() => {
    const elt = ref.current;
    const panzoom = Panzoom(elt, {
      setTransform: (e, { scale, x, y }) => {},
      disablePan: false,
      disableZoom: true,
    });

    const handlePanzoomStart = (e) => {
      console.log("panzoomstart");
      clearSelectedPieceAndSquares();
      lastPanzoom.current = {
        ...lastPanzoom.current,
        lastX: e.detail.x,
        lastY: e.detail.y,
        accX: 0,
        accY: 0,
        firstXMove: true,
        firstYMove: true,
        lastPanTime: null,
      };
    };
    elt.addEventListener("panzoomstart", handlePanzoomStart);

    const handlePanzoomEnd = (e) => {
      console.log("panzoomend");
    };
    elt.addEventListener("panzoomend", handlePanzoomEnd);

    const handlePanzoomPan = (e) => {
      const panzoomDX = e.detail.x - lastPanzoom.current.lastX;
      const panzoomDY = e.detail.y - lastPanzoom.current.lastY;
      lastPanzoom.current.accX += panzoomDX;
      lastPanzoom.current.accY += panzoomDY;
      if (lastPanzoom.current.lastPanTime === null) {
        // nothing
      } else if (performance.now() - lastPanzoom.current.lastPanTime > 600) {
        lastPanzoom.current.firstXMove = true;
        lastPanzoom.current.firstYMove = true;
        lastPanzoom.current.accX = 0;
        lastPanzoom.current.accY = 0;
      }
      lastPanzoom.current.lastPanTime = performance.now();

      let dx = 0;
      let dy = 0;
      let baseStep = 24;
      const dStep = showLargeBoard ? 5 : 1;
      const xMult = lastPanzoom.current.firstXMove ? 1 : 2;
      const yMult = lastPanzoom.current.firstYMove ? 1 : 2;

      while (lastPanzoom.current.accX > baseStep * xMult) {
        dx -= dStep * xMult;
        lastPanzoom.current.accX -= baseStep * xMult;
        lastPanzoom.current.firstXMove = false;
        console.log(`baseStep: ${baseStep}`);
      }
      while (lastPanzoom.current.accX < -baseStep * xMult) {
        dx += dStep * xMult;
        lastPanzoom.current.accX += baseStep * xMult;
        lastPanzoom.current.firstXMove = false;
      }
      while (lastPanzoom.current.accY > baseStep * yMult) {
        dy -= dStep * yMult;
        lastPanzoom.current.accY -= baseStep * yMult;
        lastPanzoom.current.firstYMove = false;
      }
      while (lastPanzoom.current.accY < -baseStep * yMult) {
        dy += dStep * yMult;
        lastPanzoom.current.accY += baseStep * yMult;
        lastPanzoom.current.firstYMove = false;
      }
      if (dx !== 0 || dy !== 0) {
        // CR nroyalty: make sure not to pan off the edge!!!
        setCoords((coords) => ({
          x: coords.x + dx,
          y: coords.y + dy,
        }));
      }

      lastPanzoom.current = {
        ...lastPanzoom.current,
        lastX: e.detail.x,
        lastY: e.detail.y,
      };
    };
    elt.addEventListener("panzoompan", handlePanzoomPan);

    function handleKeyDown(e) {
      const increment = showLargeBoard ? 6 : 2;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x,
          y: coords.y - increment,
        }));
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x,
          y: coords.y + increment,
        }));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x - increment,
          y: coords.y,
        }));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCoords((coords) => ({
          x: coords.x + increment,
          y: coords.y,
        }));
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      panzoom.destroy();
      window.removeEventListener("keydown", handleKeyDown);
      elt.removeEventListener("panzoomstart", handlePanzoomStart);
      elt.removeEventListener("panzoomend", handlePanzoomEnd);
      elt.removeEventListener("panzoompan", handlePanzoomPan);
    };
  }, [setCoords, clearSelectedPieceAndSquares, showLargeBoard]);
  return <PanzoomWrapper ref={ref} />;
}

export default PanzoomBox;
