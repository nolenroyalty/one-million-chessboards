import React from "react";
import HandlersContext from "../HandlersContext/HandlersContext";
import ShowLargeBoardContext from "../ShowLargeBoardContext/ShowLargeBoardContext";
import CurrentColorContext from "../CurrentColorProvider/CurrentColorProvider";
import { RESPECT_COLOR_REQUIREMENT } from "../../constants";
const SelectedPieceAndSquaresContext = React.createContext();

export function SelectedPieceAndSquaresContextProvider({ children }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const [selectedPieceAndSquares, setSelectedPieceAndSquares] = React.useState({
    selectedPiece: null,
    moveableSquares: new Map(),
  });
  const { showLargeBoard } = React.useContext(ShowLargeBoardContext);
  const { currentColor } = React.useContext(CurrentColorContext);

  const clearSelectedPiece = React.useCallback(() => {
    setSelectedPieceAndSquares({
      selectedPiece: null,
      moveableSquares: new Map(),
    });
  }, []);

  const setSelectedPiece = React.useCallback(
    (piece) => {
      if (!piece || piece.type === undefined) {
        console.warn("setting selected piece to null");
        return;
      }
      let moveableSquares;
      if (RESPECT_COLOR_REQUIREMENT) {
        if (piece.isWhite !== currentColor.playingWhite) {
          moveableSquares = new Map();
        } else {
          moveableSquares = pieceHandler.current.getMoveableSquares(piece);
        }
      } else {
        moveableSquares = pieceHandler.current.getMoveableSquares(piece);
      }
      setSelectedPieceAndSquares({
        selectedPiece: piece,
        moveableSquares,
      });
    },
    [pieceHandler, currentColor.playingWhite]
  );

  const clearSelectedPieceForId = React.useCallback((id) => {
    setSelectedPieceAndSquares((prev) => {
      if (prev.selectedPiece?.id === id) {
        return {
          selectedPiece: null,
          moveableSquares: new Map(),
        };
      }
      return prev;
    });
  }, []);

  React.useEffect(() => {
    // clear piece when escape is pressed
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        clearSelectedPiece();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [clearSelectedPiece]);

  React.useEffect(() => {
    clearSelectedPiece();
  }, [showLargeBoard, clearSelectedPiece]);

  React.useEffect(() => {
    let intervalId = null;
    const refreshMoveableSquares = () => {
      setSelectedPieceAndSquares((prev) => ({
        ...prev,
        moveableSquares: pieceHandler.current.getMoveableSquares(
          prev.selectedPiece
        ),
      }));
    };
    const haveSelectedPiece = !!selectedPieceAndSquares.selectedPiece;
    const colorMatches = RESPECT_COLOR_REQUIREMENT
      ? selectedPieceAndSquares.selectedPiece?.isWhite ===
        currentColor.playingWhite
      : true;
    if (haveSelectedPiece && colorMatches) {
      intervalId = setInterval(refreshMoveableSquares, 800);
    } else {
      clearInterval(intervalId);
    }
    return () => clearInterval(intervalId);
  }, [
    pieceHandler,
    selectedPieceAndSquares.selectedPiece,
    currentColor.playingWhite,
  ]);

  const value = React.useMemo(
    () => ({
      selectedPiece: selectedPieceAndSquares.selectedPiece,
      moveableSquares: selectedPieceAndSquares.moveableSquares,
      setSelectedPiece,
      clearSelectedPiece,
      clearSelectedPieceForId,
    }),
    [
      selectedPieceAndSquares,
      setSelectedPiece,
      clearSelectedPiece,
      clearSelectedPieceForId,
    ]
  );

  return (
    <SelectedPieceAndSquaresContext.Provider value={value}>
      {children}
    </SelectedPieceAndSquaresContext.Provider>
  );
}

export default SelectedPieceAndSquaresContext;
