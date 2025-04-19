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
	"sync/atomic"
	"time"
)

// CR nroyalty: we're gonna want to rework this now that we've finalized our
// board setup.

const (
	snapshotInterval      = time.Second * 600
	moveSerializeInterval = time.Second * 5
	maxMovesToSerialize   = 2500
	snapshotPrefix        = "board"
	movePrefix            = "moves"
	suffix                = ".bin"
	// CR nroyalty: un-disable!
	disabled = true
)

type PersistentBoard struct {
	board                  *Board
	movesToApply           chan Move
	stateDir               string
	movesToSerializeBuffer []Move
	lastSerializedSeqnum   atomic.Uint64
}

type PieceWithCoords struct {
	RawPiece EncodedPiece
	Coords   uint32
}

type BoardHeader struct {
	NextID              uint32
	Seqnum              uint64
	TotalMoves          uint64
	WhitePiecesCaptured uint32
	BlackPiecesCaptured uint32
	WhiteKingsCaptured  uint32
	BlackKingsCaptured  uint32
}

type BoardSnapshot struct {
	NextID              uint32
	Seqnum              uint64
	TotalMoves          uint64
	WhitePiecesCaptured uint32
	BlackPiecesCaptured uint32
	WhiteKingsCaptured  uint32
	BlackKingsCaptured  uint32
	PiecesWithCoords    []PieceWithCoords
}

type FileWithSeqnumAndTimestamp struct {
	prefix        string
	lastSeqnum    uint64
	timestampNano int64
}

func (f *FileWithSeqnumAndTimestamp) toFilename() string {
	return fmt.Sprintf("%s-%d-%d.bin", f.prefix, f.lastSeqnum, f.timestampNano)
}

func (f *FileWithSeqnumAndTimestamp) ofFilename(filename string, expectedPrefix string) error {
	withoutExt := strings.TrimSuffix(filepath.Base(filename), ".bin")
	parts := strings.Split(withoutExt, "-")

	if len(parts) < 3 {
		return fmt.Errorf("invalid filename: %s", filename)
	}
	prefix := parts[0]
	if prefix != expectedPrefix {
		return fmt.Errorf("invalid prefix: %s", prefix)
	}
	seqNum := parts[1]
	seqNumInt, err := strconv.ParseUint(seqNum, 10, 64)
	if err != nil {
		log.Printf("Error parsing seqNum: %v", err)
		return err
	}
	timestampNano := parts[2]
	timestampNanoInt, err := strconv.ParseInt(timestampNano, 10, 64)
	if err != nil {
		log.Printf("Error parsing timestampNano: %v", err)
		return err
	}
	f.prefix = prefix
	f.lastSeqnum = seqNumInt
	f.timestampNano = timestampNanoInt
	return nil
}

func (b *Board) GetBoardSnapshot() BoardSnapshot {
	start := time.Now()
	snapshot := BoardSnapshot{
		NextID:              b.nextID,
		Seqnum:              b.seqNum,
		TotalMoves:          b.totalMoves.Load(),
		WhitePiecesCaptured: b.whitePiecesCaptured.Load(),
		BlackPiecesCaptured: b.blackPiecesCaptured.Load(),
		WhiteKingsCaptured:  b.whiteKingsCaptured.Load(),
		BlackKingsCaptured:  b.blackKingsCaptured.Load(),
		PiecesWithCoords:    make([]PieceWithCoords, 0, BOARD_SIZE*BOARD_SIZE),
	}
	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			raw := b.pieces[y][x]
			if raw != uint64(EmptyEncodedPiece) {
				snapshot.PiecesWithCoords = append(snapshot.PiecesWithCoords, PieceWithCoords{
					RawPiece: EncodedPiece(raw),
					Coords:   uint32(x)<<16 | uint32(y),
				})
			}
		}
	}
	elapsed := time.Since(start)
	log.Printf("Time taken to get board snapshot: %s", elapsed)
	return snapshot
}

func (s *BoardSnapshot) SaveToFile(stateDir string, baseFilename string, seqNum uint64) error {
	start := time.Now()
	timestampNano := time.Now().UnixNano()
	mf := FileWithSeqnumAndTimestamp{prefix: baseFilename, lastSeqnum: seqNum, timestampNano: timestampNano}
	filename := filepath.Join(stateDir, mf.toFilename())

	err := WriteFileAtomic(filename, func(writer io.Writer) error {
		header := BoardHeader{
			NextID:              s.NextID,
			Seqnum:              s.Seqnum,
			TotalMoves:          s.TotalMoves,
			WhitePiecesCaptured: s.WhitePiecesCaptured,
			BlackPiecesCaptured: s.BlackPiecesCaptured,
			WhiteKingsCaptured:  s.WhiteKingsCaptured,
			BlackKingsCaptured:  s.BlackKingsCaptured,
		}
		bufferedWriter := bufio.NewWriterSize(writer, 8*1024*1024)
		binary.Write(bufferedWriter, binary.LittleEndian, header)
		for i := range s.PiecesWithCoords {
			binary.Write(bufferedWriter, binary.LittleEndian, s.PiecesWithCoords[i])
		}
		return bufferedWriter.Flush()
	})

	if err != nil {
		log.Printf("Error writing board snapshot to file %s: %v", filename, err)
		return err
	}
	elapsed := time.Since(start)
	log.Printf("Time taken to save board snapshot: %s", elapsed)
	return nil
}

func (b *Board) LoadFromSnapshotFile(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	header := BoardHeader{}
	reader := bufio.NewReaderSize(file, 8*1024*1024)
	err = binary.Read(reader, binary.LittleEndian, &header)
	if err != nil {
		log.Printf("Error reading header: %v", err)
		return err
	}
	b.nextID = header.NextID
	b.seqNum = header.Seqnum
	b.totalMoves.Store(header.TotalMoves)
	b.whitePiecesCaptured.Store(header.WhitePiecesCaptured)
	b.blackPiecesCaptured.Store(header.BlackPiecesCaptured)
	b.whiteKingsCaptured.Store(header.WhiteKingsCaptured)
	b.blackKingsCaptured.Store(header.BlackKingsCaptured)
	log.Printf("Loaded board from snapshot file: seqnum %d, nextid %d, totalmoves %d, whitepiecescaptured %d, blackpiecescaptured %d, whitekingscaptured %d, blackkingscaptured %d", header.Seqnum, header.NextID, header.TotalMoves, header.WhitePiecesCaptured, header.BlackPiecesCaptured, header.WhiteKingsCaptured, header.BlackKingsCaptured)

	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			b.pieces[y][x] = uint64(EmptyEncodedPiece)
		}
	}

	pieceWithCoords := PieceWithCoords{}
	for {
		err = binary.Read(reader, binary.LittleEndian, &pieceWithCoords)
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
		x := uint16(pieceWithCoords.Coords >> 16)
		y := uint16(pieceWithCoords.Coords & 0xFFFF)
		b.pieces[y][x] = uint64(pieceWithCoords.RawPiece)
	}

	return nil
}

func GetSortedSnapshotFilenames(stateDir, prefix string) ([]FileWithSeqnumAndTimestamp, error) {
	files, err := filepath.Glob(filepath.Join(stateDir, fmt.Sprintf("%s-*.bin", prefix)))
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, nil
	}
	filesWithSeqnumAndTimestamp := make([]FileWithSeqnumAndTimestamp, len(files))
	for i, file := range files {
		err = filesWithSeqnumAndTimestamp[i].ofFilename(file, prefix)
		if err != nil {
			return nil, err
		}
	}
	slices.SortFunc(filesWithSeqnumAndTimestamp, func(i, j FileWithSeqnumAndTimestamp) int {
		if i.lastSeqnum == j.lastSeqnum {
			if i.timestampNano == j.timestampNano {
				return -1
			}
			if i.timestampNano > j.timestampNano {
				return 1
			}
			return -1
		}
		if i.lastSeqnum > j.lastSeqnum {
			return 1
		}
		return -1
	})
	return filesWithSeqnumAndTimestamp, nil
}

func NewFakePersistentBoard() *PersistentBoard {
	board := NewBoard()
	pb := &PersistentBoard{board: board,
		movesToApply:           make(chan Move, 8192),
		stateDir:               "",
		movesToSerializeBuffer: make([]Move, 0, 512),
		lastSerializedSeqnum:   atomic.Uint64{},
	}
	pb.board.InitializeRandom()
	return pb
}

func NewPersistentBoard(stateDir string) *PersistentBoard {
	if disabled {
		return NewFakePersistentBoard()
	}
	board := NewBoard()
	pb := &PersistentBoard{board: board,
		movesToApply:           make(chan Move, 8192),
		stateDir:               stateDir,
		movesToSerializeBuffer: make([]Move, 0, 512),
		lastSerializedSeqnum:   atomic.Uint64{},
	}

	snapshotFilenames, err := GetSortedSnapshotFilenames(stateDir, snapshotPrefix)
	if err != nil {
		log.Printf("Error getting snapshot filenames: %v", err)
		panic(err)
	}

	if len(snapshotFilenames) == 0 {
		log.Printf("No snapshot filenames found - initializing new board")
		board.InitializeRandom()
		snapshot := board.GetBoardSnapshot()
		snapshot.SaveToFile(stateDir, snapshotPrefix, board.seqNum)
		pb.lastSerializedSeqnum.Store(board.seqNum)
	} else {
		lastSnapshot := snapshotFilenames[len(snapshotFilenames)-1]
		snapshotFilename := filepath.Join(stateDir, lastSnapshot.toFilename())
		board.LoadFromSnapshotFile(snapshotFilename)
		if board.seqNum != lastSnapshot.lastSeqnum {
			log.Printf("ERROR: Last seqNum from board %d does not match last seqNum from file %d", board.seqNum, lastSnapshot.lastSeqnum)
		}
		pb.lastSerializedSeqnum.Store(board.seqNum)
	}

	moveFilenames, err := GetSortedSnapshotFilenames(stateDir, movePrefix)
	if err != nil {
		log.Printf("Error getting move filenames: %v", err)
		panic(err)
	}

	for _, moveFilename := range moveFilenames {
		if moveFilename.lastSeqnum < pb.lastSerializedSeqnum.Load() {
			log.Printf("Skipping move file %s because seqNum %d is less than lastSeqnum %d", moveFilename.toFilename(), moveFilename.lastSeqnum, pb.lastSerializedSeqnum.Load())
			continue
		}
		path := filepath.Join(stateDir, moveFilename.toFilename())
		moveFile, err := os.Open(path)
		log.Printf("Loading moves from file %s", path)
		if err != nil {
			s := fmt.Sprintf("Error opening move file: %v", err)
			log.Print(s)
			panic(s)
		}

		replayErr := func() error {
			defer moveFile.Close()
			move := Move{}
			bufferedReader := bufio.NewReaderSize(moveFile, 8*1024*1024)
			for {
				err = binary.Read(bufferedReader, binary.LittleEndian, &move)
				if err != nil {
					if err == io.EOF {
						break
					}
					s := fmt.Sprintf("Error reading move: %v", err)
					log.Print(s)
					panic(s)
				}
				res := pb.board.ValidateAndApplyMove(move)
				if !res.Valid {
					s := fmt.Sprintf("Invalid move (file: %s, move: %v)", moveFilename.toFilename(), move)
					log.Print(s)
					panic(s)
				}
			}
			return nil
		}()

		if replayErr != nil {
			log.Printf("Error replaying moves: %v", replayErr)
			return nil
		}
	}
	return pb
}

func (pb *PersistentBoard) GetBoardCopy() *Board {
	board := NewBoard()
	board.nextID = pb.board.nextID
	board.seqNum = pb.board.seqNum
	board.totalMoves.Store(pb.board.totalMoves.Load())
	board.whitePiecesCaptured.Store(pb.board.whitePiecesCaptured.Load())
	board.blackPiecesCaptured.Store(pb.board.blackPiecesCaptured.Load())
	board.whiteKingsCaptured.Store(pb.board.whiteKingsCaptured.Load())
	board.blackKingsCaptured.Store(pb.board.blackKingsCaptured.Load())
	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			board.pieces[y][x] = pb.board.pieces[y][x]
		}
	}
	return board
}

func (pb *PersistentBoard) ApplyMove(move Move, seqNum uint64) {
	pb.movesToApply <- move
}

func (pb *PersistentBoard) SerializeMoves(moves []Move, lastSeqnum uint64) error {
	if len(moves) == 0 {
		log.Printf("No moves to serialize")
		return nil
	}

	timestampNano := time.Now().UnixNano()
	mf := FileWithSeqnumAndTimestamp{prefix: movePrefix, lastSeqnum: lastSeqnum, timestampNano: timestampNano}
	finalFilename := filepath.Join(pb.stateDir, mf.toFilename())

	log.Printf("Serializing moves for seqnum %d to file %s", lastSeqnum, finalFilename)
	err := WriteFileAtomic(finalFilename, func(writer io.Writer) error {
		bufferedWriter := bufio.NewWriterSize(writer, 8*1024*1024)
		for _, move := range moves {
			writeErr := binary.Write(bufferedWriter, binary.LittleEndian, move)
			if writeErr != nil {
				log.Printf("Error writing move: %v", writeErr)
				return writeErr
			}
		}
		return bufferedWriter.Flush()
	})
	if err != nil {
		log.Printf("Error writing moves to file %s: %v", finalFilename, err)
		return err
	}
	return nil
}

func (pb *PersistentBoard) Run() {
	snapshotTicker := time.NewTicker(snapshotInterval)
	moveSerializeTicker := time.NewTicker(moveSerializeInterval)
	for {
		select {
		case move := <-pb.movesToApply:
			if disabled {
				continue
			}
			res := pb.board.ValidateAndApplyMove(move)
			if !res.Valid {
				log.Printf("TRIED TO APPLY INVALID MOVE: %v", move)
				continue
			}
			pb.movesToSerializeBuffer = append(pb.movesToSerializeBuffer, move)
			if len(pb.movesToSerializeBuffer) >= maxMovesToSerialize {
				moves := make([]Move, len(pb.movesToSerializeBuffer))
				copy(moves, pb.movesToSerializeBuffer)
				pb.movesToSerializeBuffer = pb.movesToSerializeBuffer[:0]
				lastSeqnum := pb.lastSerializedSeqnum.Load()
				go pb.SerializeMoves(moves, lastSeqnum)
			}
		case <-snapshotTicker.C:
			if disabled {
				continue
			}
			snapshot := pb.board.GetBoardSnapshot()
			pb.lastSerializedSeqnum.Store(snapshot.Seqnum)
			go func() {
				snapshot.SaveToFile(pb.stateDir, "board", snapshot.Seqnum)
			}()
		case <-moveSerializeTicker.C:
			if disabled {
				continue
			}
			if len(pb.movesToSerializeBuffer) > 0 {
				moves := make([]Move, len(pb.movesToSerializeBuffer))
				copy(moves, pb.movesToSerializeBuffer)
				pb.movesToSerializeBuffer = pb.movesToSerializeBuffer[:0]
				lastSeqnum := pb.lastSerializedSeqnum.Load()
				go pb.SerializeMoves(moves, lastSeqnum)
			}
		}
	}
}
