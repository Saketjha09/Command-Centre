package tasks

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/auth"
	notifs "github.com/saket/command-center/backend/internal/notifications"
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
		claims, ok := auth.ClaimsFromContext(r.Context())
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
		task, err := CreateTask(pool, cfg, claims, req)
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
		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			log.Printf("tasks: HandleListTasks: missing claims in context")
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		brand := r.URL.Query().Get("brand")
		status := r.URL.Query().Get("status")

		tasks, err := ListTasks(pool, claims, brand, status)
		if err != nil {
			switch {
			case errors.Is(err, ErrValidation):
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
		claims, _ := auth.ClaimsFromContext(r.Context())

		task, err := GetTask(pool, claims, id)
		if err != nil {
			switch {
			case errors.Is(err, ErrTaskNotFound):
				writeError(w, http.StatusNotFound, "task not found")
			default:
				log.Printf("tasks: get(%s): %v", id, err)
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get task: %v", err))
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

		claims, ok := auth.ClaimsFromContext(r.Context())
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

		go func(t TaskDetail) {
			if err := hub.BroadcastToRole("admin", "task:assigned", t); err != nil {
				slog.Error("ws: task:assigned admin", "error", err)
			}
			if err := hub.BroadcastToRole("superadmin", "task:assigned", t); err != nil {
				slog.Error("ws: task:assigned superadmin", "error", err)
			}
			if t.AssignedTo != nil {
				if err := hub.BroadcastToUser(*t.AssignedTo, "task:assigned", t); err != nil {
					slog.Error("ws: task:assigned user", "user_id", *t.AssignedTo, "error", err)
				}

				recipientID, parseErr := uuid.Parse(*t.AssignedTo)
				taskID, taskParseErr := uuid.Parse(t.ID)
				if parseErr == nil && taskParseErr == nil {
					if err := notifs.CreateAndBroadcast(
						context.Background(),
						pool,
						hub,
						notifs.CreateNotificationParams{
							RecipientID:   recipientID,
							Type:          "task_assigned",
							Title:         "New task assigned",
							Message:       fmt.Sprintf("You have been assigned: %s", t.Title),
							RelatedTaskID: &taskID,
						},
					); err != nil {
						slog.Error("notifications: task_assigned failed", "error", err, "task_id", t.ID)
					}
				}
			}
		}(task)
		writeJSON(w, http.StatusOK, task)

		// Fire notification AFTER the HTTP response is written — truly fire-and-forget.
		if task.AssignedTo != nil {
			go func(tid, uid, title, brand, deadline string) {
				var slackID *string
				err := pool.QueryRow(r.Context(), "SELECT slack_user_id FROM ops.users WHERE id = $1", uid).Scan(&slackID)
				if err != nil {
					log.Printf("notifications: failed to lookup slack_user_id for user %s: %v", uid, err)
					return
				}
				if slackID == nil || *slackID == "" {
					log.Printf("notifications: user %s has no slack_user_id configured", uid)
					return
				}

				notifs.DispatchTaskAssignmentNotification(
					pool, cfg,
					tid,
					*slackID,
					title,
					brand,
					deadline,
				)
			}(task.ID, *task.AssignedTo, task.Title, task.Brand, deadlineStr(task.Deadline))
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

		claims, ok := auth.ClaimsFromContext(r.Context())
		if !ok {
			slog.Error("tasks: HandleTransitionStatus: missing claims", "path", r.URL.Path)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		var req TransitionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		task, err := TransitionStatus(r.Context(), pool, claims, id, req.Status)
		if err != nil {
			switch {
			case errors.Is(err, ErrTaskNotFound):
				writeError(w, http.StatusNotFound, "task not found")
			case errors.Is(err, ErrForbidden):
				writeError(w, http.StatusForbidden, "insufficient permissions")
			case errors.Is(err, ErrInvalidTransition):
				writeError(w, http.StatusBadRequest, "invalid status transition")
			case errors.Is(err, ErrValidation):
				// Strip the internal sentinel prefix; send only the human-readable message.
				writeError(w, http.StatusBadRequest, strings.TrimPrefix(err.Error(), ErrValidation.Error()+": "))
			default:
				log.Printf("tasks: transition(%s → %s): %v", id, req.Status, err)
				writeError(w, http.StatusInternalServerError, "failed to transition status")
			}
			return
		}

		go func(t TaskDetail) {
			if err := hub.BroadcastToRole("admin", "task:status_changed", t); err != nil {
				slog.Error("ws: task:status_changed admin", "error", err)
			}
			if err := hub.BroadcastToRole("superadmin", "task:status_changed", t); err != nil {
				slog.Error("ws: task:status_changed superadmin", "error", err)
			}

			if t.Status == TaskStatusInReview {
				creatorID, parseErr := uuid.Parse(t.CreatedBy)
				taskID, taskParseErr := uuid.Parse(t.ID)
				if parseErr == nil && taskParseErr == nil {
					if err := notifs.CreateAndBroadcast(
						context.Background(),
						pool,
						hub,
						notifs.CreateNotificationParams{
							RecipientID:   creatorID,
							Type:          "task_status_changed",
							Title:         "Task ready for review",
							Message:       fmt.Sprintf("%s is ready for review", t.Title),
							RelatedTaskID: &taskID,
						},
					); err != nil {
						slog.Error("notifications: task_status_changed failed", "error", err, "task_id", t.ID)
					}
				}
			}
		}(task)
		writeJSON(w, http.StatusOK, task)
	}
}

// HandleListTaskHistory handles GET /api/v1/tasks/{id}/history.
func HandleListTaskHistory(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		history, err := ListTaskHistory(pool, id)
		if err != nil {
			log.Printf("tasks: history(%s): %v", id, err)
			writeError(w, http.StatusInternalServerError, "failed to get task history")
			return
		}
		writeJSON(w, http.StatusOK, history)
	}
}

// HandleGlobalActivity handles GET /api/v1/activity.
func HandleGlobalActivity(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := auth.ClaimsFromContext(r.Context())
		history, err := listGlobalActivity(pool, claims, 20)
		if err != nil {
			log.Printf("tasks: global activity: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to get activity")
			return
		}
		writeJSON(w, http.StatusOK, history)
	}
}

// HandleSearch handles GET /api/v1/search.
func HandleSearch(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		results, err := GlobalSearch(pool, q)
		if err != nil {
			log.Printf("tasks: search(%s): %v", q, err)
			writeError(w, http.StatusInternalServerError, "search failed")
			return
		}
		writeJSON(w, http.StatusOK, SearchResponse{Results: results})
	}
}

// HandleDashboardMetrics handles GET /api/v1/dashboard/metrics.
func HandleDashboardMetrics(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		metrics, err := GetDashboardMetrics(pool)
		if err != nil {
			log.Printf("tasks: dashboard metrics: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to get dashboard metrics")
			return
		}
		writeJSON(w, http.StatusOK, metrics)
	}
}
