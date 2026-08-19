package auth

import (
	"errors"
	"time"
)

var (
	ErrUnauthorized  = errors.New("session is not authorized")
	ErrInvalidFlow   = errors.New("authentication flow is invalid or expired")
	ErrNotConfigured = errors.New("authentication provider is not configured")
)

type Identity struct {
	GoogleSubject string
	Email         string
	EmailVerified bool
	DisplayName   string
	PictureURL    string
}

type User struct {
	ID          string
	Email       string
	DisplayName string
	PictureURL  string
	IsAdmin     bool
	CreatedAt   time.Time
	LastLoginAt time.Time
}

type Session struct {
	ID        string
	Token     string
	TokenHash string
	ExpiresAt time.Time
}
