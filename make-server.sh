#!/bin/bash

NAME=${1:-server}

cd server
go build -o $NAME.exe cmd/main.go
go build -o utils.exe util/utilities.go
mv $NAME.exe ..
mv utils.exe ..
