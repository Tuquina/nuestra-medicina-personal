package page

import (
	"errors"
	"testing"
)

func TestContentAcceptsControlledBlocks(t *testing.T) {
	content, err := DecodeContent([]byte(`{
		"schemaVersion": 1,
		"sections": [
			{"id":"hero-home","type":"hero","props":{"title":"Nuestra Medicina Personal","subtitle":"Libros para vivir mejor","imageId":null,"alignment":"center","cta":{"label":"Ver libros","href":"/libros"}}},
			{"id":"intro","type":"richText","props":{"nodes":[{"type":"paragraph","content":[{"text":"Contenido seguro ","marks":[]},{"text":"y estructurado","marks":["bold"],"link":"https://example.com/info"}]}]}},
			{"id":"buy","type":"buyButton","props":{"label":"Comprar"}}
		]
	}`))
	if err != nil {
		t.Fatalf("decode valid content: %v", err)
	}
	if len(content.Sections) != 3 {
		t.Fatalf("expected three sections, got %d", len(content.Sections))
	}
}

func TestContentRejectsRawHTMLAndUnknownFields(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{
			name: "raw HTML property",
			raw:  `{"schemaVersion":1,"sections":[{"id":"unsafe","type":"richText","props":{"html":"<script>alert(1)</script>"}}]}`,
		},
		{
			name: "javascript URL",
			raw:  `{"schemaVersion":1,"sections":[{"id":"unsafe","type":"cta","props":{"heading":"Abrir","text":"","link":{"label":"Ir","href":"javascript:alert(1)"}}}]}`,
		},
		{
			name: "unknown block",
			raw:  `{"schemaVersion":1,"sections":[{"id":"unsafe","type":"html","props":{"value":"<b>hola</b>"}}]}`,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := DecodeContent([]byte(test.raw))
			var validationError *ValidationError
			if !errors.As(err, &validationError) {
				t.Fatalf("expected validation error, got %v", err)
			}
		})
	}
}

func TestContentRejectsDuplicateBlockIDs(t *testing.T) {
	_, err := DecodeContent([]byte(`{
		"schemaVersion":1,
		"sections":[
			{"id":"same","type":"buyButton","props":{"label":"Comprar"}},
			{"id":"same","type":"buyButton","props":{"label":"Comprar ahora"}}
		]
	}`))
	var validationError *ValidationError
	if !errors.As(err, &validationError) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestPageRejectsInvalidBookAndSlugIdentifiers(t *testing.T) {
	bookID := "not-a-uuid"
	value := Page{
		Type: "BOOK", BookID: &bookID, Slug: "-invalid--slug", Title: "Libro",
		DraftContent: EmptyContent(),
	}
	err := value.Validate()
	var validationError *ValidationError
	if !errors.As(err, &validationError) {
		t.Fatalf("expected validation error, got %v", err)
	}
	if validationError.Fields["bookId"] == "" || validationError.Fields["slug"] == "" {
		t.Fatalf("expected identifier details, got %#v", validationError.Fields)
	}
}
