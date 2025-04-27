#!/bin/bash

set -e

# Variables
SERVER_USER="ubuntu"
SERVER_HOST="omcb-prod" # Replace with your server's IP or domain
METRICS_HOST="omcb-metrics"
SERVER_STATIC_DIR="/var/www/one-million-chessboards"
SERVER_BINARY_DIR="/home/ubuntu"
LOCAL_STATIC_DIR="client/dist"
LOCAL_SERVER_BINARY="server/server.exe"
LOCAL_UTIL_BINARY="server/utils.exe"
SERVER_UTIL_DIR="/home/ubuntu/bin"

# Build the server executable for Linux
echo "Building server executable..."
cd server
GOOS=linux GOARCH=amd64 go build -o server.exe cmd/main.go
cd ..

echo "Building utils"
cd server
GOOS=linux GOARCH=amd64 go build -o utils.exe util/utilities.go
cd ..

# Build the client static files
echo "Building client static files..."
cd client
npm run build
cd ..

# Deploy to the server
echo "Deploying to server..."
rsync -avz --delete $LOCAL_SERVER_BINARY $SERVER_USER@$SERVER_HOST:$SERVER_BINARY_DIR/
rsync -avz --delete $LOCAL_STATIC_DIR/ $SERVER_USER@$SERVER_HOST:$SERVER_STATIC_DIR/
rsync -avz --delete $LOCAL_UTIL_BINARY $SERVER_USER@$METRICS_HOST:$SERVER_UTIL_DIR/

# Restart the server
# echo "Restarting server..."
# ssh $SERVER_USER@$SERVER_HOST "sudo systemctl restart server.service"

# echo "Deployment complete!"
