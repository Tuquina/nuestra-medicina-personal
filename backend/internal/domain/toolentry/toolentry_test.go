package toolentry

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestRefValidate(t *testing.T) {
	valid := []Ref{
		{Tool: "escritura-diaria", Kind: "day", Key: "2026-11-13"},
		{Tool: "preguntas", Kind: "answer", Key: "lx9k2a_3f"},
		{Tool: "preguntas", Kind: "favorites", Key: "all"},
		{Tool: "cierre-semanal", Kind: "closure", Key: "2026-11-09"},
		{Tool: "cierre-semanal", Kind: "draft", Key: "2026-11-09"},
	}
	for _, ref := range valid {
		if err := ref.Validate(); err != nil {
			t.Fatalf("expected %+v to be valid: %v", ref, err)
		}
	}

	invalid := map[string]Ref{
		"tool": {Tool: "otra", Kind: "day", Key: "x"},
		"kind": {Tool: "escritura-diaria", Kind: "answer", Key: "x"},
		"key":  {Tool: "preguntas", Kind: "answer", Key: "../etc"},
	}
	for field, ref := range invalid {
		var validation *ValidationError
		if err := ref.Validate(); !errors.As(err, &validation) || validation.Fields[field] == "" {
			t.Fatalf("expected %s to be rejected for %+v, got %v", field, ref, err)
		}
	}
	if err := (Ref{Tool: "preguntas", Kind: "answer", Key: strings.Repeat("a", 65)}).Validate(); err == nil {
		t.Fatal("expected a 65-character key to be rejected")
	}
}

func TestValidateData(t *testing.T) {
	if err := ValidateData(json.RawMessage(`{"text":"hola"}`)); err != nil {
		t.Fatalf("expected an object to be valid: %v", err)
	}
	for _, raw := range []string{``, `null`, `[1,2]`, `"text"`, `{"broken":`} {
		if ValidateData(json.RawMessage(raw)) == nil {
			t.Fatalf("expected %q to be rejected", raw)
		}
	}
	tooLarge := `{"text":"` + strings.Repeat("a", MaxDataBytes) + `"}`
	if ValidateData(json.RawMessage(tooLarge)) == nil {
		t.Fatal("expected oversized data to be rejected")
	}
}

func TestParseCursor(t *testing.T) {
	cursor, err := ParseCursor("preguntas", "answer/abc")
	if err != nil || cursor == nil || cursor.Kind != "answer" || cursor.Key != "abc" || cursor.String() != "answer/abc" {
		t.Fatalf("unexpected cursor %+v, err %v", cursor, err)
	}
	if cursor, err := ParseCursor("preguntas", ""); cursor != nil || err != nil {
		t.Fatalf("empty cursor should mean the first page, got %+v %v", cursor, err)
	}
	for _, value := range []string{"answer", "day/2026-11-13", "answer/../x"} {
		if _, err := ParseCursor("preguntas", value); err == nil {
			t.Fatalf("expected cursor %q to be rejected", value)
		}
	}
}

func TestAssociatedDataDiffersByOwnerAndPosition(t *testing.T) {
	ref := Ref{Tool: "preguntas", Kind: "answer", Key: "a"}
	base := string(AssociatedData("user-1", ref))
	if base == string(AssociatedData("user-2", ref)) {
		t.Fatal("owner must change the associated data")
	}
	if base == string(AssociatedData("user-1", Ref{Tool: "preguntas", Kind: "answer", Key: "b"})) {
		t.Fatal("key must change the associated data")
	}
}
