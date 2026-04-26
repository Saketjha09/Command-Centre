// Package ws implements the WebSocket hub for real-time event broadcasting.
// The hub follows the single-event-loop pattern: one goroutine (Run) owns the
// clients map exclusively, all other goroutines communicate via channels.
// This eliminates mutex contention on the hot broadcast path.
package ws

import (
	"encoding/json"
	"fmt"
	"log"
)

// Message is the JSON envelope sent to every connected client.
// Type is a dot-namespaced string (e.g. "task.created").
// Payload is the full resource struct, marshalled inline.
type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// envelope wraps the marshalled data and an optional role filter.
type envelope struct {
	data     []byte
	roleOnly string
}

// Hub maintains the set of active WebSocket clients and fans out broadcasts.
// All fields are private — access is mediated exclusively by Run().
type Hub struct {
	// register is sent a client pointer by HandleWebSocket after upgrade.
	register chan *Client

	// unregister is sent a client pointer by readPump on disconnect.
	unregister chan *Client

	// broadcast is sent an envelope by Broadcast() or BroadcastToRole().
	broadcast chan envelope

	// clients is the live set; touched ONLY inside Run().
	clients map[*Client]bool
}

// NewHub returns an initialised Hub. Call go hub.Run() after construction.
func NewHub() *Hub {
	return &Hub{
		register:   make(chan *Client, 16),
		unregister: make(chan *Client, 16),
		broadcast:  make(chan envelope, 256),
		clients:    make(map[*Client]bool),
	}
}

// Run processes register / unregister / broadcast events in a single goroutine.
// The clients map is owned entirely by this goroutine — no mutex required.
// Must be invoked as: go hub.Run()
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}

		case env := <-h.broadcast:
			for client := range h.clients {
				if env.roleOnly != "" && client.Role != env.roleOnly {
					continue
				}
				select {
				case client.send <- env.data:
				default:
					// Client's outbound buffer is full — consider it dead.
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

// Broadcast marshals a typed message envelope and queues it for fan-out to all clients.
// It implements tasks.WSBroadcaster so *Hub can be passed to tasks.RegisterRoutes.
// Non-blocking: if the internal buffer is full the message is dropped and logged.
func (h *Hub) Broadcast(msgType string, payload interface{}) error {
	data, err := h.marshal(msgType, payload)
	if err != nil {
		return err
	}

	select {
	case h.broadcast <- envelope{data: data, roleOnly: ""}:
	default:
		log.Printf("ws: broadcast buffer full, dropping %q event", msgType)
	}
	return nil
}

// BroadcastToRole marshals a typed message envelope and queues it for role-filtered fan-out.
// Non-blocking: if the internal buffer is full the message is dropped and logged.
func (h *Hub) BroadcastToRole(role string, msgType string, payload interface{}) error {
	data, err := h.marshal(msgType, payload)
	if err != nil {
		return err
	}

	select {
	case h.broadcast <- envelope{data: data, roleOnly: role}:
	default:
		log.Printf("ws: broadcast buffer full, dropping %q event for role %q", msgType, role)
	}
	return nil
}

func (h *Hub) marshal(msgType string, payload interface{}) ([]byte, error) {
	msg := Message{Type: msgType, Payload: payload}
	data, err := json.Marshal(msg)
	if err != nil {
		return nil, fmt.Errorf("ws: marshal broadcast %q: %w", msgType, err)
	}
	return data, nil
}
