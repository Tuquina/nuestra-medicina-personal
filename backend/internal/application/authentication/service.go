package authentication

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
)

type Provider interface {
	Configured() bool
	AuthorizationURL(state, nonce, verifier string) string
	Exchange(context.Context, string, string, string) (auth.Identity, error)
	NewVerifier() string
}

type Repository interface {
	CreateSession(context.Context, auth.Identity, auth.Session, time.Time) (auth.User, error)
	GetUserByTokenHash(context.Context, string, string) (auth.User, error)
	RevokeSession(context.Context, string, time.Time) error
	DeleteAccount(context.Context, string, time.Time) error
}

type Flow struct {
	State            string
	Nonce            string
	Verifier         string
	AuthorizationURL string
}

type Service struct {
	provider       Provider
	repository     Repository
	adminGoogleSub string
	sessionTTL     time.Duration
	flowTTL        time.Duration
	now            func() time.Time
}

func NewService(provider Provider, repository Repository, adminGoogleSub string, sessionTTL time.Duration) *Service {
	return &Service{
		provider: provider, repository: repository, adminGoogleSub: adminGoogleSub,
		sessionTTL: sessionTTL, flowTTL: 10 * time.Minute, now: time.Now,
	}
}

func (s *Service) Start() (Flow, error) {
	if !s.provider.Configured() {
		return Flow{}, auth.ErrNotConfigured
	}
	state, err := randomToken(32)
	if err != nil {
		return Flow{}, fmt.Errorf("generate oauth state: %w", err)
	}
	nonce, err := randomToken(32)
	if err != nil {
		return Flow{}, fmt.Errorf("generate oidc nonce: %w", err)
	}
	verifier := s.provider.NewVerifier()
	return Flow{
		State: state, Nonce: nonce, Verifier: verifier,
		// AuthorizationURL (oidc.go) hands this straight to
		// oauth2.S256ChallengeOption, which hashes it itself -- passing an
		// already-hashed challenge here double-hashes it, so Google can
		// never match it back against the raw verifier sent at Exchange
		// time. That was exactly this bug, invisible to unit tests because
		// the provider stub never did the real crypto (see
		// service_test.go) -- only surfaced against the real Google server.
		AuthorizationURL: s.provider.AuthorizationURL(state, nonce, verifier),
	}, nil
}

func (s *Service) Complete(ctx context.Context, code, state, expectedState, nonce, verifier string) (auth.User, auth.Session, error) {
	if !s.provider.Configured() {
		return auth.User{}, auth.Session{}, auth.ErrNotConfigured
	}
	if code == "" || !secureEqual(state, expectedState) || nonce == "" || verifier == "" {
		return auth.User{}, auth.Session{}, auth.ErrInvalidFlow
	}
	identity, err := s.provider.Exchange(ctx, code, nonce, verifier)
	if err != nil {
		return auth.User{}, auth.Session{}, fmt.Errorf("exchange google identity: %w", err)
	}
	if identity.GoogleSubject == "" || identity.Email == "" || !identity.EmailVerified {
		return auth.User{}, auth.Session{}, auth.ErrUnauthorized
	}
	rawToken, err := randomToken(32)
	if err != nil {
		return auth.User{}, auth.Session{}, fmt.Errorf("generate session token: %w", err)
	}
	now := s.now().UTC()
	sessionID, err := newUUID()
	if err != nil {
		return auth.User{}, auth.Session{}, fmt.Errorf("generate session id: %w", err)
	}
	session := auth.Session{ID: sessionID, Token: rawToken, TokenHash: hashToken(rawToken), ExpiresAt: now.Add(s.sessionTTL)}
	user, err := s.repository.CreateSession(ctx, identity, session, now)
	if err != nil {
		return auth.User{}, auth.Session{}, fmt.Errorf("persist authenticated session: %w", err)
	}
	user.IsAdmin = identity.GoogleSubject == s.adminGoogleSub && s.adminGoogleSub != ""
	return user, session, nil
}

func (s *Service) CurrentUser(ctx context.Context, rawToken string) (auth.User, error) {
	if rawToken == "" {
		return auth.User{}, auth.ErrUnauthorized
	}
	return s.repository.GetUserByTokenHash(ctx, hashToken(rawToken), s.adminGoogleSub)
}

func (s *Service) Logout(ctx context.Context, rawToken string) error {
	if rawToken == "" {
		return nil
	}
	return s.repository.RevokeSession(ctx, hashToken(rawToken), s.now().UTC())
}

// DeleteAccount soft-deletes the signed-in user (anonymize + revoke every
// session). See postgres.AuthRepository.DeleteAccount for why it's a soft
// delete rather than removing the row.
func (s *Service) DeleteAccount(ctx context.Context, userID string) error {
	return s.repository.DeleteAccount(ctx, userID, s.now().UTC())
}

func (s *Service) FlowTTL() time.Duration { return s.flowTTL }

func randomToken(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func hashToken(raw string) string {
	digest := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(digest[:])
}

func secureEqual(left, right string) bool {
	if len(left) != len(right) || left == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
}

func newUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
