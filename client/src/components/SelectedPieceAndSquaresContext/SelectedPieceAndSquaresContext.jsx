import React from "react";
import HandlersContext from "../HandlersContext/HandlersContext";
import ShowLargeBoardContext from "../ShowLargeBoardContext/ShowLargeBoardContext";

const SelectedPieceAndSquaresContext = React.createContext();

export function SelectedPieceAndSquaresContextProvider({ children }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const [selectedPieceAndSquares, setSelectedPieceAndSquares] = React.useState({
    selectedPiece: null,
    moveableSquares: new Map(),
  });
  const { showLargeBoard } = React.useContext(ShowLargeBoardContext);

  const clearSelectedPiece = React.useCallback(() => {
    setSelectedPieceAndSquares({
      selectedPiece: null,
      moveableSquares: new Map(),
    });
  }, []);

  const setSelectedPiece = React.useCallback(
    (piece) => {
      setSelectedPieceAndSquares({
        selectedPiece: piece,
        moveableSquares: pieceHandler.current.getMoveableSquares(piece),
      });
    },
    [pieceHandler]
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
