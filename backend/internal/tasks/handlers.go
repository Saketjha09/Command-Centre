package tasks

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/notifications"
	"github.com/saket/command-center/backend/pkg/config"
	"github.com/saket/command-center/backend/pkg/middleware"
)

// ── JSON helpers ──────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ── handlers ──────────────────────────────────────────────────────────────────

// HandleCreateTask handles POST /api/v1/tasks (admin/superadmin only).
func HandleCreateTask(pool *pgxpool.Pool, cfg *config.Config, hub WSBroadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Extract claims — guaranteed by adminOnly middleware, but we guard anyway.
		claims, ok := middleware.ClaimsFromContext(r.Context())
		if !ok {
			log.Printf("tasks: HandleCreateTask: missing claims in context")
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		// 2. Decode request body.
		var req CreateTaskRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		// 3. Delegate to service.
		task, err := CreateTask(pool, claims, req)
		if err != nil {
			switch {
			case errors.Is(err, ErrValidation):
				// Strip the internal sentinel prefix; send only the human-readable message.
				writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrValidation.Error()+": "))
			default:
				log.Printf("tasks: create: %v", err)
				writeError(w, http.StatusInternalServerError, "failed to create task")
			}
			return
		}

		BroadcastTaskCreated(hub, task)
		writeJSON(w, http.StatusCreated, task)
	}
}

// HandleListTasks handles GET /api/v1/tasks (any authenticated user).
func HandleListTasks(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		brand := r.URL.Query().Get("brand")
		status := r.URL.Query().Get("status")

		tasks, err := ListTasks(pool, brand, status)
		if err != nil {
			switch {
			case errors.Is(err, ErrValidation):
				// Strip the internal sentinel prefix; send only the human-readable message.
				writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrValidation.Error()+": "))
			default:
				log.Printf("tasks: list: %v", err)
				writeError(w, http.StatusInternalServerError, "failed to list tasks")
			}
			return
		}

		writeJSON(w, http.StatusOK, tasks)
	}
}

// HandleGetTask handles GET /api/v1/tasks/{id} (any authenticated user).
func HandleGetTask(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		task, err := GetTask(pool, id)
		if err != nil {
			switch {
			case errors.Is(err, ErrTaskNotFound):
				writeError(w, http.StatusNotFound, "task not found")
			default:
				log.Printf("tasks: get(%s): %v", id, err)
				writeError(w, http.StatusInternalServerError, "failed to get task")
			}
			return
		}

		writeJSON(w, http.StatusOK, task)
	}
}

// HandleAssignTask handles PATCH /api/v1/tasks/{id}/assign (admin/superadmin only).
func HandleAssignTask(pool *pgxpool.Pool, cfg *config.Config, hub WSBroadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		claims, ok := middleware.ClaimsFromContext(r.Context())
		if !ok {
			log.Printf("tasks: HandleAssignTask: missing claims in context")
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		var req AssignTaskRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		task, err := AssignTask(pool, claims, id, req.UserID)
		if err != nil {
			switch {
			case errors.Is(err, ErrTaskNotFound):
				writeError(w, http.StatusNotFound, "task not found")
			case errors.Is(err, ErrAlreadyAssigned):
				writeError(w, http.StatusConflict, "task is already assigned")
			case errors.Is(err, ErrValidation):
				// Strip the internal sentinel prefix; send only the human-readable message.
				writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrValidation.Error()+": "))
			default:
				log.Printf("tasks: assign(%s): %v", id, err)
				writeError(w, http.StatusInternalServerError, "failed to assign task")
			}
			return
		}

		BroadcastTaskAssigned(hub, task)
		writeJSON(w, http.StatusOK, task)

		// Fire notification AFTER the HTTP response is written — truly fire-and-forget.
		if task.AssignedTo != nil {
			// Phase 2: pass the user UUID as the Slack channel ID.
			// TODO Phase 3: look up slack_user_id from ops.users before dispatching.
			notifications.DispatchTaskAssignmentNotification(
				pool, cfg,
				task.ID,
				*task.AssignedTo,
				task.Title,
				task.Brand,
				deadlineStr(task.Deadline),
			)
		}
	}
}

// deadlineStr formats a nullable deadline pointer for use in notification messages.
func deadlineStr(t *time.Time) string {
	if t == nil {
		return "No deadline set"
	}
	return t.Format("2006-01-02")
}

// HandleTransitionStatus handles PATCH /api/v1/tasks/{id}/status (admin/superadmin only).
func HandleTransitionStatus(pool *pgxpool.Pool, cfg *config.Config, hub WSBroadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		claims, ok := middleware.ClaimsFromContext(r.Context())
		if !ok {
			log.Printf("tasks: HandleTransitionStatus: missing claims in context")
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		var req TransitionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		task, err := TransitionStatus(pool, claims, id, req.Status)
		if err != nil {
			switch {
			case errors.Is(err, ErrTaskNotFound):
				writeError(w, http.StatusNotFound, "task not found")
			case errors.Is(err, ErrInvalidTransition):
				writeError(w, http.StatusUnprocessableEntity, "invalid status transition")
			case errors.Is(err, ErrValidation):
				// Strip the internal sentinel prefix; send only the human-readable message.
				writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrValidation.Error()+": "))
			default:
				log.Printf("tasks: transition(%s → %s): %v", id, req.Status, err)
				writeError(w, http.StatusInternalServerError, "failed to transition status")
			}
			return
		}

		BroadcastStatusChanged(hub, task)
		writeJSON(w, http.StatusOK, task)
	}
}
