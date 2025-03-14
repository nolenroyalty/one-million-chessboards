#!/bin/bash

NAME=${1:-server}

cd server
go build -o $NAME.exe cmd/main.go
mv $NAME.exe ..
