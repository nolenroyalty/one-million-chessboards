import React from "react";
import HandlersContext from "../HandlersContext/HandlersContext";
import ShowLargeBoardContext from "../ShowLargeBoardContext/ShowLargeBoardContext";

const SelectedPieceAndSquaresContext = React.createContext();

export function SelectedPieceAndSquaresContextProvider({ children }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const [selectedPiece, _setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());
  const { showLargeBoard } = React.useContext(ShowLargeBoardContext);

  const clearSelectedPiece = React.useCallback(() => {
    _setSelectedPiece(null);
    setMoveableSquares(new Set());
  }, []);

  const setSelectedPiece = React.useCallback(
    (piece) => {
      _setSelectedPiece(piece);
      const moveableSquares = pieceHandler.current.getMoveableSquares(piece);
      setMoveableSquares(moveableSquares);
    },
    [pieceHandler]
  );

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
      selectedPiece,
      setSelectedPiece,
      moveableSquares,
      clearSelectedPiece,
    }),
    [selectedPiece, setSelectedPiece, moveableSquares, clearSelectedPiece]
  );

  return (
    <SelectedPieceAndSquaresContext.Provider value={value}>
      {children}
    </SelectedPieceAndSquaresContext.Provider>
  );
}

export default SelectedPieceAndSquaresContext;
