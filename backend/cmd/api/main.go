// Command api is the entrypoint for the Freelance Command Center API server.
// It wires configuration, the database pool, the HTTP router, and OS-signal
// handling for graceful shutdown into a single clean main() function.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/internal/availability"
	"github.com/saket/command-center/backend/internal/brands"
	"github.com/saket/command-center/backend/internal/notifications"
	"github.com/saket/command-center/backend/internal/db"
	"github.com/saket/command-center/backend/internal/tasks"
	"github.com/saket/command-center/backend/internal/ws"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
	"strings"
)

func corsMiddleware(allowedOrigins string, env string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			matched := false

			// Check 1: localhost bypass — development only, never production
			if env != "production" &&
				(strings.HasPrefix(origin, "http://localhost:") ||
					strings.HasPrefix(origin, "http://127.0.0.1:")) {
				matched = true
			}

			// Check 2: explicit allowlist — runs in ALL environments
			// including production. This is the ONLY path in production.
			if !matched {
				for _, allowed := range strings.Split(allowedOrigins, ",") {
					if strings.TrimSpace(allowed) == origin && origin != "" {
						matched = true
						break
					}
				}
			}

			if matched && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")
			}

			// Handle OPTIONS preflight
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func slashMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only strip for non-root paths that have a trailing slash
		if r.URL.Path != "/" && strings.HasSuffix(r.URL.Path, "/") {
			r.URL.Path = strings.TrimSuffix(r.URL.Path, "/")
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	// -------------------------------------------------------------------------
	// 1. Load & validate configuration — fatal on any missing env var.
	// -------------------------------------------------------------------------
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("FATAL config: %v", err)
	}

	// -------------------------------------------------------------------------
	// 2. Establish the database pool — fatal if Postgres is unreachable.
	// -------------------------------------------------------------------------
	pool, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("FATAL database: %v", err)
	}
	log.Println("Database pool established (maxConns=25)")

	// -------------------------------------------------------------------------
	// 3. Build the router and register routes.
	// -------------------------------------------------------------------------
	mux := http.NewServeMux()

	// GET /api/v1/health — shallow liveness + DB reachability probe.
	mux.HandleFunc("GET /api/v1/health", healthHandler(pool))

	// ── WebSocket hub ──────────────────────────────────────────────────────────
	// The hub must be running before any route is registered so that the first
	// WS connection has somewhere to register.
	hub := ws.NewHub()
	go hub.Run()

	// Auth domain: register, login, logout, me.
	auth.RegisterRoutes(mux, pool, cfg)

	// User listing — any authenticated user.
	mux.Handle("GET /api/v1/users",
		auth.Authenticate(cfg)(http.HandlerFunc(auth.HandleListUsers(pool, cfg))))

	// Rate limit auth mutation endpoints — 10 req/min per IP
	loginRateLimit := middleware.RateLimit(10, time.Minute)
	mux.Handle("POST /api/v1/auth/login",
		loginRateLimit(http.HandlerFunc(auth.HandleLogin(pool, cfg))))
	mux.Handle("POST /api/v1/auth/register",
		loginRateLimit(http.HandlerFunc(auth.HandleRegister(pool, cfg))))

	// Tasks domain: CRUD, assign, status transitions.
	// hub is forwarded to mutating handlers for real-time WS broadcasts.
	tasks.RegisterRoutes(mux, pool, cfg, hub)

	// Availability domain: upsert, per-user lookahead, daily dashboard grid.
	availability.RegisterRoutes(mux, pool, cfg)

	// Brands domain: dynamic brand management.
	brands.RegisterRoutes(mux, pool, cfg)

	// Notifications domain: Slack pings, etc.
	notifications.RegisterRoutes(mux, pool, cfg)

	// WebSocket endpoint — auth is validated inside the handler (pre-upgrade).
	// Cannot use middleware chain here: HTTP error codes are impossible post-upgrade.
	mux.HandleFunc("GET /api/v1/ws", ws.HandleWebSocket(hub, cfg))

	// Serve static files from uploads directory
	// Serve static files from uploads directory with security headers
	staticHeaders := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Disposition", "attachment")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Content-Security-Policy", "default-src 'none'")
			next.ServeHTTP(w, r)
		})
	}
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", staticHeaders(http.FileServer(http.Dir("uploads")))))

	// -------------------------------------------------------------------------
	// 4. Construct the HTTP server.
	// -------------------------------------------------------------------------
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           corsMiddleware(cfg.AllowedOrigins, cfg.GOEnv)(slashMiddleware(middleware.SecurityHeaders(mux))),
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,   // slow-loris fix
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,           // 1MB header limit
	}

	// -------------------------------------------------------------------------
	// 5. Start listening in a goroutine so we can block on the signal channel.
	// -------------------------------------------------------------------------
	serverErr := make(chan error, 1)
	go func() {
		log.Printf("API server listening on :%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	// -------------------------------------------------------------------------
	// 6. Block until SIGINT / SIGTERM, then initiate graceful shutdown.
	// -------------------------------------------------------------------------
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		log.Printf("Received signal %s — shutting down gracefully...", sig)
	case err := <-serverErr:
		log.Printf("Server error: %v — initiating shutdown", err)
	}

	// Unified shutdown path — always reached regardless of which case fired.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Graceful shutdown error: %v", err)
	}

	pool.Close()
	log.Println("Server exited cleanly.")
}

// healthHandler returns an http.HandlerFunc that pings the DB and replies with
// a JSON body. It relies on a fast pool.Ping so the check is always live,
// not cached.
func healthHandler(pool *pgxpool.Pool) http.HandlerFunc {
	type response struct {
		Status string `json:"status"`
		DB     string `json:"db"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		dbStatus := "reachable"
		if err := pool.Ping(ctx); err != nil {
			log.Printf("health: DB ping failed: %v", err)
			dbStatus = "unreachable"
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(response{Status: "degraded", DB: dbStatus})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response{Status: "ok", DB: dbStatus})
	}
}
