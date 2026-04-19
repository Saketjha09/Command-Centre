package availability

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

// ── JSON helpers ─────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ── handlers ─────────────────────────────────────────────────────────────────

// HandleUpsertAvailability handles PUT /api/v1/availability/{userID}/{date}.
// Any authenticated user may call this — the service layer enforces
// own-only access for freelancers.
func HandleUpsertAvailability(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.PathValue("userID")
		date := r.PathValue("date")

		claims, ok := middleware.ClaimsFromContext(r.Context())
		if !ok {
			log.Printf("availability: HandleUpsertAvailability: missing claims in context")
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		var req UpsertAvailabilityRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		result, err := UpsertAvailability(pool, claims, userID, date, req)
		if err != nil {
			switch {
			case errors.Is(err, ErrValidation):
				writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrValidation.Error()+": "))
			case errors.Is(err, ErrUnauthorized):
				writeError(w, http.StatusForbidden, "access denied")
			default:
				log.Printf("availability: upsert(%s, %s): %v", userID, date, err)
				writeError(w, http.StatusInternalServerError, "failed to upsert availability")
			}
			return
		}

		writeJSON(w, http.StatusOK, result)
	}
}

// HandleGetUserAvailability handles GET /api/v1/availability/{userID}.
// Query param "days" controls the lookahead window (default 7, max 30).
func HandleGetUserAvailability(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.PathValue("userID")

		// Parse optional "days" query parameter; default to 7 on any parse error.
		days := 7
		if d := r.URL.Query().Get("days"); d != "" {
			if parsed, err := strconv.Atoi(d); err == nil {
				days = parsed
			}
		}

		claims, ok := middleware.ClaimsFromContext(r.Context())
		if !ok {
			log.Printf("availability: HandleGetUserAvailability: missing claims in context")
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		result, err := GetUserAvailability(pool, claims, userID, days)
		if err != nil {
			switch {
			case errors.Is(err, ErrUnauthorized):
				writeError(w, http.StatusForbidden, "access denied")
			default:
				log.Printf("availability: get user(%s): %v", userID, err)
				writeError(w, http.StatusInternalServerError, "failed to get availability")
			}
			return
		}

		writeJSON(w, http.StatusOK, result)
	}
}

// HandleGetTodayAvailability handles GET /api/v1/availability/today.
// Admin/superadmin only (enforced by middleware in routes.go).
// Returns all users' availability for today's date.
func HandleGetTodayAvailability(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		records, err := GetTodayAllUsers(pool)
		if err != nil {
			log.Printf("availability: get today all: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to get today's availability")
			return
		}

		writeJSON(w, http.StatusOK, records)
	}
}
