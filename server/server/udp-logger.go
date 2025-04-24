package server

import (
	"net"
	"sync"

	"github.com/rs/zerolog"
)

type udpWriter struct{ *net.UDPConn }

func (u udpWriter) Write(p []byte) (int, error) { return u.UDPConn.Write(p) }

var (
	socketOnce sync.Once
	socketConn *net.UDPConn
)

func initSocket() {
	dst, _ := net.ResolveUDPAddr("udp", "127.0.0.1:10514") // Vector listener
	c, _ := net.DialUDP("udp", nil, dst)
	_ = c.SetWriteBuffer(4 << 20) // 4 MiB
	socketConn = c
}

func NewCoreLogger() zerolog.Logger {
	socketOnce.Do(initSocket)
	return zerolog.New(udpWriter{socketConn}).
		With().
		Timestamp().
		Str("svc", "omc").
		Str("stream", "core").
		Logger().
		Level(zerolog.InfoLevel)
}

func NewRPCLogger(ip string) zerolog.Logger {
	socketOnce.Do(initSocket)
	return zerolog.New(udpWriter{socketConn}).
		With().
		Timestamp().
		Str("svc", "omc").
		Str("stream", "rpc").
		Str("ip", ip).
		Logger().
		Level(zerolog.InfoLevel)
}
