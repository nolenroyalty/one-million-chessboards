// Constants
const SQUARE_SIZE = 32; // Size of each chess square in pixels
const BOARD_SIZE = 8; // Number of squares per board
const NUM_BOARDS_X = 10; // Number of boards in X direction (for prototype)
const NUM_BOARDS_Y = 10; // Number of boards in Y direction (for prototype)
const TOTAL_WIDTH = NUM_BOARDS_X * BOARD_SIZE * SQUARE_SIZE;
const TOTAL_HEIGHT = NUM_BOARDS_Y * BOARD_SIZE * SQUARE_SIZE;

// Message types
const STATE_SNAPSHOT = 1;
const MOVE_RESULT = 2;
const ERROR_MESSAGE = 3;

// Game state
let socket = null;
let gameState = {
    pieces: new Map(), // Map of piece ID to piece object
    selectedPiece: null, // Currently selected piece
    isWhitePlayer: true // Default to white (will be set by server)
};

// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Set canvas size to match the total game area
canvas.width = TOTAL_WIDTH;
canvas.height = TOTAL_HEIGHT;

// Initialize panzoom
const panzoom = Panzoom(canvas, {
    maxScale: 2,
    minScale: 0.1,
    startX: -TOTAL_WIDTH / 2 + window.innerWidth / 2,
    startY: -TOTAL_HEIGHT / 2 + window.innerHeight / 2,
    canvas: true
});

// Add mousewheel handling for zoom
document.getElementById('canvas-container').addEventListener('wheel', panzoom.zoomWithWheel);

// UI controls
document.getElementById('zoom-in').addEventListener('click', panzoom.zoomIn);
document.getElementById('zoom-out').addEventListener('click', panzoom.zoomOut);
document.getElementById('reset-view').addEventListener('click', () => panzoom.reset());
document.getElementById('connect').addEventListener('click', connect);
document.getElementById('disconnect').addEventListener('click', disconnect);
document.getElementById('reset-board').addEventListener('click', resetCurrentBoard);

// Set up canvas click handler
canvas.addEventListener('click', handleCanvasClick);

// Connect to WebSocket server
function connect() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        updateStatus('Already connected');
        return;
    }
    
    // Determine WebSocket URL (same host, different protocol)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
        socket = new WebSocket(wsUrl);
        
        socket.binaryType = 'arraybuffer';
        
        socket.onopen = () => {
            updateStatus('Connected to server');
            requestSnapshot();
        };
        
        socket.onmessage = (event) => {
            handleMessage(event.data);
        };
        
        socket.onclose = () => {
            updateStatus('Disconnected from server');
            socket = null;
        };
        
        socket.onerror = (error) => {
            updateStatus(`WebSocket error: ${error}`);
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        updateStatus(`Failed to connect: ${error}`);
        console.error('Connection error:', error);
    }
}

// Disconnect from server
function disconnect() {
    if (socket) {
        socket.close();
        socket = null;
        gameState.pieces.clear();
        gameState.selectedPiece = null;
        updateStatus('Disconnected from server');
        drawBoard();
    }
}

// Request a state snapshot from the server
function requestSnapshot() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        updateStatus('Not connected to server');
        return;
    }
    
    // Create a simple buffer with message type 2 (RequestSnapshot)
    const buffer = new ArrayBuffer(1);
    const view = new Uint8Array(buffer);
    view[0] = 2; // Request snapshot type
    
    socket.send(buffer);
    updateStatus('Requested state snapshot');
}

// Reset the current board
function resetCurrentBoard() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        updateStatus('Not connected to server');
        return;
    }
    
    // Get the current center of the view
    const { x, y } = panzoom.getPan();
    
    // Calculate which board is in the center of the view
    const centerX = Math.floor((-x + window.innerWidth / 2) / (BOARD_SIZE * SQUARE_SIZE));
    const centerY = Math.floor((-y + window.innerHeight / 2) / (BOARD_SIZE * SQUARE_SIZE));
    
    // Ensure the coordinates are within bounds
    const boardX = Math.max(0, Math.min(NUM_BOARDS_X - 1, centerX));
    const boardY = Math.max(0, Math.min(NUM_BOARDS_Y - 1, centerY));
    
    // Create a reset board message (type 3)
    const buffer = new ArrayBuffer(5); // 1 byte type + 2 bytes for X + 2 bytes for Y
    const view = new DataView(buffer);
    view.setUint8(0, 3); // ResetBoard type
    view.setUint16(1, boardX, true); // Board X (little-endian)
    view.setUint16(3, boardY, true); // Board Y (little-endian)
    
    socket.send(buffer);
    updateStatus(`Resetting board at (${boardX}, ${boardY})`);
}

// Handle canvas click
function handleCanvasClick(event) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
    }
    
    // Get click position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const scale = panzoom.getScale();
    const { x: panX, y: panY } = panzoom.getPan();
    
    // Calculate click position in game coordinates
    const gameX = Math.floor((event.clientX - rect.left - panX) / scale / SQUARE_SIZE);
    const gameY = Math.floor((event.clientY - rect.top - panY) / scale / SQUARE_SIZE);
    
    // Check bounds
    if (gameX < 0 || gameX >= NUM_BOARDS_X * BOARD_SIZE || 
        gameY < 0 || gameY >= NUM_BOARDS_Y * BOARD_SIZE) {
        return;
    }
    
    // Check if there's a piece at this position
    let clickedPiece = null;
    for (const piece of gameState.pieces.values()) {
        if (piece.x === gameX && piece.y === gameY) {
            clickedPiece = piece;
            break;
        }
    }
    
    if (clickedPiece) {
        // If we click on our own piece, select it
        if ((clickedPiece.isWhite && gameState.isWhitePlayer) || 
            (!clickedPiece.isWhite && !gameState.isWhitePlayer)) {
            gameState.selectedPiece = clickedPiece;
            drawBoard(); // Redraw to show selection
            updateStatus(`Selected ${getPieceName(clickedPiece)} at (${gameX}, ${gameY})`);
        } else if (gameState.selectedPiece) {
            // If we already have a piece selected and click an opponent's piece, try to capture
            movePiece(gameState.selectedPiece, gameX, gameY);
        }
    } else if (gameState.selectedPiece) {
        // If we have a piece selected and click an empty square, try to move there
        movePiece(gameState.selectedPiece, gameX, gameY);
    }
}

// Move a piece
function movePiece(piece, toX, toY) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
    }
    
    // Create a move piece message (type 1)
    const buffer = new ArrayBuffer(17); // 1 byte type + 8 bytes ID + 2 bytes for each coordinate
    const view = new DataView(buffer);
    view.setUint8(0, 1); // MovePiece type
    
    // Set piece ID (64-bit integer)
    const idLow = Number(piece.id & BigInt(0xFFFFFFFF));
    const idHigh = Number(piece.id >> BigInt(32));
    view.setUint32(1, idLow, true);
    view.setUint32(5, idHigh, true);
    
    // Set from/to coordinates
    view.setUint16(9, piece.x, true);
    view.setUint16(11, piece.y, true);
    view.setUint16(13, toX, true);
    view.setUint16(15, toY, true);
    
    socket.send(buffer);
    updateStatus(`Moving ${getPieceName(piece)} from (${piece.x}, ${piece.y}) to (${toX}, ${toY})`);
    
    // Clear selection
    gameState.selectedPiece = null;
}

// Handle incoming messages
function handleMessage(data) {
    if (!data || data.byteLength < 1) {
        console.error('Received empty message');
        return;
    }
    
    const view = new DataView(data);
    const messageType = view.getUint8(0);
    
    switch (messageType) {
        case STATE_SNAPSHOT:
            handleStateSnapshot(data);
            break;
        case MOVE_RESULT:
            handleMoveResult(data);
            break;
        case ERROR_MESSAGE:
            handleErrorMessage(data);
            break;
        default:
            console.error(`Unknown message type: ${messageType}`);
    }
}

// Handle state snapshot message
function handleStateSnapshot(data) {
    const view = new DataView(data);
    
    // Extract timestamp (not used for now)
    const timestamp = view.getBigUint64(1, true);
    
    // Extract piece count
    const pieceCount = view.getUint16(9, true);
    
    // Clear current pieces
    gameState.pieces.clear();
    
    // Parse each piece
    let offset = 11;
    for (let i = 0; i < pieceCount; i++) {
        // Extract piece data
        const idLow = view.getUint32(offset, true);
        const idHigh = view.getUint32(offset + 4, true);
        const id = (BigInt(idHigh) << BigInt(32)) | BigInt(idLow);
        
        const x = view.getUint16(offset + 8, true);
        const y = view.getUint16(offset + 10, true);
        const type = view.getUint8(offset + 12);
        const isWhite = view.getUint8(offset + 13) === 1;
        const moveState = view.getUint8(offset + 14);
        
        // Add piece to game state
        gameState.pieces.set(id, {
            id,
            x,
            y,
            type,
            isWhite,
            moveState
        });
        
        offset += 15;
    }
    
    // Redraw the board
    drawBoard();
    updateStatus(`Received state snapshot: ${pieceCount} pieces`);
}

// Handle move result message
function handleMoveResult(data) {
    const view = new DataView(data);
    
    // Extract timestamp (not used for now)
    const timestamp = view.getBigUint64(1, true);
    
    // Extract piece ID
    const idLow = view.getUint32(9, true);
    const idHigh = view.getUint32(9 + 4, true);
    const pieceId = (BigInt(idHigh) << BigInt(32)) | BigInt(idLow);
    
    // Extract move data
    const fromX = view.getUint16(17, true);
    const fromY = view.getUint16(19, true);
    const toX = view.getUint16(21, true);
    const toY = view.getUint16(23, true);
    const success = view.getUint8(25) === 1;
    
    // If success, we already got the updated state, no need to do anything
    // Redraw the board
    drawBoard();
    
    if (success) {
        updateStatus(`Move successful: (${fromX}, ${fromY}) to (${toX}, ${toY})`);
    } else {
        updateStatus(`Move failed: (${fromX}, ${fromY}) to (${toX}, ${toY})`);
    }
}
