package book

import (
	"errors"
	"testing"
)

func TestBookValidation(t *testing.T) {
	t.Parallel()

	valid := Book{Slug: "el-poder-de-tu-historia", Title: "El poder de tu historia", PriceMinorUnits: 1890000, Currency: "ARS", Variant: "gold", Status: StatusPublished}
	if err := valid.Validate(); err != nil {
		t.Fatalf("expected valid book, got %v", err)
	}

	invalid := valid
	invalid.Slug = "Slug Inválido"
	invalid.PriceMinorUnits = 0
	err := invalid.Validate()
	var validationError *ValidationError
	if !errors.As(err, &validationError) {
		t.Fatalf("expected ValidationError, got %T", err)
	}
	if validationError.Fields["slug"] == "" || validationError.Fields["priceMinorUnits"] == "" {
		t.Fatalf("expected slug and price errors, got %#v", validationError.Fields)
	}
}

func TestApplyDefaults(t *testing.T) {
	t.Parallel()
	value := Book{Slug: "  un-libro  ", Title: "  Título  "}
	value.ApplyDefaults()
	if value.Slug != "un-libro" || value.Title != "Título" || value.Currency != "ARS" || value.Status != StatusDraft || value.Variant != "blue" {
		t.Fatalf("unexpected defaults: %#v", value)
	}
}
