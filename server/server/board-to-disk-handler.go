package server

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/gob"
	"flag"
	"fmt"
	"io"
	"log"
	"one-million-chessboards/protocol"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

const (
	BOARD_SERIALIZATION_INTERVAL = time.Second * 127
	MOVE_SERIALIZATION_INTERVAL  = time.Second * 10
	MAX_MOVES_TO_SERIALIZE       = 5000
)

var doNotSaveState = flag.Bool("do-not-save-state", false, "Don't save state to disk")

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
	board               *Board
	requests            chan boardToDiskRequest
	stateDir            string
	done                chan struct{}
	requestsToSerialize []boardToDiskRequest
	logger              zerolog.Logger
	ctx                 context.Context
	cancel              context.CancelFunc
	wg                  *sync.WaitGroup
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

// CR-someday nroyalty: we could pool this but we'd need to be careful to zero out
// piecesAndCoords whenever we retrieve from the pool! Given that we do this
// infrequently, it's probably not worth the complexity and I suspect it would
// be gc'd anyway..
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
		btd.logger.Error().Str("error_kind", "probable_size_below_0").Int("probable_size", probableSize).Send()
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
		btd.logger.Error().Str("error_kind", "probable_size_is_not_actual_size").Int("probable", probableSize).Int("actual", actualSize).Send()
		log.Printf("PROBABLE SIZE IS NOT ACTUAL SIZE? probable %d actual %d", probableSize, actualSize)
	}
	snapshot.Header.PieceCount = uint32(actualSize)
	elapsed := time.Since(start)
	btd.logger.Info().Int64("get_full_board_snapshot_ms", elapsed.Milliseconds()).Send()
	return
}

func (btd *BoardToDiskHandler) saveToFile(s *Snapshot) error {
	if *doNotSaveState {
		return nil
	}

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
		btd.logger.Error().Str("error_kind", "writing_to_file").AnErr("err", err).Send()
		log.Printf("ERROR writing board snapshot to file %s: %v", filename, err)
		return err
	}
	elapsed := time.Since(now)
	btd.logger.Info().Int64("save_board_snapshot_ms", elapsed.Milliseconds()).Send()
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
	gob.Register(Move{})
	gob.Register(adoptionRequest{})
	gob.Register(bulkCaptureRequest{})
	gob.Register(boardToDiskRequest{})
	ctx, cancel := context.WithCancel(context.Background())
	wg := &sync.WaitGroup{}

	btd := &BoardToDiskHandler{
		stateDir:            stateDir,
		requests:            make(chan boardToDiskRequest, 16384),
		done:                make(chan struct{}, 1),
		board:               NewBoard(false),
		requestsToSerialize: make([]boardToDiskRequest, 0, MAX_MOVES_TO_SERIALIZE),
		logger:              NewCoreLogger().With().Str("kind", "btd-handler").Logger(),
		ctx:                 ctx,
		cancel:              cancel,
		wg:                  wg,
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

func (req boardToDiskRequest) ToString() string {
	switch {
	case req.Move != nil:
		return req.Move.ToString()
	case req.AdoptionRequest != nil:
		return req.AdoptionRequest.ToString()
	case req.BulkCaptureRequest != nil:
		return req.BulkCaptureRequest.ToString()
	default:
		return fmt.Sprintf("UNKNOWN REQ: %v", req)
	}
}

func (btd *BoardToDiskHandler) panicWithContext(context string, req boardToDiskRequest) {
	log.Printf("!!PANICKING IN PERSISTENT BOARD!!")
	log.Printf("CURRENT SEQNUM: %d", btd.board.seqNum)
	log.Printf("PANIC CONTEXT: %s", context)
	btd.logger.Fatal().
		Str("action", "btd_panic_with_context").
		Str("context", context).
		Str("req", req.ToString()).
		Str("seqnum", fmt.Sprintf("%d", btd.board.seqNum)).
		Str("total_moves", fmt.Sprintf("%d", btd.board.totalMoves.Load())).
		Send()
	panic(context)
}

func (btd *BoardToDiskHandler) apply(req boardToDiskRequest) {
	switch {
	case req.Move != nil:
		res := btd.board.ValidateAndApplyMove__NOTTHREADSAFE(*req.Move)
		if !res.Valid {
			context := fmt.Sprintf("Applied invalid move %s", req.Move.ToString())
			btd.panicWithContext(context, req)
		}
	case req.AdoptionRequest != nil:
		_, err := btd.board.Adopt(req.AdoptionRequest)
		if err != nil {
			context := fmt.Sprintf("Received invalid adoption req %s", req.AdoptionRequest.ToString())
			btd.panicWithContext(context, req)
		}
	case req.BulkCaptureRequest != nil:
		_, err := btd.board.DoBulkCapture(req.BulkCaptureRequest)
		if err != nil {
			context := fmt.Sprintf("Received invalid bulk capture req %s", req.BulkCaptureRequest.ToString())
			btd.panicWithContext(context, req)
		}
	default:
		btd.logger.Error().Str("error_kind", "unrecognized_req").Str("req", req.ToString()).Send()
	}
}

func writeRequestsToDisk(
	path string,
	toWrite []boardToDiskRequest,
	firstSeqnum uint64,
	lastSeqnum uint64,
) error {
	if *doNotSaveState {
		return nil
	}
	return WriteFileAtomic(path, func(writer io.Writer) error {
		buf := bufio.NewWriterSize(writer, 2*1024*1024)
		enc := gob.NewEncoder(buf)
		err := enc.Encode(toWrite)
		if err != nil {
			return err
		}
		enc.Encode(toWrite)
		return buf.Flush()
	})
}

func ReadAndPrintRequestsFromFile(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()
	reader := bufio.NewReaderSize(file, 4*1024*1024)
	dec := gob.NewDecoder(reader)
	requests := make([]boardToDiskRequest, 0, 128)
	err = dec.Decode(&requests)
	if err != nil {
		return err
	}
	for _, req := range requests {
		s := ""
		switch {
		case req.Move != nil:
			s = req.Move.ToString()
		case req.AdoptionRequest != nil:
			s = req.AdoptionRequest.ToString()
		case req.BulkCaptureRequest != nil:
			s = req.BulkCaptureRequest.ToString()
		default:
			s = fmt.Sprintf("UNKNOWN REQ: %v", req)
		}
		fmt.Println(s)
	}
	return nil
}

type PieceWithCount struct {
	Piece Piece
	Count uint16
}

type PieceWithLocation struct {
	Piece Piece
	X     uint16
	Y     uint16
}

func PrintLivePieceStats(stateDir string) error {
	btd, err := NewBoardToDiskHandler(stateDir)
	if err != nil {
		return err
	}
	mostCaptures := make(map[protocol.PieceType]PieceWithCount)
	mostMoves := make(map[protocol.PieceType]PieceWithCount)
	selfHatingPieces := make([]PieceWithLocation, 0, 0)
	fmt.Printf("Board size: %d\n", BOARD_SIZE)
	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			piece := btd.board.pieces[y][x]
			pieceData := PieceOfEncodedPiece(EncodedPiece(piece))
			if pieceData.IsEmpty() {
				continue
			}
			captureData, exists := mostCaptures[pieceData.Type]
			if !exists {
				captureData = PieceWithCount{
					Piece: pieceData,
					Count: pieceData.CaptureCount,
				}
				mostCaptures[pieceData.Type] = captureData
			} else if pieceData.CaptureCount > captureData.Count {
				captureData = PieceWithCount{
					Piece: pieceData,
					Count: pieceData.CaptureCount,
				}
				mostCaptures[pieceData.Type] = captureData
			}
			movesData, exists := mostMoves[pieceData.Type]
			if !exists {
				movesData = PieceWithCount{
					Piece: pieceData,
					Count: pieceData.MoveCount,
				}
				mostMoves[pieceData.Type] = movesData
			} else if pieceData.MoveCount > movesData.Count {
				movesData = PieceWithCount{
					Piece: pieceData,
					Count: pieceData.MoveCount,
				}
				mostMoves[pieceData.Type] = movesData
			}
			captureCount := pieceData.CaptureCount
			if captureCount >= 10 && !pieceData.HasCapturedPieceTypeOtherThanOwn {
				selfHatingPieces = append(selfHatingPieces, PieceWithLocation{
					Piece: pieceData,
					X:     x,
					Y:     y,
				})
			}
		}
	}
	fmt.Printf("Most moves: %d\n", len(mostMoves))
	fmt.Printf("Most captures: %d\n", len(mostCaptures))
	for _, moveData := range mostMoves {
		fmt.Printf("Piece: %s, ID: %d, Moves: %d\n", moveData.Piece.Type, moveData.Piece.ID, moveData.Count)
	}
	for _, captureData := range mostCaptures {
		fmt.Printf("Piece: %s, ID: %d, Captures: %d\n", captureData.Piece.Type, captureData.Piece.ID, captureData.Count)
	}
	for _, piece := range selfHatingPieces {
		fmt.Printf("Self-hating piece: %s (%d, %d), ID: %d, Captures: %d\n", piece.Piece.Type, piece.X, piece.Y, piece.Piece.ID, piece.Piece.CaptureCount)
	}
	return nil
}

func (btd *BoardToDiskHandler) maybeSerializeCurrentRequests(blocking bool) error {
	if len(btd.requestsToSerialize) == 0 {
		return nil
	}
	toWrite := make([]boardToDiskRequest, len(btd.requestsToSerialize))
	copy(toWrite, btd.requestsToSerialize)
	btd.requestsToSerialize = btd.requestsToSerialize[:0]
	firstSeqnum := btd.board.seqNum
	lastSeqnum := firstSeqnum + uint64(len(toWrite))
	now := time.Now()
	name := fmt.Sprintf("moves-ts:%d-startseq:%d-endseq:%d.bin", now.UnixNano(), firstSeqnum, lastSeqnum)
	path := filepath.Join(btd.stateDir, name)
	if blocking {
		return writeRequestsToDisk(path, toWrite, firstSeqnum, lastSeqnum)
	} else {
		go func() {
			err := writeRequestsToDisk(path, toWrite, firstSeqnum, lastSeqnum)
			if err != nil {
				btd.logger.Error().Str("error_kind", "writing_moves_to_disk").AnErr("err", err).Send()
				log.Printf("ERROR WRITING MOVES %v", err)
			}
		}()
		return nil
	}
}

func (btd *BoardToDiskHandler) drainRequests() {
	for {
		select {
		case req := <-btd.requests:
			btd.apply(req)
			btd.requestsToSerialize = append(btd.requestsToSerialize, req)
		default:
			return
		}
	}
}

func (btd *BoardToDiskHandler) GracefulShutdown() {
	log.Printf("BTD: Beginning graceful shutdown")
	btd.cancel()
	log.Printf("BTD: Waiting for jobs to finish")
	btd.wg.Wait()
	log.Printf("BTD: Jobs finished, flushing queue")
	btd.drainRequests()
	log.Printf("Queue flushed, serializing %d requests", len(btd.requestsToSerialize))
	btd.maybeSerializeCurrentRequests(true)
	log.Printf("BTD: Getting snapshot")
	snap := btd.getSnapshot()
	log.Printf("BTD: Saving snapshot")
	btd.saveToFile(snap)
	log.Printf("BTD: Shutdown complete")
}

func (btd *BoardToDiskHandler) RunForever() {
	boardSerializationTicker := time.NewTicker(BOARD_SERIALIZATION_INTERVAL)
	requestSerializationTicker := time.NewTicker(MOVE_SERIALIZATION_INTERVAL)
	btd.wg.Add(1)
	defer btd.wg.Done()

	for {
		select {
		case <-btd.ctx.Done():
			return
		case req := <-btd.requests:
			btd.apply(req)
			btd.requestsToSerialize = append(btd.requestsToSerialize, req)
			if len(btd.requestsToSerialize) > MAX_MOVES_TO_SERIALIZE {
				btd.logger.Info().Str("action", "serialize_early").Send()
				btd.maybeSerializeCurrentRequests(false)
			}
		case <-boardSerializationTicker.C:
			snap := btd.getSnapshot()
			go func() {
				btd.saveToFile(snap)
			}()
		case <-requestSerializationTicker.C:
			btd.maybeSerializeCurrentRequests(false)
		case <-btd.done:
			log.Printf("Ending BTD loop")
			return
		}
	}
}
