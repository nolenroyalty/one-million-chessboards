import { chess } from "./protoCompiled.js";

const MAX_MOVE_DISTANCE = 36;

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

export function isZstd(u8) {
  return (
    u8[0] === ZSTD_MAGIC[0] &&
    u8[1] === ZSTD_MAGIC[1] &&
    u8[2] === ZSTD_MAGIC[2] &&
    u8[3] === ZSTD_MAGIC[3]
  );
}

export function intervalWithJitter({ baseInterval, jitter, error }) {
  let value = baseInterval + Math.random() * jitter - jitter / 2;
  if (error) {
    const errorJitter = 1 + Math.random() * 0.2;
    value *= 2 * errorJitter;
  }
  return value;
}

export const MOVE_TYPES = {
  NORMAL: chess.MoveType.MOVE_TYPE_NORMAL,
  CASTLE: chess.MoveType.MOVE_TYPE_CASTLE,
  EN_PASSANT: chess.MoveType.MOVE_TYPE_EN_PASSANT,
};

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

export function computeAnimationDuration({
  moveDistance,
  maxAnimationDuration,
  minAnimationDuration,
  maxMoveDistance,
}) {
  const t = clamp(moveDistance / maxMoveDistance, 0, 1);
  const diff = maxAnimationDuration - minAnimationDuration;
  const percent = t * diff;
  return minAnimationDuration + percent;
}

export function getStartingAndEndingCoords({ coords, width, height }) {
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

export function getScreenRelativeCoords({ x, y, startingX, startingY }) {
  return {
    x: x - startingX,
    y: y - startingY,
  };
}

export function getZoomedInScreenAbsoluteCoords({
  screenX,
  screenY,
  boardSizeParams,
}) {
  return {
    x: screenX * boardSizeParams.squarePx,
    y: screenY * boardSizeParams.squarePx,
  };
}

export const TYPE_TO_NAME = {
  [chess.PieceType.PIECE_TYPE_PAWN]: "pawn",
  [chess.PieceType.PIECE_TYPE_KNIGHT]: "knight",
  [chess.PieceType.PIECE_TYPE_BISHOP]: "bishop",
  [chess.PieceType.PIECE_TYPE_ROOK]: "rook",
  [chess.PieceType.PIECE_TYPE_QUEEN]: "queen",
  [chess.PieceType.PIECE_TYPE_KING]: "king",
  [chess.PieceType.PIECE_TYPE_PROMOTED_PAWN]: "promotedPawn",
};

export const NAME_TO_TYPE = Object.fromEntries(
  Object.entries(TYPE_TO_NAME).map(([key, value]) => [value, key])
);

export function humanNameForPieceType({ pieceType }) {
  let name = TYPE_TO_NAME[pieceType];
  if (name === "promotedPawn") {
    return "Pawn";
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function frameImageForPieceType({ pieceType }) {
  let name = TYPE_TO_NAME[pieceType];
  if (name === "promotedPawn") {
    name = "queen";
  }
  return `/pieces/frames-final/${name}.png`;
}

export function imageForPieceType({ pieceType, isWhite }) {
  let name = TYPE_TO_NAME[pieceType];
  if (name === "promotedPawn") {
    name = "queen";
  }
  return `/pieces/${isWhite ? "white" : "black"}-processed/${name}.png`;
}

// const defaultWhiteColor = "#3B82F6";
const defaultWhiteColor = "#0284c7";
const whiteQueenColor = "#0ea5e9";
const WHITE_PIECE_COLORS = {
  pawn: "#fafafa",
  bishop: defaultWhiteColor,
  rook: defaultWhiteColor,
  // queen: "#c4b5fd",
  queen: whiteQueenColor,
  promotedPawn: whiteQueenColor,
  // king: "#FDE047",
  king: "#7dd3fc",
  knight: defaultWhiteColor,
};

const defaultBlackColor = "#115e59";
const blackQueenColor = "#0d9488";
const BLACK_PIECE_COLORS = {
  pawn: "#0a0a0a",
  bishop: defaultBlackColor,
  rook: defaultBlackColor,
  // queen: "#5B21B6",
  queen: blackQueenColor,
  promotedPawn: blackQueenColor,
  // king: "#CA8A04",
  king: "#2dd4bf",
  knight: defaultBlackColor,
};

export function colorForPieceType({ pieceType, isWhite }) {
  // return "transparent";
  const name = TYPE_TO_NAME[pieceType];
  return isWhite ? WHITE_PIECE_COLORS[name] : BLACK_PIECE_COLORS[name];
}

function spansTwoBoards({ fromX, fromY, toX, toY }) {
  const fromBoardX = Math.floor(fromX / 8);
  const fromBoardY = Math.floor(fromY / 8);
  const toBoardX = Math.floor(toX / 8);
  const toBoardY = Math.floor(toY / 8);
  return fromBoardX !== toBoardX || fromBoardY !== toBoardY;
}

function capturable({ pieces, weAreWhite, fromX, fromY, toX, toY }) {
  if (!pieces.has(pieceKey(toX, toY))) {
    return { isCapturable: false, capturedPiece: null };
  }
  const capturedPiece = pieces.get(pieceKey(toX, toY));
  if (capturedPiece.isWhite === weAreWhite) {
    return { isCapturable: false, capturedPiece: null };
  }
  if (spansTwoBoards({ fromX, fromY, toX, toY })) {
    if (capturedPiece.moveCount === 0) {
      return { isCapturable: false, capturedPiece: null };
    }
  }
  return { isCapturable: true, capturedPiece };
}

function empty({ pieces, x, y }) {
  return !pieces.has(pieceKey(x, y));
}

function enPassantable({ pieces, weAreWhite, fromX, fromY, toX, toY, dy }) {
  if (!pieces.has(pieceKey(toX, toY))) {
    return { isEnPassantable: false, capturedPiece: null };
  }
  const piece = pieces.get(pieceKey(toX, toY));
  if (piece.isWhite === weAreWhite) {
    return { isEnPassantable: false, capturedPiece: null };
  }
  if (TYPE_TO_NAME[piece.type] !== "pawn") {
    return { isEnPassantable: false, capturedPiece: null };
  }
  if (!piece.justDoubleMoved) {
    return { isEnPassantable: false, capturedPiece: null };
  }
  if (spansTwoBoards({ fromX, fromY, toX, toY })) {
    if (piece.moveCount === 0) {
      return { isEnPassantable: false, capturedPiece: null };
    }
  }
  if (pieces.has(pieceKey(toX, toY + dy))) {
    return { isEnPassantable: false, capturedPiece: null };
  }
  return { isEnPassantable: true, capturedPiece: piece };
}

function addSquare({
  squares,
  x,
  y,
  moveType,
  capturedPiece = null,
  additionalMovedPiece = null,
  captureRequired = false,
  neverCapturable = false,
}) {
  squares.push([
    x,
    y,
    {
      moveType,
      capturedPiece,
      additionalMovedPiece,
      captureRequired,
      neverCapturable,
    },
  ]);
}

function addMoveableSquaresForPawn({ piece, pieces, squares }) {
  const isWhite = piece.isWhite;
  const x = piece.x;
  const y = piece.y;
  const dy = isWhite ? -1 : 1;
  if (empty({ pieces, x, y: y + dy })) {
    addSquare({
      squares,
      x,
      y: y + dy,
      moveType: MOVE_TYPES.NORMAL,
      neverCapturable: true,
    });
    if (empty({ pieces, x, y: y + 2 * dy }) && piece.moveCount === 0) {
      addSquare({
        squares,
        x,
        y: y + 2 * dy,
        moveType: MOVE_TYPES.NORMAL,
        neverCapturable: true,
      });
    }
  }
  for (const dx of [-1, 1]) {
    const { isCapturable, capturedPiece } = capturable({
      pieces,
      weAreWhite: isWhite,
      fromX: x,
      fromY: y,
      toX: x + dx,
      toY: y + dy,
    });

    if (isCapturable) {
      addSquare({
        squares,
        x: x + dx,
        y: y + dy,
        moveType: MOVE_TYPES.NORMAL,
        capturedPiece,
        captureRequired: true,
      });
    } else {
      const { isEnPassantable, capturedPiece } = enPassantable({
        pieces,
        weAreWhite: isWhite,
        fromX: x,
        fromY: y,
        toX: x + dx,
        toY: y,
        dy,
      });
      if (isEnPassantable) {
        addSquare({
          squares,
          x: x + dx,
          y: y + dy,
          moveType: MOVE_TYPES.EN_PASSANT,
          capturedPiece,
          captureRequired: true,
        });
      }
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
    const { isCapturable, capturedPiece } = capturable({
      pieces,
      weAreWhite: piece.isWhite,
      fromX: x,
      fromY: y,
      toX,
      toY,
    });
    if (isCapturable) {
      addSquare({
        squares,
        x: toX,
        y: toY,
        moveType: MOVE_TYPES.NORMAL,
        capturedPiece,
      });
    }
    if (empty({ pieces, x: toX, y: toY })) {
      addSquare({ squares, x: toX, y: toY, moveType: MOVE_TYPES.NORMAL });
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

        const { isCapturable, capturedPiece } = capturable({
          pieces,
          weAreWhite: piece.isWhite,
          fromX: x,
          fromY: y,
          toX,
          toY,
        });
        if (isCapturable) {
          addSquare({
            squares,
            x: toX,
            y: toY,
            moveType: MOVE_TYPES.NORMAL,
            capturedPiece,
          });
          break;
        }
        if (isEmpty) {
          addSquare({ squares, x: toX, y: toY, moveType: MOVE_TYPES.NORMAL });
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
      const { isCapturable, capturedPiece } = capturable({
        pieces,
        weAreWhite: piece.isWhite,
        fromX: x,
        fromY: y,
        toX,
        toY,
      });
      if (isCapturable) {
        addSquare({
          squares,
          x: toX,
          y: toY,
          moveType: MOVE_TYPES.NORMAL,
          capturedPiece,
        });
        break;
      }
      if (isEmpty) {
        addSquare({ squares, x: toX, y: toY, moveType: MOVE_TYPES.NORMAL });
      } else {
        break;
      }
      i++;
    }
  }
}

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
      if (spansTwoBoards({ fromX: x, fromY: y, toX, toY })) {
        continue;
      }
      const { isCapturable, capturedPiece } = capturable({
        pieces,
        weAreWhite: piece.isWhite,
        fromX: x,
        fromY: y,
        toX,
        toY,
      });
      if (isCapturable) {
        addSquare({
          squares,
          x: toX,
          y: toY,
          moveType: MOVE_TYPES.NORMAL,
          capturedPiece,
        });
      }
      if (empty({ pieces, x: toX, y: toY })) {
        addSquare({ squares, x: toX, y: toY, moveType: MOVE_TYPES.NORMAL });
      }
    }
  }

  const kingHasMoved = piece.moveCount !== 0;
  if (kingHasMoved) {
    return;
  }

  // handle castling
  for (const moveLeft of [true, false]) {
    const dx = moveLeft ? -2 : 2;
    const toX = x + dx;
    const toY = y;
    const rookDX = moveLeft ? -4 : 3;
    const maybeRookX = x + rookDX;
    if (empty({ pieces, x: maybeRookX, y: toY })) {
      continue;
    }
    const moveDx = moveLeft ? -1 : 1;
    let checkX = x + moveDx;
    let notEmpty = false;
    while (checkX !== maybeRookX) {
      if (!empty({ pieces, x: checkX, y: toY })) {
        notEmpty = true;
        break;
      }
      checkX += moveDx;
    }
    if (notEmpty) {
      continue;
    }
    const maybeRook = pieces.get(pieceKey(maybeRookX, toY));
    const pieceType = TYPE_TO_NAME[maybeRook.type];
    if (pieceType !== "rook") {
      continue;
    }
    if (maybeRook.moveCount !== 0) {
      continue;
    }
    if (maybeRook.isWhite !== piece.isWhite) {
      continue;
    }
    const rookToX = moveLeft ? x - 1 : x + 1;
    const rookToY = toY;
    const additionalMovedPiece = {
      toX: rookToX,
      toY: rookToY,
      piece: maybeRook,
    };
    addSquare({
      squares,
      x: toX,
      y: toY,
      moveType: MOVE_TYPES.CASTLE,
      additionalMovedPiece,
      neverCapturable: true,
    });
  }
}

function boundsCheckMoveableSquares({ squares }) {
  return squares.filter(
    ([x, y, _data]) => x >= 0 && x <= 7999 && y >= 0 && y <= 7999
  );
}

function LieAboutMoveableSquaresAndJustGive2By2Region(piece, squares, pieces) {
  const x = piece.x;
  const y = piece.y;
  for (const dx of [-3, -2, -1, 0, 1, 2, 3]) {
    for (const dy of [-3, -2, -1, 0, 1, 2, 3]) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const { isCapturable, capturedPiece } = capturable({
        pieces,
        weAreWhite: piece.isWhite,
        fromX: x,
        fromY: y,
        toX: x + dx,
        toY: y + dy,
      });
      if (isCapturable) {
        addSquare({
          squares,
          x: x + dx,
          y: y + dy,
          moveType: MOVE_TYPES.NORMAL,
          capturedPiece,
        });
      } else {
        addSquare({
          squares,
          x: x + dx,
          y: y + dy,
          moveType: MOVE_TYPES.NORMAL,
        });
      }
    }
  }
  return squares;
}

const DEBUG_LIE_ABOUT_MOVEABLE_SQUARES = false;
export function getMoveableSquares(piece, pieces) {
  const squares = [];
  const pieceType = piece.type;
  const name = TYPE_TO_NAME[pieceType];

  if (DEBUG_LIE_ABOUT_MOVEABLE_SQUARES) {
    LieAboutMoveableSquaresAndJustGive2By2Region(piece, squares, pieces);
  } else {
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
      case "promotedPawn":
        addMoveableSquaresForBishop({ piece, pieces, squares });
        addMoveableSquaresForRook({ piece, pieces, squares });
        break;
      case "king":
        addMoveableSquaresForKing({ piece, pieces, squares });
        break;
      default:
        break;
    }
  }
  const checked = boundsCheckMoveableSquares({ squares });
  const ret = new Map();
  for (const [x, y, data] of checked) {
    // If we realize that there's actually a piece of the opposite color in
    // this square, could we potentially have accidentally captured it
    // with our optimistic move?
    let couldBeACapture;
    if (data.neverCapturable) {
      couldBeACapture = false;
    } else {
      couldBeACapture = !spansTwoBoards({
        fromX: piece.x,
        fromY: piece.y,
        toX: x,
        toY: y,
      });
    }
    data.couldBeACapture = couldBeACapture;
    ret.set(pieceKey(x, y), data);
  }
  return ret;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function getColorPref() {
  const colorPref = localStorage.getItem("colorPref");
  if (!colorPref) {
    return null;
  }
  if (colorPref !== "white" && colorPref !== "black") {
    return null;
  }
  return colorPref;
}

export function storeColorPref({ playingWhite }) {
  const colorPref = playingWhite ? "white" : "black";
  localStorage.setItem("colorPref", colorPref);
}

export function computeInitialArguments() {
  const url = new URL(window.location.href);
  const hash = url.hash.slice(1);
  const colorPref = getColorPref();
  if (!hash || hash === "") {
    return { x: null, y: null, colorPref };
  }
  try {
    let [x, y] = hash.split(",").map(Number);
    if (isNaN(x) || isNaN(y)) {
      return { x: null, y: null, colorPref };
    }
    x = clamp(x, 0, 7999);
    y = clamp(y, 0, 7999);
    return { x, y, colorPref };
  } catch (e) {
    return { x: null, y: null, colorPref };
  }
}
