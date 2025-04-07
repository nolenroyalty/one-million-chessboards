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

const (
	snapshotInterval      = time.Second * 600
	moveSerializeInterval = time.Second * 5
	maxMovesToSerialize   = 400
	snapshotPrefix        = "board"
	movePrefix            = "moves"
	suffix                = ".bin"
)

type PersistentBoard struct {
	board                  *Board
	movesToApply           chan Move
	stateDir               string
	movesToSerializeBuffer []Move
	lastSerializedSeqNum   atomic.Uint64
}

type PieceWithCoords struct {
	RawPiece EncodedPiece
	Coords   uint32
}

type BoardHeader struct {
	NextID              uint32
	SeqNum              uint64
	TotalMoves          uint64
	WhitePiecesCaptured uint32
	BlackPiecesCaptured uint32
	WhiteKingsCaptured  uint32
	BlackKingsCaptured  uint32
}

type BoardSnapshot struct {
	NextID              uint32
	SeqNum              uint64
	TotalMoves          uint64
	WhitePiecesCaptured uint32
	BlackPiecesCaptured uint32
	WhiteKingsCaptured  uint32
	BlackKingsCaptured  uint32
	PiecesWithCoords    []PieceWithCoords
}

type FileWithSeqNumAndTimestamp struct {
	prefix        string
	lastSeqNum    uint64
	timestampNano int64
}

func (f *FileWithSeqNumAndTimestamp) toFilename() string {
	return fmt.Sprintf("%s-%d-%d.bin", f.prefix, f.lastSeqNum, f.timestampNano)
}

func (f *FileWithSeqNumAndTimestamp) ofFilename(filename string, expectedPrefix string) error {
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
	f.lastSeqNum = seqNumInt
	f.timestampNano = timestampNanoInt
	return nil
}

func (b *Board) GetBoardSnapshot() BoardSnapshot {
	start := time.Now()
	snapshot := BoardSnapshot{
		NextID:              b.nextID,
		SeqNum:              b.seqNum.Load(),
		TotalMoves:          b.totalMoves.Load(),
		WhitePiecesCaptured: b.whitePiecesCaptured.Load(),
		BlackPiecesCaptured: b.blackPiecesCaptured.Load(),
		WhiteKingsCaptured:  b.whiteKingsCaptured.Load(),
		BlackKingsCaptured:  b.blackKingsCaptured.Load(),
		PiecesWithCoords:    make([]PieceWithCoords, 0, BOARD_SIZE*BOARD_SIZE),
	}
	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			raw := b.pieces[y][x].Load()
			piece := PieceOfEncodedPiece(EncodedPiece(raw))
			if !piece.Empty {
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
	mf := FileWithSeqNumAndTimestamp{prefix: baseFilename, lastSeqNum: seqNum, timestampNano: timestampNano}
	filename := filepath.Join(stateDir, mf.toFilename())

	err := WriteFileAtomic(filename, func(writer io.Writer) error {
		header := BoardHeader{
			NextID:              s.NextID,
			SeqNum:              s.SeqNum,
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
	b.seqNum.Store(header.SeqNum)
	b.totalMoves.Store(header.TotalMoves)
	b.whitePiecesCaptured.Store(header.WhitePiecesCaptured)
	b.blackPiecesCaptured.Store(header.BlackPiecesCaptured)
	b.whiteKingsCaptured.Store(header.WhiteKingsCaptured)
	b.blackKingsCaptured.Store(header.BlackKingsCaptured)
	log.Printf("Loaded board from snapshot file: seqnum %d, nextid %d, totalmoves %d, whitepiecescaptured %d, blackpiecescaptured %d, whitekingscaptured %d, blackkingscaptured %d", header.SeqNum, header.NextID, header.TotalMoves, header.WhitePiecesCaptured, header.BlackPiecesCaptured, header.WhiteKingsCaptured, header.BlackKingsCaptured)

	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			b.pieces[y][x].Store(uint64(EmptyEncodedPiece))
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
		b.pieces[y][x].Store(uint64(pieceWithCoords.RawPiece))
	}

	return nil
}

func GetSortedSnapshotFilenames(stateDir, prefix string) ([]FileWithSeqNumAndTimestamp, error) {
	files, err := filepath.Glob(filepath.Join(stateDir, fmt.Sprintf("%s-*.bin", prefix)))
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, nil
	}
	filesWithSeqNumAndTimestamp := make([]FileWithSeqNumAndTimestamp, len(files))
	for i, file := range files {
		err = filesWithSeqNumAndTimestamp[i].ofFilename(file, prefix)
		if err != nil {
			return nil, err
		}
	}
	slices.SortFunc(filesWithSeqNumAndTimestamp, func(i, j FileWithSeqNumAndTimestamp) int {
		if i.lastSeqNum == j.lastSeqNum {
			if i.timestampNano == j.timestampNano {
				return -1
			}
			if i.timestampNano > j.timestampNano {
				return 1
			}
			return -1
		}
		if i.lastSeqNum > j.lastSeqNum {
			return 1
		}
		return -1
	})
	return filesWithSeqNumAndTimestamp, nil
}

func NewPersistentBoard(stateDir string) *PersistentBoard {
	board := NewBoard()
	pb := &PersistentBoard{board: board,
		movesToApply:           make(chan Move, 8192),
		stateDir:               stateDir,
		movesToSerializeBuffer: make([]Move, 0, 512),
		lastSerializedSeqNum:   atomic.Uint64{},
	}

	snapshotFilenames, err := GetSortedSnapshotFilenames(stateDir, snapshotPrefix)
	if err != nil {
		log.Printf("Error getting snapshot filenames: %v", err)
		return nil
	}

	if len(snapshotFilenames) == 0 {
		log.Printf("No snapshot filenames found - initializing new board")
		board.InitializeRandom()
		snapshot := board.GetBoardSnapshot()
		snapshot.SaveToFile(stateDir, snapshotPrefix, board.seqNum.Load())
		pb.lastSerializedSeqNum.Store(board.seqNum.Load())
	} else {
		lastSnapshot := snapshotFilenames[len(snapshotFilenames)-1]
		snapshotFilename := filepath.Join(stateDir, lastSnapshot.toFilename())
		board.LoadFromSnapshotFile(snapshotFilename)
		if board.seqNum.Load() != lastSnapshot.lastSeqNum {
			log.Printf("ERROR: Last seqNum from board %d does not match last seqNum from file %d", board.seqNum.Load(), lastSnapshot.lastSeqNum)
		}
		pb.lastSerializedSeqNum.Store(board.seqNum.Load())
	}

	moveFilenames, err := GetSortedSnapshotFilenames(stateDir, movePrefix)
	if err != nil {
		log.Printf("Error getting move filenames: %v", err)
		return nil
	}

	for _, moveFilename := range moveFilenames {
		if moveFilename.lastSeqNum < pb.lastSerializedSeqNum.Load() {
			log.Printf("Skipping move file %s because seqNum %d is less than lastSeqNum %d", moveFilename.toFilename(), moveFilename.lastSeqNum, pb.lastSerializedSeqNum.Load())
			continue
		}
		path := filepath.Join(stateDir, moveFilename.toFilename())
		moveFile, err := os.Open(path)
		log.Printf("Loading moves from file %s", path)
		if err != nil {
			log.Printf("Error opening move file: %v", err)
			return nil
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
					log.Printf("Error reading move: %v", err)
					return err
				}
				pb.board.ValidateAndApplyMove(move)
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

// func NewPersistentBoard(stateDir string) *PersistentBoard {
// 	board := NewBoard()
// 	files, err := filepath.Glob(filepath.Join(stateDir, "board-*.bin"))
// 	if err != nil {
// 		log.Printf("Error getting files: %v", err)
// 	}
// 	snapshotExists := false
// 	snapshotFilename := ""
// 	lastSeqNum := uint64(0)
// 	if len(files) > 0 {
// 		snapshotExists = true
// 		for _, file := range files {
// 			withoutExt := strings.TrimSuffix(filepath.Base(file), ".bin")
// 			seqNum := strings.Split(withoutExt, "-")[1]
// 			seqNumInt, err := strconv.ParseUint(seqNum, 10, 64)
// 			if err != nil {
// 				log.Printf("Error parsing seqNum: %v", err)
// 			}
// 			if seqNumInt >= lastSeqNum {
// 				lastSeqNum = seqNumInt
// 				snapshotFilename = file
// 			}
// 		}
// 	}

// 	if snapshotExists {
// 		log.Printf("Loading board from snapshot file %s", snapshotFilename)
// 		board.LoadFromSnapshotFile(snapshotFilename)
// 		lastSeqnumFromBoard := board.seqNum.Load()
// 		if lastSeqNum != lastSeqnumFromBoard {
// 			log.Printf("ERROR: Last seqNum from board %d does not match last seqNum from file %d", lastSeqnumFromBoard, lastSeqNum)
// 			lastSeqNum = lastSeqnumFromBoard
// 		}
// 	} else {
// 		board.InitializeRandom()
// 		snapshot := board.GetBoardSnapshot()
// 		snapshot.SaveToFile(stateDir, "board", board.seqNum.Load())
// 	}

// 	pb := &PersistentBoard{board: board,
// 		movesToApply:           make(chan Move, 8192),
// 		stateDir:               stateDir,
// 		movesToSerializeBuffer: make([]Move, 0, 512),
// 		lastSerializedSeqNum:   atomic.Uint64{}}
// 	pb.lastSerializedSeqNum.Store(lastSeqNum)

// 	if snapshotExists {
// 		moveFiles, err := filepath.Glob(filepath.Join(stateDir, "moves-*.bin"))
// 		if err != nil {
// 			log.Printf("Error getting files: %v", err)
// 		}
// 		filesToApply := make([]string, 0, len(moveFiles))
// 		for _, file := range moveFiles {
// 			withoutExt := strings.TrimSuffix(filepath.Base(file), ".bin")
// 			seqNum := strings.Split(withoutExt, "-")[1]
// 			seqNumInt, err := strconv.ParseUint(seqNum, 10, 64)
// 			if err != nil {
// 				log.Printf("Error parsing seqNum: %v", err)
// 			} else if seqNumInt >= lastSeqNum {
// 				filesToApply = append(filesToApply, file)
// 				log.Printf("Adding move file %s to apply", file)
// 			} else {
// 				log.Printf("Skipping move file %s because seqNum %d is less than lastSeqNum %d", file, seqNumInt, lastSeqNum)
// 			}
// 		}
// 		for _, file := range filesToApply {
// 			moveFile, err := os.Open(file)
// 			if err != nil {
// 				log.Printf("Error opening file: %v", err)
// 			}
// 			defer moveFile.Close()
// 			log.Printf("Applying moves from file %s", file)
// 			bufferedReader := bufio.NewReaderSize(moveFile, 8*1024*1024)
// 			move := Move{}
// 			for {
// 				err = binary.Read(bufferedReader, binary.LittleEndian, &move)
// 				if err != nil {
// 					if err.Error() == "EOF" {
// 						break
// 					}
// 					log.Printf("Error reading move: %v", err)
// 				}
// 				pb.board.ValidateAndApplyMove(move)
// 			}
// 		}
// 	}
// 	return pb
// }

func (pb *PersistentBoard) GetBoardCopy() *Board {
	board := NewBoard()
	board.nextID = pb.board.nextID
	board.seqNum.Store(pb.board.seqNum.Load())
	board.totalMoves.Store(pb.board.totalMoves.Load())
	board.whitePiecesCaptured.Store(pb.board.whitePiecesCaptured.Load())
	board.blackPiecesCaptured.Store(pb.board.blackPiecesCaptured.Load())
	board.whiteKingsCaptured.Store(pb.board.whiteKingsCaptured.Load())
	board.blackKingsCaptured.Store(pb.board.blackKingsCaptured.Load())
	for y := uint16(0); y < BOARD_SIZE; y++ {
		for x := uint16(0); x < BOARD_SIZE; x++ {
			board.pieces[y][x].Store(pb.board.pieces[y][x].Load())
		}
	}
	return board
}

func (pb *PersistentBoard) ApplyMove(move Move, seqNum uint64) {
	pb.movesToApply <- move
}

func (pb *PersistentBoard) SerializeMoves(moves []Move, lastSeqNum uint64) error {
	if len(moves) == 0 {
		log.Printf("No moves to serialize")
		return nil
	}

	timestampNano := time.Now().UnixNano()
	mf := FileWithSeqNumAndTimestamp{prefix: movePrefix, lastSeqNum: lastSeqNum, timestampNano: timestampNano}
	finalFilename := filepath.Join(pb.stateDir, mf.toFilename())

	log.Printf("Serializing moves for seqnum %d to file %s", lastSeqNum, finalFilename)
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
				lastSeqNum := pb.lastSerializedSeqNum.Load()
				go pb.SerializeMoves(moves, lastSeqNum)
			}
		case <-snapshotTicker.C:
			snapshot := pb.board.GetBoardSnapshot()
			pb.lastSerializedSeqNum.Store(snapshot.SeqNum)
			go func() {
				snapshot.SaveToFile(pb.stateDir, "board", snapshot.SeqNum)
			}()
		case <-moveSerializeTicker.C:
			if len(pb.movesToSerializeBuffer) > 0 {
				moves := make([]Move, len(pb.movesToSerializeBuffer))
				copy(moves, pb.movesToSerializeBuffer)
				pb.movesToSerializeBuffer = pb.movesToSerializeBuffer[:0]
				lastSeqNum := pb.lastSerializedSeqNum.Load()
				go pb.SerializeMoves(moves, lastSeqNum)
			}
		}
	}
}
