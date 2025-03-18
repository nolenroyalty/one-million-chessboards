export function pieceKey(x, y) {
  return `${x}-${y}`;
}

export function keyToCoords(key) {
  return key.split("-").map(Number);
}

export function getPiece(pieces, x, y) {
  return pieces.get(pieceKey(x, y));
}

export function createMoveRequest(piece, toX, toY) {
  return {
    type: "move",
    pieceId: piece.id,
    fromX: piece.x,
    fromY: piece.y,
    toX,
    toY,
  };
}

export const TYPE_TO_NAME = {
  0: "pawn",
  1: "knight",
  2: "bishop",
  3: "rook",
  4: "queen",
  5: "king",
};

export function imageForPiece(piece) {
  const isWhite = piece.isWhite;
  const name = TYPE_TO_NAME[piece.type];
  return `/pieces/${isWhite ? "white" : "black"}/${name}.png`;
}

function capturable({ pieces, weAreWhite, fromX, fromY, toX, toY }) {
  if (!pieces.has(pieceKey(toX, toY))) {
    return false;
  }
  const piece = pieces.get(pieceKey(toX, toY));
  if (piece.isWhite === weAreWhite) {
    return false;
  }
  const fromBoardX = Math.floor(fromX / 8);
  const fromBoardY = Math.floor(fromY / 8);
  const toBoardX = Math.floor(toX / 8);
  const toBoardY = Math.floor(toY / 8);
  return fromBoardX === toBoardX && fromBoardY === toBoardY;
}

// doesn't handle en passant
function addMoveableSquaresForPawn({ piece, pieces, squares }) {
  const isWhite = piece.isWhite;
  const x = piece.x;
  const y = piece.y;
  const dy = isWhite ? -1 : 1;
  const oneUp = pieceKey(x, y + dy);
  const twoUp = pieceKey(x, y + 2 * dy);
  if (!pieces.has(oneUp)) {
    squares.push([x, y + dy]);
  }
  if (!pieces.has(twoUp) && piece.moveState === 0) {
    squares.push([x, y + 2 * dy]);
  }
  for (const dx of [-1, 1]) {
    if (
      capturable({
        pieces,
        weAreWhite: isWhite,
        fromX: x,
        fromY: y,
        toX: x + dx,
        toY: y + dy,
      })
    ) {
      squares.push([x + dx, y + dy]);
    }
  }
}

function boundsCheckMoveableSquares({ squares }) {
  return squares.filter(([x, y]) => x >= 0 && x <= 7999 && y >= 0 && y <= 7999);
}

export function getMoveableSquares(piece, pieces) {
  const squares = [];
  const pieceType = piece.type;
  const name = TYPE_TO_NAME[pieceType];

  switch (name) {
    case "pawn":
      addMoveableSquaresForPawn({ piece, pieces, squares });
      break;
    default:
      break;
  }
  const checked = boundsCheckMoveableSquares({ squares });
  const ret = new Set();
  for (const [x, y] of checked) {
    ret.add(pieceKey(x, y));
  }
  return ret;
}
