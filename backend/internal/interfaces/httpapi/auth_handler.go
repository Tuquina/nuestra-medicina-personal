package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/application/authentication"
	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
)

const (
	stateCookieName    = "nmp_oauth_state"
	nonceCookieName    = "nmp_oidc_nonce"
	verifierCookieName = "nmp_pkce_verifier"
)

type AuthenticationService interface {
	Start() (authentication.Flow, error)
	Complete(context.Context, string, string, string, string, string) (auth.User, auth.Session, error)
	CurrentUser(context.Context, string) (auth.User, error)
	Logout(context.Context, string) error
	DeleteAccount(context.Context, string) error
	FlowTTL() time.Duration
}

type AuthHandler struct {
	service       AuthenticationService
	logger        *slog.Logger
	baseURL       string
	sessionCookie string
	secureCookies bool
}

func NewAuthHandler(service AuthenticationService, logger *slog.Logger, baseURL, sessionCookie string, secureCookies bool) *AuthHandler {
	return &AuthHandler{
		service: service, logger: logger, baseURL: strings.TrimRight(baseURL, "/"),
		sessionCookie: sessionCookie, secureCookies: secureCookies,
	}
}

func (h *AuthHandler) Start(w http.ResponseWriter, r *http.Request) {
	flow, err := h.service.Start()
	if err != nil {
		h.handleError(w, r, "start authentication", err, false)
		return
	}
	expiresAt := time.Now().Add(h.service.FlowTTL())
	h.setFlowCookie(w, stateCookieName, flow.State, expiresAt)
	h.setFlowCookie(w, nonceCookieName, flow.Nonce, expiresAt)
	h.setFlowCookie(w, verifierCookieName, flow.Verifier, expiresAt)
	http.Redirect(w, r, flow.AuthorizationURL, http.StatusFound)
}

func (h *AuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	state := cookieValue(r, stateCookieName)
	nonce := cookieValue(r, nonceCookieName)
	verifier := cookieValue(r, verifierCookieName)
	h.clearFlowCookies(w)
	if providerError := r.URL.Query().Get("error"); providerError != "" {
		h.logger.Info("google authentication cancelled", "request_id", requestID(r.Context()), "provider_error", providerError)
		http.Redirect(w, r, h.baseURL+"/login?error=google_auth_cancelled", http.StatusFound)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	_, session, err := h.service.Complete(
		ctx, r.URL.Query().Get("code"), r.URL.Query().Get("state"), state, nonce, verifier,
	)
	if err != nil {
		h.handleError(w, r, "complete authentication", err, true)
		return
	}
	maxAge := int(time.Until(session.ExpiresAt).Seconds())
	http.SetCookie(w, &http.Cookie{
		Name: h.sessionCookie, Value: session.Token, Path: "/", Expires: session.ExpiresAt,
		MaxAge: maxAge, HttpOnly: true, Secure: h.secureCookies, SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, h.baseURL+"/biblioteca", http.StatusFound)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user, err := h.service.CurrentUser(r.Context(), cookieValue(r, h.sessionCookie))
	if err != nil {
		h.handleError(w, r, "get current user", err, false)
		return
	}
	writeJSON(w, http.StatusOK, userResponse{
		ID: user.ID, Email: user.Email, DisplayName: user.DisplayName,
		PictureURL: user.PictureURL, IsAdmin: user.IsAdmin,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Logout(r.Context(), cookieValue(r, h.sessionCookie)); err != nil {
		h.handleError(w, r, "revoke session", err, false)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: h.sessionCookie, Value: "", Path: "/", MaxAge: -1, Expires: time.Unix(1, 0),
		HttpOnly: true, Secure: h.secureCookies, SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusNoContent, nil)
}

// DeleteAccount soft-deletes the signed-in user (see
// authentication.Service.DeleteAccount) and clears the session cookie the
// same way Logout does, so the browser doesn't keep sending a now-revoked
// session token.
func (h *AuthHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	if err := h.service.DeleteAccount(r.Context(), userID(r.Context())); err != nil {
		h.handleError(w, r, "delete account", err, false)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: h.sessionCookie, Value: "", Path: "/", MaxAge: -1, Expires: time.Unix(1, 0),
		HttpOnly: true, Secure: h.secureCookies, SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *AuthHandler) setFlowCookie(w http.ResponseWriter, name, value string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: value, Path: "/api/v1/auth/google/callback", Expires: expires,
		MaxAge: int(h.service.FlowTTL().Seconds()), HttpOnly: true, Secure: h.secureCookies,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *AuthHandler) clearFlowCookies(w http.ResponseWriter) {
	for _, name := range []string{stateCookieName, nonceCookieName, verifierCookieName} {
		http.SetCookie(w, &http.Cookie{
			Name: name, Value: "", Path: "/api/v1/auth/google/callback", MaxAge: -1,
			Expires: time.Unix(1, 0), HttpOnly: true, Secure: h.secureCookies, SameSite: http.SameSiteLaxMode,
		})
	}
}

func (h *AuthHandler) handleError(w http.ResponseWriter, r *http.Request, operation string, err error, providerBoundary bool) {
	switch {
	case errors.Is(err, auth.ErrNotConfigured):
		writeError(w, http.StatusServiceUnavailable, "AUTH_NOT_CONFIGURED", "Google authentication is not configured", nil)
	case errors.Is(err, auth.ErrInvalidFlow):
		writeError(w, http.StatusBadRequest, "INVALID_AUTH_FLOW", "Authentication flow is invalid or expired", nil)
	case errors.Is(err, auth.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "Authentication is required", nil)
	default:
		h.logger.Error(operation, "request_id", requestID(r.Context()), "error", err)
		if providerBoundary {
			writeError(w, http.StatusBadGateway, "AUTH_PROVIDER_ERROR", "Authentication could not be completed", nil)
			return
		}
		writeError(w, http.StatusInternalServerError, "AUTH_INTERNAL_ERROR", "Authentication could not be processed", nil)
	}
}

func cookieValue(r *http.Request, name string) string {
	cookie, err := r.Cookie(name)
	if err != nil {
		return ""
	}
	return cookie.Value
}

type userResponse struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	PictureURL  string `json:"pictureUrl"`
	IsAdmin     bool   `json:"isAdmin"`
}
