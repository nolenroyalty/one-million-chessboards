export function pieceKey(x, y) {
  return `${x}-${y}`;
}

export function getPiece(pieces, x, y) {
  return pieces.get(pieceKey(x, y));
}
