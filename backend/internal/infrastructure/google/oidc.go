package google

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/nuestra-medicina-personal/backend/internal/domain/auth"
	"golang.org/x/oauth2"
)

const googleKeysURL = "https://www.googleapis.com/oauth2/v3/certs"

var googleEndpoint = oauth2.Endpoint{
	AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
	TokenURL: "https://oauth2.googleapis.com/token",
}

type OIDCProvider struct {
	configured bool
	oauth      oauth2.Config
	verifier   *oidc.IDTokenVerifier
}

func NewOIDCProvider(ctx context.Context, clientID, clientSecret, redirectURL string) *OIDCProvider {
	configured := clientID != "" && clientSecret != "" && redirectURL != ""
	keySet := oidc.NewRemoteKeySet(ctx, googleKeysURL)
	return &OIDCProvider{
		configured: configured,
		oauth: oauth2.Config{
			ClientID: clientID, ClientSecret: clientSecret, RedirectURL: redirectURL,
			Endpoint: googleEndpoint, Scopes: []string{oidc.ScopeOpenID, "profile", "email"},
		},
		verifier: oidc.NewVerifier("https://accounts.google.com", keySet, &oidc.Config{ClientID: clientID}),
	}
}

func (p *OIDCProvider) Configured() bool { return p.configured }

func (p *OIDCProvider) AuthorizationURL(state, nonce, challenge string) string {
	return p.oauth.AuthCodeURL(state,
		oidc.Nonce(nonce),
		oauth2.AccessTypeOnline,
		oauth2.S256ChallengeOption(challenge),
		oauth2.SetAuthURLParam("prompt", "select_account"),
	)
}

func (p *OIDCProvider) Exchange(ctx context.Context, code, expectedNonce, verifier string) (auth.Identity, error) {
	token, err := p.oauth.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return auth.Identity{}, fmt.Errorf("exchange authorization code: %w", err)
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return auth.Identity{}, errors.New("google response did not include an id token")
	}
	idToken, err := p.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return auth.Identity{}, fmt.Errorf("verify id token: %w", err)
	}
	if len(idToken.Nonce) != len(expectedNonce) || subtle.ConstantTimeCompare([]byte(idToken.Nonce), []byte(expectedNonce)) != 1 {
		return auth.Identity{}, errors.New("id token nonce does not match")
	}
	var claims struct {
		Subject       string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return auth.Identity{}, fmt.Errorf("decode id token claims: %w", err)
	}
	return auth.Identity{
		GoogleSubject: claims.Subject, Email: claims.Email, EmailVerified: claims.EmailVerified,
		DisplayName: claims.Name, PictureURL: claims.Picture,
	}, nil
}

func (*OIDCProvider) NewVerifier() string { return oauth2.GenerateVerifier() }

func (*OIDCProvider) VerifierChallenge(verifier string) string {
	return oauth2.S256ChallengeFromVerifier(verifier)
}
