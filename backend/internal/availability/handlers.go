package availability

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/pkg/config"
	"log/slog"
	"time"
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

		claims, ok := auth.ClaimsFromContext(r.Context())
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

		claims, ok := auth.ClaimsFromContext(r.Context())
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
// Admin/superadmin see all; freelancers see only their own.
func HandleGetTodayAvailability(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			log.Printf("availability: HandleGetTodayAvailability: missing claims in context")
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		records, err := GetTodayAllUsers(pool, claims)
		if err != nil {
			log.Printf("availability: get today all: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to get today's availability")
			return
		}

		writeJSON(w, http.StatusOK, records)
	}
}

// HandleSetAvailable handles POST /api/v1/availability.
func HandleSetAvailable(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var req ToggleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		result, err := SetSlotAvailable(pool, claims, req.Date, req.Slot)
		if err != nil {
			if errors.Is(err, ErrValidation) {
				writeError(w, http.StatusBadRequest, err.Error())
			} else {
				log.Printf("availability: set available: %v", err)
				writeError(w, http.StatusInternalServerError, "failed to update availability")
			}
			return
		}

		writeJSON(w, http.StatusOK, result)
	}
}

// HandleSetOffline handles DELETE /api/v1/availability.
func HandleSetOffline(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var req ToggleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if err := SetSlotOffline(pool, claims, req.Date, req.Slot); err != nil {
			if errors.Is(err, ErrValidation) {
				writeError(w, http.StatusBadRequest, err.Error())
			} else {
				log.Printf("availability: set offline: %v", err)
				writeError(w, http.StatusInternalServerError, "failed to update availability")
			}
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// HandleGetAdminAvailabilityGrid handles GET /api/v1/availability/grid.
func HandleGetAdminAvailabilityGrid(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		response, err := GetAdminAvailabilityGrid(r.Context(), pool, time.Now().UTC())
		if err != nil {
			slog.Error("failed to fetch availability grid", "error", err, "path", r.URL.Path, "user_id", claims.UserID)
			writeError(w, http.StatusInternalServerError, "failed to fetch availability grid")
			return
		}

		writeJSON(w, http.StatusOK, response)
	}
}
