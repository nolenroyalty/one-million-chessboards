package server

import (
	"fmt"
	"io"
	"log"
	"os"
)

func WriteFileAtomic(finalPath string, writeData func(writer io.Writer) error) error {
	tmpPath := finalPath + ".tmp"
	tempFile, err := os.Create(tmpPath)
	if err != nil {
		log.Printf("Error creating file %s: %v", tmpPath, err)
		return err
	}
	shouldRemove := true

	defer func() {
		closeErr := tempFile.Close()
		if closeErr != nil {
			log.Printf("Error closing file %s: %v", tmpPath, closeErr)
		}
		if shouldRemove {
			removeErr := os.Remove(tmpPath)
			if removeErr != nil {
				log.Printf("Error removing file after error %s: %v", tmpPath, removeErr)
			}
		}
	}()

	wdErr := writeData(tempFile)
	if wdErr != nil {
		log.Printf("Error writing data to file %s: %v", tmpPath, wdErr)
		return wdErr
	}

	err = tempFile.Sync()
	if err != nil {
		log.Printf("Error syncing file %s: %v", tmpPath, err)
		return fmt.Errorf("error syncing file %s: %v", tmpPath, err)
	}

	shouldRemove = false
	renameErr := os.Rename(tmpPath, finalPath)
	if renameErr != nil {
		log.Printf("Error renaming file %s to %s: %v", tmpPath, finalPath, renameErr)
		shouldRemove = true
	}

	return nil
}
