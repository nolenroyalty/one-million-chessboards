#!/bin/bash

cd client; npx pbjs -t static-module -w es6 -o src/protoCompiled.js ../protocol/chess.proto; cd ..

protoc -I=protocol \
  --go_out=paths=source_relative:server/protocol \
  protocol/chess.proto
