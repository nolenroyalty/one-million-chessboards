package server

import (
	"flag"
	"fmt"
	"net"
	"os"
	"sync"

	"github.com/rs/zerolog"
)

type udpWriter struct{ *net.UDPConn }

func (u udpWriter) Write(p []byte) (int, error) {
	return u.UDPConn.Write(p)
}

func (u udpWriter) WriteLevel(level zerolog.Level, p []byte) (int, error) {
	return u.Write(p)
}

type stdoutWriter struct{ zerolog.ConsoleWriter }

func (s stdoutWriter) Write(p []byte) (int, error) {
	return s.ConsoleWriter.Write(p)
}

func (s stdoutWriter) WriteLevel(level zerolog.Level, p []byte) (int, error) {
	return s.Write(p)
}

var (
	socketOnce sync.Once
	socketConn *net.UDPConn
	udpAddr    = "127.0.0.1"
	udpPort    = 10514 // default vector port
	useUDP     = flag.Bool("udp-logging", true, "Use UDP logging (false for stdout)")
)

// not safe to call after initialization lol
func SetUDPAddress(addr string) {
	udpAddr = addr
}

func initSocket() {
	zerolog.ErrorHandler = func(error) {}
	if !*useUDP {
		return
	}
	dst, _ := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", udpAddr, udpPort)) // Vector listener
	c, _ := net.DialUDP("udp", nil, dst)
	_ = c.SetWriteBuffer(4 << 20) // 4 MiB
	socketConn = c
}

func getWriter() zerolog.LevelWriter {
	if *useUDP {
		socketOnce.Do(initSocket)
		return udpWriter{socketConn}
	}
	return stdoutWriter{zerolog.ConsoleWriter{Out: os.Stdout}}
}

func NewCoreLogger() zerolog.Logger {
	return zerolog.New(getWriter()).
		With().
		Timestamp().
		Str("stream", "core").
		Logger().
		Level(zerolog.InfoLevel)
}

func NewRPCLogger(ip string) zerolog.Logger {
	return zerolog.New(getWriter()).
		With().
		Timestamp().
		Str("stream", "rpc").
		Str("ip", ip).
		Logger().
		Level(zerolog.InfoLevel)
}
