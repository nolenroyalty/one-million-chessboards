package server

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
)

/*
1. Duplicate board. It's not worth the trouble of re-implementing the logic; doing things
   this way will make sure we handle everything
2. Make sure that we don't use our loggers in persistent board
3. We need to serialize move, adoption, and bulk capture requests in sequence
4. If we're going to replay moves over a snapshot, we'll need to know the
   sequence number of the move. there's a very clear off-by-one error that you
   need to think super carefully about - think that through!
5. Taking a snapshot of the board is actually quite cheap, not a crazy amount of time.
   It's actually probably easier to just take a snapshot every N seconds and add a shutdown
   handler that also takes a snapshot?
6. Then we can still log our move stream in a nice format for later debugging, but it
   lets us avoid the complexity of replaying moves on startup, which I think might
   actually be worth a lot
7. Looks like board snapshots take 4 seconds to save with minimal load, so we should
   make some choices that optimize for speeding that up over minimizing the size, probably
   (assuming that we eat a lot of core while we save it...)
8. Actually, if we just serialize our slice directly (is that safe?) it's 4 times faster.
9. We should trade disk for speed though. We can write out a gig a minute (2 snaps a minute)
   and clear them out regularly with a cron job (sweep a few to another box, etc) - it's
   really not a big deal
10. shutdown handler should write state to disk
*/

// We need to run these through a single channel because otherwise we won't
// know what order they were applied in on the main channel. Hopefully this
// doesn't matter much, but you never know.
type boardToDiskRequest struct {
	Move               *Move
	AdoptionRequest    *adoptionRequest
	BulkCaptureRequest *bulkCaptureRequest
}

func (btd *BoardToDiskHandler) AddMove(move *Move) {
	btd.requests <- boardToDiskRequest{
		Move: move,
	}
}

func (btd *BoardToDiskHandler) AddAdoption(adoptionRequest *adoptionRequest) {
	btd.requests <- boardToDiskRequest{
		AdoptionRequest: adoptionRequest,
	}
}

func (btd *BoardToDiskHandler) AddBulkCapture(bulkCaptureRequest *bulkCaptureRequest) {
	btd.requests <- boardToDiskRequest{
		BulkCaptureRequest: bulkCaptureRequest,
	}
}

type PieceAndCoords struct {
	Piece  EncodedPiece
	Coords uint32
}

func encodeCoords(x, y uint16) uint32 {
	return uint32(x)<<16 | uint32(y)
}

func decodeCoords(coords uint32) (x uint16, y uint16) {
	x = uint16(coords >> 16)
	y = uint16(coords & 0xFFFF)
	return
}

type BoardToDiskHandler struct {
	board    *Board
	requests chan boardToDiskRequest
	stateDir string
	done     chan struct{}
}

type SnapshotHeader struct {
	NextID              uint32
	SeqNum              uint64
	TotalMoves          uint64
	WhitePiecesCaptured uint32
	BlackPiecesCaptured uint32
	WhiteKingsCaptured  uint32
	BlackKingsCaptured  uint32
	PieceCount          uint32
}

type Snapshot struct {
	Header          SnapshotHeader
	PiecesAndCoords []PieceAndCoords
}

// CR nroyalty: we could pool this but we'd need to be careful to zero out
// piecesAndCoords whenever we retrieve from the pool!
func (btd *BoardToDiskHandler) getSnapshot() (snapshot *Snapshot) {
	start := time.Now()
	header := SnapshotHeader{
		NextID:              btd.board.nextID,
		SeqNum:              btd.board.seqNum,
		TotalMoves:          btd.board.totalMoves.Load(),
		WhitePiecesCaptured: btd.board.whitePiecesCaptured.Load(),
		BlackPiecesCaptured: btd.board.blackPiecesCaptured.Load(),
		WhiteKingsCaptured:  btd.board.whiteKingsCaptured.Load(),
		BlackKingsCaptured:  btd.board.blackKingsCaptured.Load(),
		PieceCount:          0,
	}
	probableSize := BOARD_SIZE * BOARD_SIZE / 2
	probableSize -= int(header.WhitePiecesCaptured)
	probableSize -= int(header.BlackPiecesCaptured)
	if probableSize < 0 {
		log.Printf("PROBABLE SIZE BELOW 0? %d", probableSize)
		probableSize = 0
	}

	snapshot = &Snapshot{
		Header:          header,
		PiecesAndCoords: make([]PieceAndCoords, 0, probableSize),
	}

	actualSize := 0

	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			raw := EncodedPiece(btd.board.pieces[y][x])
			if raw == EmptyEncodedPiece {
				continue
			}
			actualSize += 1
			snapshot.PiecesAndCoords = append(snapshot.PiecesAndCoords, PieceAndCoords{
				Piece:  raw,
				Coords: encodeCoords(x, y),
			})
		}
	}
	if probableSize != actualSize {
		log.Printf("PROBABLE SIZE IS NOT ACTUAL SIZE? probable %d actual %d", probableSize, actualSize)
	}
	snapshot.Header.PieceCount = uint32(actualSize)
	elapsed := time.Since(start)
	log.Printf("Time taken to get full-board snapshot: %s", elapsed)
	return
}

func (btd *BoardToDiskHandler) saveToFile(s *Snapshot) error {
	now := time.Now()
	name := fmt.Sprintf("board-ts:%d-seq:%d.bin", now.UnixNano(), s.Header.SeqNum)
	filename := filepath.Join(btd.stateDir, name)
	err := WriteFileAtomic(filename, func(writer io.Writer) error {
		buf := bufio.NewWriterSize(writer, 128*1024*1024)
		ie := binary.Write(buf, binary.LittleEndian, &s.Header)
		if ie != nil {
			return ie
		}
		ie = binary.Write(buf, binary.LittleEndian, s.PiecesAndCoords)
		if ie != nil {
			return ie
		}
		return buf.Flush()
	})
	if err != nil {
		// CR nroyalty: use logger here
		log.Printf("ERROR writing board snapshot to file %s: %v", filename, err)
		return err
	}
	elapsed := time.Since(now)
	log.Printf("Time taken to save board snapshot: %s", elapsed)
	return nil
}

func (s *Snapshot) initializeFromFile(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()
	reader := bufio.NewReaderSize(file, 128*1024*1024)
	err = binary.Read(reader, binary.LittleEndian, &s.Header)
	if err != nil {
		return err
	}
	s.PiecesAndCoords = make([]PieceAndCoords, s.Header.PieceCount)
	err = binary.Read(reader, binary.LittleEndian, &s.PiecesAndCoords)
	return err
}

func (btd *BoardToDiskHandler) initializeFromFile(filename string) error {
	snapshot := &Snapshot{}
	err := snapshot.initializeFromFile(filename)
	if err != nil {
		return err
	}
	btd.board.nextID = snapshot.Header.NextID
	btd.board.seqNum = snapshot.Header.SeqNum
	btd.board.totalMoves.Store(snapshot.Header.TotalMoves)
	btd.board.whitePiecesCaptured.Store(snapshot.Header.WhitePiecesCaptured)
	btd.board.blackPiecesCaptured.Store(snapshot.Header.BlackPiecesCaptured)
	btd.board.whiteKingsCaptured.Store(snapshot.Header.WhiteKingsCaptured)
	btd.board.blackKingsCaptured.Store(snapshot.Header.BlackKingsCaptured)
	log.Printf("number of pieces at load: %d", len(snapshot.PiecesAndCoords))
	for _, pc := range snapshot.PiecesAndCoords {
		x, y := decodeCoords(pc.Coords)
		btd.board.pieces[y][x] = uint64(pc.Piece)
	}
	return nil
}

func extractTSFromSnapshotFilename(path string) (timestamp int64, err error) {
	name := filepath.Base(path)
	withoutExt := strings.TrimSuffix(name, ".bin")
	parts := strings.Split(withoutExt, "-")
	if len(parts) < 3 {
		err = fmt.Errorf("wrong number of parts: %s", path)
		return
	}
	prefix := parts[0]
	ts := parts[1]
	seq := parts[2]
	if prefix != "board" || !strings.HasPrefix(ts, "ts:") || !strings.HasPrefix(seq, "seq:") {
		err = fmt.Errorf("Unexpected format: %s", path)
		return
	}
	timestampString := strings.TrimPrefix(ts, "ts:")
	timestamp, err = strconv.ParseInt(timestampString, 10, 64)
	return
}

func (btd *BoardToDiskHandler) SortedSnapshotFilenames() (file *string, err error) {
	glob := filepath.Join(btd.stateDir, "board-*.bin")
	files, err := filepath.Glob(glob)
	if err != nil || len(files) == 0 {
		return
	}
	type FileWithTimestamp struct {
		File      string
		Timestamp int64
	}
	fileWithTimestamps := make([]FileWithTimestamp, 0, len(files))
	for _, f := range files {
		ts, err := extractTSFromSnapshotFilename(f)
		if err != nil {
			log.Printf("ERROR? Could not extract ts from snapshot file: %v", err)
			continue
		}
		fileWithTimestamps = append(fileWithTimestamps, FileWithTimestamp{
			File:      f,
			Timestamp: ts,
		})
	}
	if len(fileWithTimestamps) == 0 {
		return
	}
	slices.SortFunc(fileWithTimestamps, func(i, j FileWithTimestamp) int {
		return int(i.Timestamp - j.Timestamp)
	})
	last := fileWithTimestamps[len(fileWithTimestamps)-1]
	file = &last.File
	return
}

func NewBoardToDiskHandler(stateDir string) (*BoardToDiskHandler, error) {
	btd := &BoardToDiskHandler{
		stateDir: stateDir,
		requests: make(chan boardToDiskRequest, 16384),
		done:     make(chan struct{}, 1),
		board:    NewBoard(false),
	}
	lastFile, err := btd.SortedSnapshotFilenames()
	if err != nil {
		return nil, err
	}
	if lastFile == nil {
		log.Printf("No snapshot filenames found - initializing new board")
		btd.board.InitializeRandom()
		snap := btd.getSnapshot()
		btd.saveToFile(snap)
	} else {
		log.Printf("Initializing from file %s", *lastFile)
		err = btd.initializeFromFile(*lastFile)
		if err != nil {
			return nil, err
		}
	}
	return btd, nil
}

func (btd *BoardToDiskHandler) GetLiveBoard() *Board {
	now := time.Now()
	board := NewBoard(true)
	board.nextID = btd.board.nextID
	board.seqNum = btd.board.seqNum
	board.totalMoves.Store(btd.board.totalMoves.Load())
	board.whitePiecesCaptured.Store(btd.board.whitePiecesCaptured.Load())
	board.blackPiecesCaptured.Store(btd.board.blackPiecesCaptured.Load())
	board.whiteKingsCaptured.Store(btd.board.whiteKingsCaptured.Load())
	board.blackKingsCaptured.Store(btd.board.blackKingsCaptured.Load())
	board.pieces = btd.board.pieces
	duration := time.Since(now)
	log.Printf("Time to get live board: %s", duration)
	return board
}

func (btd *BoardToDiskHandler) panicWithContext(context string) {
	log.Printf("!!PANICKING IN PERSISTENT BOARD!!")
	log.Printf("CURRENT SEQNUM: %d", btd.board.seqNum)
	log.Printf("PANIC CONTEXT: %s", context)
	panic(context)
}

func (btd *BoardToDiskHandler) apply(req boardToDiskRequest) {
	switch {
	case req.Move != nil:
		res := btd.board.ValidateAndApplyMove__NOTTHREADSAFE(*req.Move)
		if !res.Valid {
			context := fmt.Sprintf("Applied invalid move %v", *req.Move)
			btd.panicWithContext(context)
		}
	case req.AdoptionRequest != nil:
		_, err := btd.board.Adopt(req.AdoptionRequest)
		if err != nil {
			context := fmt.Sprintf("Received invalid adoption req %v", req.AdoptionRequest)
			btd.panicWithContext(context)
		}
	case req.BulkCaptureRequest != nil:
		_, err := btd.board.DoBulkCapture(req.BulkCaptureRequest)
		if err != nil {
			context := fmt.Sprintf("Received invalid bulk capture req %v", req.BulkCaptureRequest)
			btd.panicWithContext(context)
		}

	}
}

const BOARD_SERIALIZATION_INTERVAL = time.Second * 30
const MOVE_SERIALIZATION_INTERVAL = time.Second * 5

func (btd *BoardToDiskHandler) RunForever() {
	t := time.NewTicker(BOARD_SERIALIZATION_INTERVAL)
	for {
		select {
		case req := <-btd.requests:
			btd.apply(req)
		case <-t.C:
			snap := btd.getSnapshot()
			go func() {
				btd.saveToFile(snap)
			}()
		case <-btd.done:
			log.Printf("Ending BTD loop")
			return
		}
	}
}
