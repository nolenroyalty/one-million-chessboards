import React from "react";
import HandlersContext from "../HandlersContext/HandlersContext";

const SelectedPieceAndSquaresContext = React.createContext();

export function SelectedPieceAndSquaresContextProvider({ children }) {
  const { pieceHandler } = React.useContext(HandlersContext);
  const [selectedPiece, _setSelectedPiece] = React.useState(null);
  const [moveableSquares, setMoveableSquares] = React.useState(new Set());

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
