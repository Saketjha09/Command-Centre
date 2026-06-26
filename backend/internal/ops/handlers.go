package ops

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/auth"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func HandleListTasks(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		tasks, err := ListTasks(r.Context(), pool, claims.UserID, string(claims.Role))
		if err != nil {
			slog.Error("ops: list tasks", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to list tasks")
			return
		}

		writeJSON(w, http.StatusOK, tasks)
	}
}

func HandleCreateTask(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var callerName string
		_ = pool.QueryRow(r.Context(), `SELECT name FROM ops.users WHERE id = $1`, claims.UserID).Scan(&callerName)

		var req CreateTaskRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		task, err := CreateTask(r.Context(), pool, claims.UserID, callerName, req)
		if err != nil {
			msg := err.Error()
			if msg == "brief is required" || msg == "assignee_id is required" || msg == "invalid assignee_id" || msg == "assignee not found" {
				writeError(w, http.StatusBadRequest, msg)
			} else {
				slog.Error("ops: create task", "error", err)
				writeError(w, http.StatusInternalServerError, "failed to create task")
			}
			return
		}

		writeJSON(w, http.StatusCreated, task)
	}
}

func HandleUpdateStatus(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		taskID := r.PathValue("id")
		if taskID == "" {
			writeError(w, http.StatusBadRequest, "missing task id")
			return
		}

		var req UpdateStatusRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		err := UpdateStatus(r.Context(), pool, taskID, claims.UserID, string(claims.Role), req.Status)
		if err != nil {
			msg := err.Error()
			switch msg {
			case "task not found", "invalid task id":
				writeError(w, http.StatusNotFound, msg)
			case "forbidden":
				writeError(w, http.StatusForbidden, "you can only update your own tasks")
			default:
				if msg == "invalid status: "+string(req.Status) {
					writeError(w, http.StatusBadRequest, msg)
				} else {
					slog.Error("ops: update status", "error", err)
					writeError(w, http.StatusInternalServerError, "failed to update status")
				}
			}
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

func HandleListTeamMembers(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		members, err := ListTeamMembers(r.Context(), pool)
		if err != nil {
			slog.Error("ops: list team", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to list team members")
			return
		}

		writeJSON(w, http.StatusOK, members)
	}
}

func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	authOnly := auth.Authenticate(cfg)
	adminOnly := middleware.Chain(
		auth.Authenticate(cfg),
		middleware.RequireRole("superadmin", "admin"),
	)

	mux.Handle("GET /api/v1/ops/tasks",
		authOnly(http.HandlerFunc(HandleListTasks(pool))))

	mux.Handle("POST /api/v1/ops/tasks",
		adminOnly(http.HandlerFunc(HandleCreateTask(pool))))

	mux.Handle("PATCH /api/v1/ops/tasks/{id}/status",
		authOnly(http.HandlerFunc(HandleUpdateStatus(pool))))

	mux.Handle("GET /api/v1/ops/team-members",
		adminOnly(http.HandlerFunc(HandleListTeamMembers(pool))))
}
