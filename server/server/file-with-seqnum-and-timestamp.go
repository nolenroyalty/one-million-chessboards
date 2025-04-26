package server

import (
	"fmt"
	"log"
	"path/filepath"
	"strconv"
	"strings"
)

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
