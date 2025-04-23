import React from "react";
import { keyToCoords } from "../utils";

function useStartBot({ pieceHandler, submitMove, onlyId }) {
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === "b") {
        setStarted((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    if (!started) {
      return;
    }
    let botInterval;
    let count = 0;
    let attemptsById = {};

    const loop = () => {
      let attempts = 0;
      let targetPiece, targetSquare, targetMoveType;
      if (onlyId) {
        const piece = pieceHandler.current.getPieceById(onlyId);
        if (piece) {
          targetPiece = piece;
          const moveableSquaresAndMoveType =
            pieceHandler.current.getMoveableSquares(targetPiece);
          if (moveableSquaresAndMoveType.size > 0) {
            const squares = Array.from(moveableSquaresAndMoveType.keys());
            targetSquare =
              Array.from(squares)[Math.floor(Math.random() * squares.length)];
            const data = moveableSquaresAndMoveType.get(targetSquare);
            targetMoveType = data.moveType;
            const [x, y] = keyToCoords(targetSquare);
            submitMove({
              piece: targetPiece,
              toX: x,
              toY: y,
              moveType: targetMoveType,
            });
          }
        }
      } else {
        let data;
        for (let i = 0; i < 10; i++) {
          while (attempts < 50) {
            const allPieceIds = Array.from(
              pieceHandler.current.getAllPieceIds()
            );
            const randomId =
              allPieceIds[Math.floor(Math.random() * allPieceIds.length)];
            const randomPiece = pieceHandler.current.getPieceById(randomId);
            if (!randomPiece) {
              continue;
            }
            const moveableSquaresAndMoveType =
              pieceHandler.current.getMoveableSquares(randomPiece);
            if (moveableSquaresAndMoveType.size > 0) {
              targetPiece = randomPiece;
              const squares = Array.from(moveableSquaresAndMoveType.keys());
              targetSquare =
                Array.from(squares)[Math.floor(Math.random() * squares.length)];
              data = moveableSquaresAndMoveType.get(targetSquare);
              break;
            }
            attempts++;
          }
          if (targetPiece && targetSquare && data) {
            if (!attemptsById[targetPiece.id]) {
              attemptsById[targetPiece.id] = 0;
            }
            attemptsById[targetPiece.id] = attemptsById[targetPiece.id] + 1;
            if (attemptsById[targetPiece.id] > 1) {
              console.log(
                `ATTEMPT ${attemptsById[targetPiece.id]} FOR PIECE ${targetPiece.id}`
              );
            }
            const [x, y] = keyToCoords(targetSquare);
            submitMove({
              piece: targetPiece,
              toX: x,
              toY: y,
              moveType: data.targetMoveType,
              capturedPiece: data.capturedPiece,
              additionalMovedPiece: data.additionalMovedPiece,
              captureRequired: data.captureRequired,
            });
          }
        }
        count++;
        if (count > 5) {
          count = 0;
          attemptsById = {};
        }
      }
    };
    const freq = onlyId ? 400 : 100;
    console.log("starting bot");
    botInterval = setInterval(loop, freq);

    return () => {
      console.log("stopping bot");
      clearInterval(botInterval);
    };
  }, [pieceHandler, submitMove, started, onlyId]);

  return { setRunBot: setStarted };
}

export default useStartBot;
