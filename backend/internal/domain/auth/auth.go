package auth

import "errors"

var ErrUnauthorized = errors.New("session is not authorized")
