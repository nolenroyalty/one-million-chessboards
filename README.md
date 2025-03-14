# One Million Chessboards

A massively multiplayer chess game featuring a 1000×1000 grid of chess boards (one million total) where players can interact with boards in a collaborative environment.

## Prototype

This is a simplified prototype implementation that includes:

- A 10×10 grid of chess boards (100 total)
- Basic WebSocket communication
- Simple binary protocol for messaging
- Piece movement and board reset functionality

## Running the Server

### Prerequisites

- Go 1.19 or higher

### Setup and Run

1. Clone the repository:

```bash
git clone https://github.com/yourusername/one-million-chessboards.git
cd one-million-chessboards
```

2. Build and run the server:

```bash
go build -o chessserver ./cmd/server
./chessserver
```

3. Optional server flags:

```
-addr string
    HTTP service address (default ":8080")
-static string
    Directory for static files (default "./static")
-boardsX uint
    Number of boards in X direction (default 10)
-boardsY uint
    Number of boards in Y direction (default 10)
```

4. Access the web client by opening a browser and navigating to:

```
http://localhost:8080
```

## Client Usage

The web client provides a simple interface to interact with the chess boards:

- **Pan**: Click and drag to move around the board grid
- **Zoom**: Use the mouse wheel or zoom buttons to zoom in/out
- **Move Pieces**: Click on a piece to select it, then click on a destination square
- **Reset Board**: Navigate to a board and click the "Reset Current Board" button

## Binary Protocol

The server and client communicate using a simple binary protocol:

- **Client to Server**:
  - Move Piece (type 1)
  - Request Snapshot (type 2)
  - Reset Board (type 3)

- **Server to Client**:
  - State Snapshot (type 1)
  - Move Result (type 2)
  - Error (type 3)

## Project Structure

```
one-million-chessboards/
├── cmd/
│   └── server/
│       └── main.go              # Server entry point
├── internal/
│   ├── game/
│   │   ├── board.go             # Game state and board logic
│   │   ├── piece.go             # Chess piece representation
│   │   └── move.go              # Move validation
│   ├── server/
│   │   ├── server.go            # WebSocket server
│   │   ├── client.go            # Client connection handling
│   │   └── handler.go           # Message handling
│   └── proto/
│       └── messages.proto       # Protocol buffer definitions
├── static/
│   ├── index.html               # Web client UI
│   └── js/
│       └── client.js            # Client-side logic
├── go.mod                       # Go module file
└── README.md                    # This file
```

## Future Improvements

- Full implementation of the 1000×1000 board grid
- Complete chess move validation
- Proper error handling and rate limiting
- Subscription-based updates for viewport-based rendering
- Optimizations for large-scale deployments
