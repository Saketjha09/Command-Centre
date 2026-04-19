package middleware

import "net/http"

// Chain composes a stack of middlewares into a single middleware.
// Middlewares are applied in left-to-right order so the first argument
// is the outermost (first to execute on a request, last on a response).
//
// Example:
//
//	protected := middleware.Chain(
//	    middleware.Authenticate(cfg),
//	    middleware.RequireRole("admin"),
//	)
//	mux.Handle("GET /api/v1/admin/users", protected(usersHandler))
//
// The chain is built by iterating in reverse so that calling the returned
// handler executes middlewares in the declared order.
func Chain(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(final http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			final = middlewares[i](final)
		}
		return final
	}
}
