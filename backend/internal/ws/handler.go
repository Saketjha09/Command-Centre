package ws

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"

	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/pkg/config"
)

func HandleWebSocket(hub *Hub, cfg *config.Config) http.HandlerFunc {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			allowed := strings.Split(cfg.AllowedOrigins, ",")
			for _, o := range allowed {
				if strings.TrimSpace(o) == origin {
					return true
				}
			}
			return false
		},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		// ── Step 1: Authenticate before touching the WebSocket protocol ───────

		cookie, err := r.Cookie("access_token")
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "authentication required"})
			return
		}
		token := cookie.Value

		claims, err := auth.ValidateAccessToken(cfg, token)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid or expired token"})
			return
		}

		// ── Step 2: Upgrade to WebSocket ──────────────────────────────────────

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			// Upgrade writes its own 4xx response on failure; nothing more to do.
			return
		}

		// ── Step 3: Register client and start read/write pumps ────────────────

		client := &Client{
			conn: conn,
			send: make(chan []byte, 256),
			Role: string(claims.Role),
		}
		hub.register <- client

		// writePump runs in a dedicated goroutine — it must be the sole writer.
		go client.writePump()

		// readPump blocks until the connection closes, then triggers unregister.
		client.readPump(hub)
	}
}
