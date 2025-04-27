#!/bin/bash

## LLM SLOP

# === Configuration ===

# --- Main Box ---
MAIN_DATA_DIR="/home/ubuntu/state/"
KEEP_LOCAL_BOARDS=3

# --- Secondary Box ---
SECONDARY_HOST="ubuntu@metrics"
SECONDARY_BASE_DIR="/mnt/volume_nyc3_01/backups"
SECONDARY_BOARD_DIR="${SECONDARY_BASE_DIR}/boards"
SECONDARY_MOVES_DIR="${SECONDARY_BASE_DIR}/moves"
KEEP_REMOTE_BOARDS=5
# Path to the remote cleanup script on the secondary box
REMOTE_SCRIPT_PATH="/home/ubuntu/bin/clean-and-compress-logs.sh"

# --- Tools ---
RSYNC_OPTS="-av --no-compress" # Use archive mode, verbose. Don't compress during transfer
# Add --bwlimit=KBPS here if you need to limit bandwidth

# === End Configuration ===

# --- Script Setup ---
set -e
set -u
set -o pipefail

echo "--- Starting Backup and Cleanup ---"
date

# --- Pre-checks ---
if [[ ! -d "${MAIN_DATA_DIR}" ]]; then
  echo "ERROR: Main data directory not found: ${MAIN_DATA_DIR}"
  exit 1
fi
# Add checks for rsync, ssh if needed
# command -v rsync >/dev/null 2>&1 || { echo >&2 "ERROR: rsync not found."; exit 1; }
# command -v ssh >/dev/null 2>&1 || { echo >&2 "ERROR: ssh not found."; exit 1; }

# --- Ensure Remote Directories Exist ---
echo "Ensuring remote directories exist on ${SECONDARY_HOST}..."
ssh "${SECONDARY_HOST}" "mkdir -p '${SECONDARY_BOARD_DIR}' '${SECONDARY_MOVES_DIR}'"

# --- Transfer Files ---

# 1. Transfer BOARD files (no source removal yet)
echo "Transferring board files to ${SECONDARY_HOST}:${SECONDARY_BOARD_DIR}..."
rsync ${RSYNC_OPTS} \
  --include='board-*.bin' \
  --exclude='*' \
  "${MAIN_DATA_DIR}/" \
  "${SECONDARY_HOST}:${SECONDARY_BOARD_DIR}/"

# 2. Transfer MOVES files (remove source after successful transfer)
echo "Transferring moves files to ${SECONDARY_HOST}:${SECONDARY_MOVES_DIR} (and removing source)..."
rsync ${RSYNC_OPTS} \
  --remove-source-files \
  --include='moves-*.bin' \
  --exclude='*' \
  "${MAIN_DATA_DIR}/" \
  "${SECONDARY_HOST}:${SECONDARY_MOVES_DIR}/"

# --- Run Remote Operations ---
echo "Executing remote cleanup and compression script on ${SECONDARY_HOST}..."
ssh "${SECONDARY_HOST}" \
    "bash '${REMOTE_SCRIPT_PATH}' \
    '${SECONDARY_BOARD_DIR}' \
    '${SECONDARY_MOVES_DIR}' \
    '${KEEP_REMOTE_BOARDS}'" # Pass only necessary args

# --- Local Cleanup (Main Box) ---
# This happens *after* successful transfer and remote operations.
# We clean up the original .bin files locally.
echo "Cleaning up local board files (keeping latest ${KEEP_LOCAL_BOARDS} based on timestamp)..."
cd "${MAIN_DATA_DIR}" || { echo "ERROR: Cannot cd to ${MAIN_DATA_DIR}"; exit 1; }

# Use printf for safe filename handling, awk to extract timestamp, sort numerically,
# skip the newest N, cut the filename, and delete.
# Awk uses ':' or '-' as delimiters, timestamp is the 3rd field (ts:<timestamp>-...)
printf '%s\n' board-ts:*-seq:*.bin |
  awk -F '[:-]' '{print $3 "\t" $0}' | # Output: <timestamp>\t<filename>
  sort -k1,1nr |                         # Sort numerically by timestamp (key 1), reversed (newest first)
  tail -n +$((${KEEP_LOCAL_BOARDS} + 1)) | # Skip the newest KEEP_LOCAL_BOARDS files
  cut -f2- |                             # Extract the filename (field 2 onwards)
  while IFS= read -r file_to_delete; do
    if [[ -n "$file_to_delete" && -f "$file_to_delete" ]]; then # Check if not empty and is a file
      echo "Deleting old local board: $file_to_delete"
      rm -- "$file_to_delete" || echo "Warning: Failed to delete local file $file_to_delete"
    fi
  done

# Go back to the original directory (optional, good practice)
cd - > /dev/null

echo "--- Backup and Cleanup Finished ---"
date

exit 0

