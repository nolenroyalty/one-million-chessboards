const MAX_MOVE_DISTANCE = 50;

export function pieceKey(x, y) {
  return `${x}-${y}`;
}

export function keyToCoords(key) {
  return key.split("-").map(Number);
}

export function getPiece(pieces, x, y) {
  return pieces.get(pieceKey(x, y));
}

export function easeInOutSquare(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function getStartingAndEndingCoords({ coords, width, height }) {
  // if (width % 2 === 0 || height % 2 === 0) {
  //   throw new Error(
  //     `We're lazy so width and height must be odd. width: ${width}, height: ${height}`
  //   );
  // }
  const halfWidthSmall = Math.floor(width / 2);
  const halfHeightSmall = Math.floor(height / 2);
  const halfWidthLarge = Math.ceil(width / 2);
  const halfHeightLarge = Math.ceil(height / 2);
  const startingX = coords.x - halfWidthSmall;
  const startingY = coords.y - halfHeightSmall;
  const endingX = coords.x + halfWidthLarge;
  const endingY = coords.y + halfHeightLarge;
  return { startingX, startingY, endingX, endingY };
}

export function getSquareColor(x, y) {
  if (x % 2 === 0) {
    return y % 2 === 0 ? "#eeeed2" : "#6f8d51";
  }
  return y % 2 === 0 ? "#6f8d51" : "#eeeed2";
}

export function getScreenRelativeCoords({ x, y, startingX, startingY }) {
  return {
    x: x - startingX,
    y: y - startingY,
  };
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

export function imageForPieceType({ pieceType, isWhite }) {
  const name = TYPE_TO_NAME[pieceType];
  return `/pieces/${isWhite ? "white" : "black"}/${name}.png`;
}

const defaultWhiteColor = "#3B82F6";
const WHITE_PIECE_COLORS = {
  pawn: "#94A3B8",
  bishop: defaultWhiteColor,
  rook: defaultWhiteColor,
  queen: "#A78BFA",
  king: "#FDE047",
  knight: defaultWhiteColor,
};

const defaultBlackColor = "#1E3A8A";
const BLACK_PIECE_COLORS = {
  pawn: "#334155",
  bishop: defaultBlackColor,
  rook: defaultBlackColor,
  queen: "#5B21B6",
  king: "#CA8A04",
  knight: defaultBlackColor,
};

export function colorForPieceType({ pieceType, isWhite }) {
  // return "transparent";
  const name = TYPE_TO_NAME[pieceType];
  return isWhite ? WHITE_PIECE_COLORS[name] : BLACK_PIECE_COLORS[name];
}

function spawnsTwoBoards({ fromX, fromY, toX, toY }) {
  const fromBoardX = Math.floor(fromX / 8);
  const fromBoardY = Math.floor(fromY / 8);
  const toBoardX = Math.floor(toX / 8);
  const toBoardY = Math.floor(toY / 8);
  return fromBoardX !== toBoardX || fromBoardY !== toBoardY;
}

function capturable({ pieces, weAreWhite, fromX, fromY, toX, toY }) {
  if (!pieces.has(pieceKey(toX, toY))) {
    return false;
  }
  const piece = pieces.get(pieceKey(toX, toY));
  if (piece.isWhite === weAreWhite) {
    return false;
  }
  if (spawnsTwoBoards({ fromX, fromY, toX, toY })) {
    return false;
  }
  return true;
}

function empty({ pieces, x, y }) {
  return !pieces.has(pieceKey(x, y));
}

function enPassantable({ pieces, weAreWhite, fromX, fromY, toX, toY, dy }) {
  if (!pieces.has(pieceKey(toX, toY))) {
    return false;
  }
  const piece = pieces.get(pieceKey(toX, toY));
  if (piece.isWhite === weAreWhite) {
    return false;
  }
  if (TYPE_TO_NAME[piece.type] !== "pawn") {
    return false;
  }
  if (piece.moveState !== 2) {
    return false;
  }
  if (spawnsTwoBoards({ fromX, fromY, toX, toY })) {
    return false;
  }
  if (pieces.has(pieceKey(toX, toY + dy))) {
    return false;
  }
  return true;
}

// only partially handles en passant
// needs to specify that we're doing a capture for it (?)
function addMoveableSquaresForPawn({ piece, pieces, squares }) {
  const isWhite = piece.isWhite;
  const x = piece.x;
  const y = piece.y;
  const dy = isWhite ? -1 : 1;
  if (empty({ pieces, x, y: y + dy })) {
    squares.push([x, y + dy]);
    if (empty({ pieces, x, y: y + 2 * dy }) && piece.moveState === 0) {
      squares.push([x, y + 2 * dy]);
    }
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
    if (
      enPassantable({
        pieces,
        weAreWhite: isWhite,
        fromX: x,
        fromY: y,
        toX: x + dx,
        toY: y,
        dy,
      })
    ) {
      squares.push([x + dx, y + dy]);
    }
  }
}

function addMoveableSquaresForKnight({ piece, pieces, squares }) {
  const x = piece.x;
  const y = piece.y;
  const candidates = [
    [-1, 2],
    [1, 2],
    [2, -1],
    [2, 1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
  ];
  for (const [dx, dy] of candidates) {
    const toX = x + dx;
    const toY = y + dy;
    if (
      capturable({
        pieces,
        weAreWhite: piece.isWhite,
        fromX: x,
        fromY: y,
        toX,
        toY,
      })
    ) {
      squares.push([toX, toY]);
    }
    if (empty({ pieces, x: toX, y: toY })) {
      squares.push([toX, toY]);
    }
  }
}

function addMoveableSquaresForBishop({ piece, pieces, squares }) {
  const x = piece.x;
  const y = piece.y;
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      let i = 1;
      while (i < MAX_MOVE_DISTANCE) {
        const toX = x + i * dx;
        const toY = y + i * dy;
        const isEmpty = empty({ pieces, x: toX, y: toY });
        const isCapturable = capturable({
          pieces,
          weAreWhite: piece.isWhite,
          fromX: x,
          fromY: y,
          toX,
          toY,
        });
        if (isCapturable) {
          squares.push([toX, toY]);
          break;
        }
        if (isEmpty) {
          squares.push([toX, toY]);
        } else {
          break;
        }
        i++;
      }
    }
  }
}

function addMoveableSquaresForRook({ piece, pieces, squares }) {
  const x = piece.x;
  const y = piece.y;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    let i = 1;
    while (i < MAX_MOVE_DISTANCE) {
      const toX = x + i * dx;
      const toY = y + i * dy;
      const isEmpty = empty({ pieces, x: toX, y: toY });
      const isCapturable = capturable({
        pieces,
        weAreWhite: piece.isWhite,
        fromX: x,
        fromY: y,
        toX,
        toY,
      });
      if (isCapturable) {
        squares.push([toX, toY]);
        break;
      }
      if (isEmpty) {
        squares.push([toX, toY]);
      } else {
        break;
      }
      i++;
    }
  }
}

// doesn't handle castling
function addMoveableSquaresForKing({ piece, pieces, squares }) {
  const x = piece.x;
  const y = piece.y;
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const toX = x + dx;
      const toY = y + dy;
      const isCapturable = capturable({
        pieces,
        weAreWhite: piece.isWhite,
        fromX: x,
        fromY: y,
        toX,
        toY,
      });
      if (isCapturable) {
        squares.push([toX, toY]);
      }
      if (empty({ pieces, x: toX, y: toY })) {
        squares.push([toX, toY]);
      }
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
    case "knight":
      addMoveableSquaresForKnight({ piece, pieces, squares });
      break;
    case "bishop":
      addMoveableSquaresForBishop({ piece, pieces, squares });
      break;
    case "rook":
      addMoveableSquaresForRook({ piece, pieces, squares });
      break;
    case "queen":
      addMoveableSquaresForBishop({ piece, pieces, squares });
      addMoveableSquaresForRook({ piece, pieces, squares });
      break;
    case "king":
      addMoveableSquaresForKing({ piece, pieces, squares });
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

export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
