package payroll

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/internal/auth"
)

func mapError(err error) int {
	switch {
	case errors.Is(err, ErrEditorNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrRateNotSet):
		return http.StatusUnprocessableEntity
	case errors.Is(err, ErrRunNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrAlreadyPaid):
		return http.StatusConflict
	case errors.Is(err, ErrNoEligibleTasks):
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func HandleUpsertRate(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		editorID := r.PathValue("editorID")
		var req UpsertRateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		err := UpsertEditorRate(r.Context(), pool, editorID, req)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}

		rates, err := GetEditorRates(r.Context(), pool, editorID)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}

		writeJSON(w, http.StatusOK, rates)
	}
}

func HandleGetEditorRates(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		editorID := r.PathValue("editorID")
		rates, err := GetEditorRates(r.Context(), pool, editorID)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, rates)
	}
}

func HandleGetAllRates(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rates, err := GetAllEditorRates(r.Context(), pool)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, rates)
	}
}

func HandlePreviewPayroll(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req RunPayrollRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		detail, err := PreviewPayroll(r.Context(), pool, req)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}

		writeJSON(w, http.StatusOK, detail)
	}
}

func HandleCreatePayrollRun(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			slog.Error("payroll: HandleCreatePayrollRun: missing claims")
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		var req RunPayrollRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		run, err := CreatePayrollRun(r.Context(), pool, req, claims.UserID)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}

		writeJSON(w, http.StatusCreated, run)
	}
}

func HandleMarkPaid(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		runID := r.PathValue("runID")

		run, err := MarkPaid(r.Context(), pool, runID)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}

		writeJSON(w, http.StatusOK, run)
	}
}

func HandleGetPayrollRuns(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		editorID := r.URL.Query().Get("editor_id")
		runs, err := GetPayrollRuns(r.Context(), pool, editorID)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, runs)
	}
}

func HandleGetPayrollRunDetail(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		runID := r.PathValue("runID")
		detail, err := GetPayrollRunDetail(r.Context(), pool, runID)
		if err != nil {
			writeError(w, mapError(err), err.Error())
			return
		}
		writeJSON(w, http.StatusOK, detail)
	}
}
