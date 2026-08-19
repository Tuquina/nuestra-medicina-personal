package settings

import (
	"errors"
	"testing"
)

func TestSettingsNormalizeAndValidate(t *testing.T) {
	value := Settings{
		SiteName: " Nuestra Medicina Personal ", SupportEmail: " SOPORTE@EXAMPLE.COM ",
		NewsletterEmail: " novedades@example.com ", SenderName: " Tienda ",
	}
	value.Normalize()
	if err := value.Validate(); err != nil {
		t.Fatal(err)
	}
	if value.SupportEmail != "soporte@example.com" || value.SiteName != "Nuestra Medicina Personal" {
		t.Fatalf("unexpected normalized value: %#v", value)
	}
}

func TestSettingsRejectsInvalidFields(t *testing.T) {
	value := Settings{SupportEmail: "not-email", NewsletterEmail: "also-invalid"}
	err := value.Validate()
	var validationError *ValidationError
	if !errors.As(err, &validationError) || len(validationError.Fields) != 4 {
		t.Fatalf("expected four invalid fields, got %#v", err)
	}
}
