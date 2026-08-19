package authentication

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
)

type providerStub struct {
	configured bool
	identity   auth.Identity
	exchange   bool
}

func (p *providerStub) Configured() bool { return p.configured }
func (p *providerStub) AuthorizationURL(state, nonce, challenge string) string {
	return "https://accounts.example/auth?state=" + state + "&nonce=" + nonce + "&challenge=" + challenge
}
func (p *providerStub) Exchange(context.Context, string, string, string) (auth.Identity, error) {
	p.exchange = true
	return p.identity, nil
}
func (*providerStub) NewVerifier() string             { return "verifier-value" }
func (*providerStub) VerifierChallenge(string) string { return "challenge-value" }

type repositoryStub struct {
	identity  auth.Identity
	session   auth.Session
	tokenHash string
	revoked   string
}

func (r *repositoryStub) CreateSession(_ context.Context, identity auth.Identity, session auth.Session, _ time.Time) (auth.User, error) {
	r.identity, r.session = identity, session
	return auth.User{ID: "user-id", Email: identity.Email}, nil
}
func (r *repositoryStub) GetUserByTokenHash(_ context.Context, hash, _ string) (auth.User, error) {
	r.tokenHash = hash
	return auth.User{ID: "user-id"}, nil
}
func (r *repositoryStub) RevokeSession(_ context.Context, hash string, _ time.Time) error {
	r.revoked = hash
	return nil
}

func TestStartRequiresConfiguredProvider(t *testing.T) {
	t.Parallel()
	service := NewService(&providerStub{}, &repositoryStub{}, "", time.Hour)
	if _, err := service.Start(); !errors.Is(err, auth.ErrNotConfigured) {
		t.Fatalf("expected not configured, got %v", err)
	}
}

func TestStartCreatesIndependentFlowSecretsAndPKCE(t *testing.T) {
	t.Parallel()
	service := NewService(&providerStub{configured: true}, &repositoryStub{}, "", time.Hour)
	flow, err := service.Start()
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if flow.State == "" || flow.Nonce == "" || flow.State == flow.Nonce || flow.Verifier != "verifier-value" {
		t.Fatalf("invalid flow values: %#v", flow)
	}
	if !strings.Contains(flow.AuthorizationURL, "challenge=challenge-value") {
		t.Fatalf("authorization URL is missing PKCE challenge: %s", flow.AuthorizationURL)
	}
}

func TestCompleteRejectsInvalidStateBeforeProviderExchange(t *testing.T) {
	t.Parallel()
	provider := &providerStub{configured: true}
	service := NewService(provider, &repositoryStub{}, "", time.Hour)
	_, _, err := service.Complete(context.Background(), "code", "received", "expected", "nonce", "verifier")
	if !errors.Is(err, auth.ErrInvalidFlow) || provider.exchange {
		t.Fatalf("expected invalid flow before exchange, got %v, exchanged=%v", err, provider.exchange)
	}
}

func TestCompleteCreatesOpaqueHashedSession(t *testing.T) {
	t.Parallel()
	provider := &providerStub{configured: true, identity: auth.Identity{
		GoogleSubject: "admin-sub", Email: "admin@example.com", EmailVerified: true,
	}}
	repository := &repositoryStub{}
	service := NewService(provider, repository, "admin-sub", 24*time.Hour)
	now := time.Date(2026, 8, 19, 14, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }

	user, session, err := service.Complete(context.Background(), "code", "state", "state", "nonce", "verifier")
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	if !user.IsAdmin || session.Token == "" || session.TokenHash == "" || session.Token == session.TokenHash {
		t.Fatalf("unexpected session: user=%#v session=%#v", user, session)
	}
	if repository.session.Token != session.Token || repository.session.TokenHash != hashToken(session.Token) {
		t.Fatal("repository did not receive hashed opaque session")
	}
	if !session.ExpiresAt.Equal(now.Add(24 * time.Hour)) {
		t.Fatalf("unexpected expiry: %s", session.ExpiresAt)
	}
}

func TestCompleteRejectsUnverifiedEmail(t *testing.T) {
	t.Parallel()
	provider := &providerStub{configured: true, identity: auth.Identity{GoogleSubject: "sub", Email: "user@example.com"}}
	service := NewService(provider, &repositoryStub{}, "", time.Hour)
	_, _, err := service.Complete(context.Background(), "code", "state", "state", "nonce", "verifier")
	if !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
}

func TestCurrentUserAndLogoutNeverSendRawTokenToRepository(t *testing.T) {
	t.Parallel()
	repository := &repositoryStub{}
	service := NewService(&providerStub{}, repository, "", time.Hour)
	if _, err := service.CurrentUser(context.Background(), "raw-token"); err != nil {
		t.Fatalf("current user: %v", err)
	}
	if err := service.Logout(context.Background(), "raw-token"); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if repository.tokenHash != hashToken("raw-token") || repository.revoked != hashToken("raw-token") {
		t.Fatal("repository received a raw session token")
	}
}
