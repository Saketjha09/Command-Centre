package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/authutil"
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

		user, err := Register(r.Context(), pool, cfg, req)
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

// HandleCreateAdminUser handles POST /api/v1/auth/admin/users.
// Only accessible by superadmins (enforced by middleware).
func HandleCreateAdminUser(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := authutil.ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		actorID, _ := uuid.Parse(claims.UserID)

		var req struct {
			Name     string `json:"name"`
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		user, err := CreateAdminUser(r.Context(), pool, actorID, req.Name, req.Email, req.Password)
		if err != nil {
			switch {
			case errors.Is(err, ErrEmailTaken):
				writeError(w, http.StatusConflict, "email already registered")
			case errors.Is(err, ErrValidation):
				writeError(w, http.StatusBadRequest, err.Error())
			default:
				log.Printf("create admin: unexpected error: %v", err)
				writeError(w, http.StatusInternalServerError, "failed to create admin user")
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

		accessToken, refreshToken, user, err := Login(r.Context(), pool, cfg, req)
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

		writeJSON(w, http.StatusOK, map[string]any{
			"user":          user,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
		})
	}
}

// HandleMe handles GET /api/v1/auth/me.
// Validates the access_token cookie, extracts the UserID claim, fetches the
// live user row from the DB, and returns a client-safe UserResponse.
func HandleMe(pool *pgxpool.Pool, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "malformed token claims")
			return
		}

		// 4. Fetch live user — not from token (tokens can lag behind role changes).
		row, err := GetUserByID(r.Context(), pool, userID)
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
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
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
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "invalid user session")
			return
		}

		// 1. Apply MaxBytesReader FIRST (2MB limit)
		r.Body = http.MaxBytesReader(w, r.Body, 2<<20)

		// 2. Call ParseMultipartForm after the size cap is set
		if err := r.ParseMultipartForm(2 << 20); err != nil {
			writeError(w, http.StatusBadRequest, "file too large or invalid form")
			return
		}

		file, header, err := r.FormFile("avatar")
		if err != nil {
			writeError(w, http.StatusBadRequest, "no file uploaded")
			return
		}
		defer file.Close()

		// 3. Read first 512 bytes to detect real MIME type
		buf := make([]byte, 512)
		n, err := file.Read(buf)
		if err != nil && err != io.EOF {
			writeError(w, http.StatusInternalServerError, "failed to read file")
			return
		}
		buf = buf[:n]
		mimeType := http.DetectContentType(buf)

		// 4. Validate mimeType against whitelist
		allowedMime := map[string]bool{
			"image/jpeg": true,
			"image/png":  true,
			"image/webp": true,
		}
		if !allowedMime[mimeType] {
			writeError(w, http.StatusBadRequest, "invalid file type: only jpg, png, and webp are allowed")
			return
		}

		// 5. Validate file extension (case-insensitive)
		ext := strings.ToLower(filepath.Ext(header.Filename))
		allowedExt := map[string]bool{
			".jpg":  true,
			".jpeg": true,
			".png":  true,
			".webp": true,
		}
		if !allowedExt[ext] {
			writeError(w, http.StatusBadRequest, "invalid file extension")
			return
		}

		// 6. Save the file using temp file + atomic rename
		uploadDir := filepath.Join("uploads", "avatars")
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			log.Printf("auth: avatar mkdir: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to prepare storage")
			return
		}

		// 7. Filename saved to disk must be userID + extension only
		filename := fmt.Sprintf("%s%s", userID.String(), ext)
		savePath := filepath.Join(uploadDir, filename)
		publicURL := fmt.Sprintf("/uploads/avatars/%s", filename)

		tmpFile, err := os.CreateTemp(uploadDir, "avatar-*.tmp")
		if err != nil {
			log.Printf("auth: avatar temp create: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to process avatar")
			return
		}
		tmpPath := tmpFile.Name()
		defer os.Remove(tmpPath)

		fullReader := io.MultiReader(bytes.NewReader(buf), file)
		if _, err := io.Copy(tmpFile, fullReader); err != nil {
			tmpFile.Close()
			log.Printf("auth: avatar copy: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to process avatar")
			return
		}
		tmpFile.Close()

		if err := os.Rename(tmpPath, savePath); err != nil {
			log.Printf("auth: avatar rename: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to save avatar")
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
