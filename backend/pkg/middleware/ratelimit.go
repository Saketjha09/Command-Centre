package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateLimiter struct {
	mu      sync.Mutex
	clients map[string][]time.Time
	maxReqs int
	window  time.Duration
}

func newRateLimiter(maxReqs int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		clients: make(map[string][]time.Time),
		maxReqs: maxReqs,
		window:  window,
	}

	// Background cleanup goroutine
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("PANIC in rateLimiter cleanup: %v", r)
			}
		}()

		for {
			time.Sleep(5 * time.Minute)
			rl.cleanup()
		}
	}()

	return rl
}

func (rl *rateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for ip, timestamps := range rl.clients {
		valid := make([]time.Time, 0)
		for _, t := range timestamps {
			if now.Sub(t) < rl.window {
				valid = append(valid, t)
			}
		}
		if len(valid) == 0 {
			delete(rl.clients, ip)
		} else {
			rl.clients[ip] = valid
		}
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	timestamps := rl.clients[ip]
	
	valid := make([]time.Time, 0)
	for _, t := range timestamps {
		if now.Sub(t) < rl.window {
			valid = append(valid, t)
		}
	}
	
	if len(valid) >= rl.maxReqs {
		rl.clients[ip] = valid
		return false
	}
	
	rl.clients[ip] = append(valid, now)
	return true
}

func getIP(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}
	// X-Forwarded-For can be a comma separated list, use the first one
	if strings.Contains(ip, ",") {
		ip = strings.Split(ip, ",")[0]
	}
	// Strip port
	if idx := strings.LastIndex(ip, ":"); idx != -1 && !strings.HasPrefix(ip, "[") || strings.HasSuffix(ip, "]") {
		// IPv6 wrapping check e.g., [::1]:8080
		if strings.HasPrefix(ip, "[") && strings.Contains(ip, "]:") {
			ip = ip[:strings.LastIndex(ip, ":")]
		} else {
			ip = ip[:idx]
		}
	}
	
	ip = strings.TrimSpace(ip)
	ip = strings.Trim(ip, "[]")
	return ip
}

// RateLimit returns middleware that allows maxReqs requests
// per window duration per IP address.
func RateLimit(maxReqs int, window time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(maxReqs, window)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getIP(r)
			if !rl.allow(ip) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "too many requests, please try again later",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
