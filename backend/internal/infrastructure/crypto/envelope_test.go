package crypto

import (
	"bytes"
	"encoding/base64"
	"errors"
	"testing"
)

func testEnvelope(t *testing.T) *Envelope {
	t.Helper()
	envelope, err := NewEnvelope(bytes.Repeat([]byte{7}, KeySize), 1)
	if err != nil {
		t.Fatalf("new envelope: %v", err)
	}
	return envelope
}

func TestParseMasterKeyAcceptsBase64Variants(t *testing.T) {
	raw := bytes.Repeat([]byte{0xfb}, KeySize)
	for _, encoded := range []string{
		base64.StdEncoding.EncodeToString(raw),
		base64.RawStdEncoding.EncodeToString(raw),
		base64.URLEncoding.EncodeToString(raw),
		"  " + base64.RawURLEncoding.EncodeToString(raw) + "\n",
	} {
		key, err := ParseMasterKey(encoded)
		if err != nil || !bytes.Equal(key, raw) {
			t.Fatalf("parse %q: key=%x err=%v", encoded, key, err)
		}
	}
}

func TestParseMasterKeyRejectsWrongSizeAndGarbage(t *testing.T) {
	for _, encoded := range []string{"", "not base64!!", base64.StdEncoding.EncodeToString([]byte("too short"))} {
		if _, err := ParseMasterKey(encoded); err == nil {
			t.Fatalf("expected %q to be rejected", encoded)
		}
	}
}

func TestDataKeyRoundTripIsBoundToItsOwner(t *testing.T) {
	envelope := testEnvelope(t)
	dataKey, err := envelope.NewDataKey()
	if err != nil {
		t.Fatal(err)
	}
	wrapped, err := envelope.WrapDataKey("user-a", dataKey)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(wrapped, dataKey) {
		t.Fatal("wrapped key must not contain the plain data key")
	}
	unwrapped, err := envelope.UnwrapDataKey("user-a", wrapped, 1)
	if err != nil || !bytes.Equal(unwrapped, dataKey) {
		t.Fatalf("unwrap: %v", err)
	}
	if _, err := envelope.UnwrapDataKey("user-b", wrapped, 1); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("expected another owner to fail with ErrDecrypt, got %v", err)
	}
	if _, err := envelope.UnwrapDataKey("user-a", wrapped, 2); err == nil {
		t.Fatal("expected an unknown master key version to fail")
	}
}

func TestSealOpenDetectsTamperingAndWrongContext(t *testing.T) {
	envelope := testEnvelope(t)
	dataKey, _ := envelope.NewDataKey()
	otherKey, _ := envelope.NewDataKey()
	plaintext := []byte(`{"text":"algo muy personal"}`)
	aad := []byte("user-a|escritura-diaria|day|2026-11-13")

	sealed, err := envelope.Seal(dataKey, plaintext, aad)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("personal")) {
		t.Fatal("ciphertext must not contain the plaintext")
	}
	again, _ := envelope.Seal(dataKey, plaintext, aad)
	if bytes.Equal(sealed, again) {
		t.Fatal("each seal must use a fresh nonce")
	}

	opened, err := envelope.Open(dataKey, sealed, aad)
	if err != nil || !bytes.Equal(opened, plaintext) {
		t.Fatalf("open: %v", err)
	}

	tampered := append([]byte(nil), sealed...)
	tampered[len(tampered)-1] ^= 0x01
	cases := map[string]func() error{
		"tampered":  func() error { _, err := envelope.Open(dataKey, tampered, aad); return err },
		"wrong key": func() error { _, err := envelope.Open(otherKey, sealed, aad); return err },
		"moved row": func() error {
			_, err := envelope.Open(dataKey, sealed, []byte("user-b|escritura-diaria|day|2026-11-13"))
			return err
		},
		"truncated": func() error { _, err := envelope.Open(dataKey, sealed[:10], aad); return err },
	}
	for name, run := range cases {
		if err := run(); !errors.Is(err, ErrDecrypt) {
			t.Fatalf("%s: expected ErrDecrypt, got %v", name, err)
		}
	}
}
