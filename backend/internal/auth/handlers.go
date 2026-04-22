package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/config"
)

// Cookie path constants — used in both HandleLogin (set) and HandleLogout (clear).
// Keeping them as constants prevents the paths from drifting apart, which would
// cause the browser to silently ignore MaxAge: -1 on logout.
const (
	cookiePathAccess  = "/"
	cookiePathRefresh = "/api/v1/auth/refresh"
)

// writeJSON writes v as JSON with the given HTTP status.
// Always sets Content-Type before WriteHeader to avoid header-already-sent issues.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes a JSON error envelope: {"error": "<message>"}.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// HandleRegister handles POST /api/v1/auth/register.
// 201 on success. 409 on duplicate email. 400 on validation failure.
func HandleRegister(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		user, err := Register(pool, cfg, req)
		if err != nil {
			switch {
			case errors.Is(err, ErrEmailTaken):
				writeError(w, http.StatusConflict, "email already registered")
			case errors.Is(err, ErrValidation):
				// Safe to forward — message is a controlled string from service.Register.
				writeError(w, http.StatusBadRequest, err.Error())
			default:
				// Unexpected system error (bcrypt failure, etc.) — log server-side only.
				log.Printf("register: unexpected error: %v", err)
				writeError(w, http.StatusInternalServerError, "registration failed")
			}
			return
		}

		writeJSON(w, http.StatusCreated, user)
	}
}

// HandleLogin handles POST /api/v1/auth/login.
// On success, sets httpOnly secure cookies for access_token and refresh_token.
// 401 on bad credentials. 500 on unexpected server errors.
func HandleLogin(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		accessToken, refreshToken, user, err := Login(pool, cfg, req)
		if err != nil {
			if errors.Is(err, ErrInvalidCredentials) {
				writeError(w, http.StatusUnauthorized, "invalid credentials")
				return
			}
			log.Printf("login: unexpected error: %v", err)
			writeError(w, http.StatusInternalServerError, "login failed")
			return
		}

		// Access token cookie: 15 minutes, accessible on all paths.
		http.SetCookie(w, &http.Cookie{
			Name:     "access_token",
			Value:    accessToken,
			HttpOnly: true,
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   900, // 15 * 60
			Path:     cookiePathAccess,
		})

		// Refresh token cookie: 7 days, scoped to the refresh endpoint only.
		http.SetCookie(w, &http.Cookie{
			Name:     "refresh_token",
			Value:    refreshToken,
			HttpOnly: true,
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   604800, // 7 * 24 * 60 * 60
			Path:     cookiePathRefresh,
		})

		writeJSON(w, http.StatusOK, user)
	}
}

// HandleMe handles GET /api/v1/auth/me.
// Validates the access_token cookie, extracts the UserID claim, fetches the
// live user row from the DB, and returns a client-safe UserResponse.
func HandleMe(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Read access token from cookie.
		cookie, err := r.Cookie("access_token")
		if err != nil {
			writeError(w, http.StatusUnauthorized, "missing access token")
			return
		}

		// 2. Parse and validate the JWT.
		claims, err := ValidateAccessToken(cfg, cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		// 3. Parse the UserID UUID from claims.
		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "malformed token claims")
			return
		}

		// 4. Fetch live user — not from token (tokens can lag behind role changes).
		row, err := GetUserByID(context.Background(), pool, userID)
		if err != nil {
			if errors.Is(err, ErrUserNotFound) {
				// User was deleted after the token was issued.
				writeError(w, http.StatusUnauthorized, "user not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to fetch user")
			return
		}

		writeJSON(w, http.StatusOK, userRowToResponse(row))
	}
}

// HandleLogout handles POST /api/v1/auth/logout.
// Clears both auth cookies by setting MaxAge=-1 (immediate browser expiry).
func HandleLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     "access_token",
			Value:    "",
			HttpOnly: true,
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
			Path:     cookiePathAccess,
		})
		http.SetCookie(w, &http.Cookie{
			Name:     "refresh_token",
			Value:    "",
			HttpOnly: true,
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
			Path:     cookiePathRefresh,
		})
		writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
	}
}

// HandleListUsers handles GET /api/v1/users.
// Validates the access_token and returns a list of client-safe UserResponses.
func HandleListUsers(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := ListUsers(r.Context(), pool)
		if err != nil {
			log.Printf("users: list: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to list users")
			return
		}

		var resp []UserResponse
		// Convert to client safe response
		for _, row := range rows {
			resp = append(resp, userRowToResponse(row))
		}

		writeJSON(w, http.StatusOK, resp)
	}
}

// HandleUpdateProfile handles PATCH /api/v1/auth/me.
func HandleUpdateProfile(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("access_token")
		if err != nil {
			writeError(w, http.StatusUnauthorized, "missing access token")
			return
		}

		claims, err := ValidateAccessToken(cfg, cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		userID, _ := uuid.Parse(claims.UserID)

		var req struct {
			Name  string `json:"name"`
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		row, err := UpdateUser(r.Context(), pool, userID, req.Name, req.Email)
		if err != nil {
			log.Printf("auth: update profile: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to update profile")
			return
		}

		writeJSON(w, http.StatusOK, userRowToResponse(row))
	}
}

// HandleUploadAvatar handles POST /api/v1/auth/avatar.
func HandleUploadAvatar(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("access_token")
		if err != nil {
			writeError(w, http.StatusUnauthorized, "missing access token")
			return
		}

		claims, err := ValidateAccessToken(cfg, cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		userID, _ := uuid.Parse(claims.UserID)

		// 1MB max file size
		r.ParseMultipartForm(1 << 20)
		file, header, err := r.FormFile("avatar")
		if err != nil {
			writeError(w, http.StatusBadRequest, "no file uploaded")
			return
		}
		defer file.Close()

		// Ensure directory exists
		uploadDir := filepath.Join("uploads", "avatars")
		os.MkdirAll(uploadDir, 0755)

		// Create unique filename
		ext := filepath.Ext(header.Filename)
		filename := fmt.Sprintf("%s%s", userID.String(), ext)
		savePath := filepath.Join(uploadDir, filename)
		publicURL := fmt.Sprintf("/uploads/avatars/%s", filename)

		// Save to disk
		out, err := os.Create(savePath)
		if err != nil {
			log.Printf("auth: avatar upload: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to save avatar")
			return
		}
		defer out.Close()

		if _, err := io.Copy(out, file); err != nil {
			log.Printf("auth: avatar copy: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to process avatar")
			return
		}

		// Update DB
		row, err := UpdateUserAvatar(r.Context(), pool, userID, publicURL)
		if err != nil {
			log.Printf("auth: avatar db update: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to update user avatar")
			return
		}

		writeJSON(w, http.StatusOK, userRowToResponse(row))
	}
}
