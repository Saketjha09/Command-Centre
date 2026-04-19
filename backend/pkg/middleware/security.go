package middleware

import "net/http"

// SecurityHeaders sets generic baseline production security header profiles explicitly to lock away content leaks natively.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; "+
			"script-src 'self' 'unsafe-inline'; "+
			"style-src 'self' 'unsafe-inline'; "+
			"connect-src 'self' wss:; "+
			"img-src 'self' data:;")
		next.ServeHTTP(w, r)
	})
}
