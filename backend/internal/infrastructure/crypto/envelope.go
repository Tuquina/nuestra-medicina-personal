// Package crypto implements the envelope encryption behind personal tool
// entries (ADR 0006): a master key (KEK) wraps one random data key (DEK)
// per user, and each entry is sealed with its owner's DEK. Everything is
// AES-256-GCM from the standard library.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

// KeySize is the length of both the master key and every data key.
const KeySize = 32

// ErrDecrypt is returned for any ciphertext that doesn't open with the
// given key and associated data: wrong key, tampered bytes, or a row moved
// to another owner or position.
var ErrDecrypt = errors.New("ciphertext cannot be decrypted")

// Envelope wraps and unwraps per-user data keys with the master key, and
// seals/opens entry content with a data key.
type Envelope struct {
	kek     cipher.AEAD
	version int16
}

// ParseMasterKey decodes a base64 (standard or URL, padded or not) master
// key that must be exactly KeySize bytes.
func ParseMasterKey(encoded string) ([]byte, error) {
	encoded = strings.TrimSpace(encoded)
	for _, encoding := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if key, err := encoding.DecodeString(encoded); err == nil {
			if len(key) != KeySize {
				return nil, fmt.Errorf("master key must be %d bytes, got %d", KeySize, len(key))
			}
			return key, nil
		}
	}
	return nil, errors.New("master key must be base64 encoded")
}

// NewEnvelope builds an Envelope around a KeySize master key. version is
// stored next to every wrapped data key so the master key can be rotated.
func NewEnvelope(masterKey []byte, version int16) (*Envelope, error) {
	if version < 1 {
		return nil, errors.New("master key version must be positive")
	}
	aead, err := newAEAD(masterKey)
	if err != nil {
		return nil, err
	}
	return &Envelope{kek: aead, version: version}, nil
}

// KeyVersion is the master key version new data keys are wrapped with.
func (e *Envelope) KeyVersion() int16 { return e.version }

// NewDataKey returns a fresh random data key.
func (e *Envelope) NewDataKey() ([]byte, error) {
	key := make([]byte, KeySize)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("generate data key: %w", err)
	}
	return key, nil
}

// WrapDataKey encrypts a data key with the master key, bound to ownerID.
func (e *Envelope) WrapDataKey(ownerID string, dataKey []byte) ([]byte, error) {
	if len(dataKey) != KeySize {
		return nil, fmt.Errorf("data key must be %d bytes", KeySize)
	}
	return seal(e.kek, dataKey, wrapAAD(ownerID))
}

// UnwrapDataKey reverses WrapDataKey; it fails for any other owner.
func (e *Envelope) UnwrapDataKey(ownerID string, wrapped []byte, version int16) ([]byte, error) {
	if version != e.version {
		return nil, fmt.Errorf("data key wrapped with unknown master key version %d", version)
	}
	key, err := open(e.kek, wrapped, wrapAAD(ownerID))
	if err != nil {
		return nil, err
	}
	if len(key) != KeySize {
		return nil, ErrDecrypt
	}
	return key, nil
}

// Seal encrypts plaintext with a data key; aad must be supplied again to Open.
func (e *Envelope) Seal(dataKey, plaintext, aad []byte) ([]byte, error) {
	aead, err := newAEAD(dataKey)
	if err != nil {
		return nil, err
	}
	return seal(aead, plaintext, aad)
}

// Open decrypts what Seal produced, with the same data key and aad.
func (e *Envelope) Open(dataKey, ciphertext, aad []byte) ([]byte, error) {
	aead, err := newAEAD(dataKey)
	if err != nil {
		return nil, err
	}
	return open(aead, ciphertext, aad)
}

func newAEAD(key []byte) (cipher.AEAD, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("key must be %d bytes", KeySize)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}
	return cipher.NewGCM(block)
}

// seal returns nonce || ciphertext+tag, with a fresh random nonce each time.
func seal(aead cipher.AEAD, plaintext, aad []byte) ([]byte, error) {
	nonce := make([]byte, aead.NonceSize(), aead.NonceSize()+len(plaintext)+aead.Overhead())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}
	return aead.Seal(nonce, nonce, plaintext, aad), nil
}

func open(aead cipher.AEAD, sealed, aad []byte) ([]byte, error) {
	if len(sealed) < aead.NonceSize()+aead.Overhead() {
		return nil, ErrDecrypt
	}
	nonce, ciphertext := sealed[:aead.NonceSize()], sealed[aead.NonceSize():]
	plaintext, err := aead.Open(nil, nonce, ciphertext, aad)
	if err != nil {
		return nil, ErrDecrypt
	}
	return plaintext, nil
}

func wrapAAD(ownerID string) []byte {
	return []byte("nmp:data-key:v1:" + ownerID)
}
