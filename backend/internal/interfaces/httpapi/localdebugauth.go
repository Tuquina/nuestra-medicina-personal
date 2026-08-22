package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
)

// This file is the entire surface of the local-debug admin bypass — every
// place it takes effect lives here or is a single call into here, so the
// whole thing is auditable by reading one file. It is armed only when
// config.Config.LocalDebugAuth() is true, which requires both
// LOCAL_ADMIN_BYPASS=true *and* APP_ENV != "production" (see that method's
// doc comment for why two independent conditions, not one).

// localDebugUserID is the synthetic identity every bypassed request runs
// as. It is intentionally unlike any real Google "sub" or database UUID,
// so it's unmistakable in logs if it ever shows up somewhere unexpected.
const localDebugUserID = "local-debug-admin"

func localDebugUser() auth.User {
	now := time.Now()
	return auth.User{
		ID:          localDebugUserID,
		Email:       "admin@localhost",
		DisplayName: "Administrador (modo local)",
		IsAdmin:     true,
		CreatedAt:   now,
		LastLoginAt: now,
	}
}

// bypassAdmin skips the cookie/AuthorizeAdmin check entirely and runs next
// as the synthetic local admin.
func bypassAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		setRequestUserID(r.Context(), localDebugUserID)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey, localDebugUserID)))
	})
}

// bypassUser skips the cookie/CurrentUser check entirely and runs next as
// the synthetic local admin — every session-gated route resolves to an
// administrator here, since the whole point is opening /admin without a
// real login, not modelling a non-admin logged-in user.
func bypassUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := localDebugUser()
		setRequestUserID(r.Context(), user.ID)
		ctx := context.WithValue(r.Context(), userIDKey, user.ID)
		ctx = context.WithValue(ctx, currentUserKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
