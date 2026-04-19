package ws

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second  // max time to write a message
	pongWait   = 10 * time.Second  // pong must arrive within 10s of ping
	pingPeriod = 20 * time.Second  // send a ping every 20s (spec requirement)

	// maxMessageSize is the maximum size (bytes) of a message from the client.
	// Clients are read-only receivers — we only need enough room for control frames.
	maxMessageSize = 512
)

// Client represents a single active WebSocket connection.
// It is owned by two goroutines: writePump (writing) and readPump (reading).
// The send channel is the handoff point between the hub and writePump.
type Client struct {
	conn *websocket.Conn

	// send is a buffered channel of outbound JSON frames.
	// Hub writes here; writePump drains it.
	send chan []byte
}

// readPump pumps inbound frames from the WebSocket connection.
// Clients are read-only receivers — message content is discarded.
// The loop exists solely to handle pong frames (which reset the read deadline)
// and to detect disconnects (read errors trigger unregister).
//
// readPump blocks until the connection is closed and must run in the
// caller's goroutine (not a new goroutine): HandleWebSocket calls it last,
// keeping the HTTP handler alive for the connection's lifetime.
func (c *Client) readPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pingPeriod + pongWait))
	c.conn.SetPongHandler(func(string) error {
		// Reset the deadline on every pong — connection is still alive.
		return c.conn.SetReadDeadline(time.Now().Add(pingPeriod + pongWait))
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(
				err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {
				log.Printf("ws: readPump: unexpected close: %v", err)
			}
			break
		}
		// Discard client messages — clients are read-only receivers.
	}
}

// writePump pumps outbound frames from the hub's send channel to the connection.
// It also sends periodic ping frames to keep the connection alive and allow
// the server to detect dead peers via pong timeout.
//
// writePump must run in its own goroutine: go client.writePump()
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel — send a close frame and exit.
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
