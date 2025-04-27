#!/bin/bash

## LLM SLOP

# === Script to be run on the secondary/backup server ===
# - Compresses new 'moves' files using zstd.
# - Keeps the latest 'keep_remote_boards' board files UNCOMPRESSED.
# - Deletes older board files.

# --- Safety Settings ---
set -e
set -u
set -o pipefail

# --- Constants ---
MOVES_COMPRESSION_SUFFIX=".zst"
ZSTD_CMD="zstd --rm -q" # Use --rm to delete source, -T0 for multi-threading

# --- Argument Parsing ---
if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <board_dir> <moves_dir> <keep_remote_boards>"
  exit 1
fi

BOARD_DIR="$1"
MOVES_DIR="$2"
KEEP_REMOTE="$3" # Number of UNCOMPRESSED board files to keep

echo "[Remote] Starting cleanup and moves compression..."
date

# --- Pre-checks ---
if [[ ! -d "${BOARD_DIR}" ]]; then
  echo "[Remote] ERROR: Board directory not found: ${BOARD_DIR}"
  exit 1
fi
if [[ ! -d "${MOVES_DIR}" ]]; then
  echo "[Remote] ERROR: Moves directory not found: ${MOVES_DIR}"
  exit 1
fi
# Check if zstd command exists (needed for moves files)
command -v zstd >/dev/null 2>&1 || { echo >&2 "[Remote] ERROR: zstd command not found. Please install zstd."; exit 1; }


# --- Compress New Moves Files ---

echo "[Remote] Compressing new moves files in ${MOVES_DIR} using ${ZSTD_CMD}..."
# Find uncompressed moves files (.bin) and compress them using zstd --rm
find "${MOVES_DIR}" -maxdepth 1 -type f -name 'moves-*.bin' -print0 | while IFS= read -r -d $'\0' file; do
    echo "[Remote] Compressing moves file: ${file}"
    # Use eval to correctly handle the command string with arguments
    eval "${ZSTD_CMD}" '"${file}"' || echo "[Remote] Warning: Failed to compress moves file ${file}"
done

# --- Clean Old Remote Board Files (Keep UNCOMPRESSED) ---
echo "[Remote] Cleaning up old UNCOMPRESSED board files in ${BOARD_DIR} (keeping latest ${KEEP_REMOTE} based on timestamp)..."
cd "${BOARD_DIR}" || { echo "[Remote] ERROR: Cannot cd to ${BOARD_DIR}"; exit 1; }

# Use printf for safe filename handling, awk to extract timestamp, sort numerically,
# skip the newest N, cut the filename, and delete.
# Process only UNCOMPRESSED board files matching the pattern (*.bin).
echo "REMOTE" $(pwd)
printf '%s\n' board-ts:*-seq:*.bin |
  awk -F '[:-]' '{print $3 "\t" $0}' |       # Output: <timestamp>\t<filename>
  sort -k1,1nr |                           # Sort numerically by timestamp (key 1), reversed
  tail -n +$((${KEEP_REMOTE} + 1)) |       # Skip the newest KEEP_REMOTE files
  cut -f2- |                               # Extract the filename (field 2 onwards)
  while IFS= read -r file_to_delete; do
	  echo "evaluate $file_to_delete"
    if [[ -n "$file_to_delete" && -f "$file_to_delete" ]]; then # Check if not empty and is a file
      echo "[Remote] Deleting old remote board: $file_to_delete"
      rm -- "$file_to_delete" || echo "[Remote] Warning: Failed to delete remote board file $file_to_delete"
else
	echo "??? $file_to_delete"
    fi
  done

# Go back to the original directory (optional, good practice)
cd - > /dev/null

echo "[Remote] Cleanup and moves compression finished."
date

exit 0
