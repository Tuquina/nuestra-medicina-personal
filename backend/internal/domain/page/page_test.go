package page

import (
	"errors"
	"strings"
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

func TestContentAcceptsNewEditorialPageBlocks(t *testing.T) {
	raw := []byte(`{
		"schemaVersion":1,
		"sections":[
			{"id":"collection","type":"collection","hidden":false,"props":{"title":"Meditaciones","description":"Prácticas breves","cards":[{"id":"c1","title":"Respirar","description":"Una pausa","imageCaption":"Amanecer"}]}},
			{"id":"contacto","type":"contacto","props":{"title":"Contacto","intro":"Escribinos","methods":[{"id":"email","label":"Correo","value":"soporte@example.com","href":"mailto:soporte@example.com"}]}},
			{"id":"soporte","type":"soporte","props":{"title":"Soporte","intro":"Te ayudamos","topics":[{"id":"t1","title":"Compras","description":"Ayuda con pagos"}]}},
			{"id":"faq","type":"faq","props":{"title":"Preguntas frecuentes","intro":"Dudas comunes","faqs":[{"id":"f1","q":"¿Cómo compro?","a":"Desde la página del libro."}]}},
			{"id":"doc","type":"legal-doc","props":{"title":"Términos","updatedLabel":"Actualizado hoy","introNote":"Texto para revisión profesional.","sections":[{"id":"s1","title":"1. Alcance","body":"Contenido estructurado.\n\n- Punto uno"}]}}
		]
	}`)
	content, err := DecodeContent(raw)
	if err != nil {
		t.Fatalf("decode editorial content: %v", err)
	}
	if len(content.Sections) != 5 {
		t.Fatalf("expected five sections, got %d", len(content.Sections))
	}
}

func TestNewEditorialPageTypesDoNotAcceptBookID(t *testing.T) {
	bookID := "10000000-0000-4000-8000-000000000001"
	for _, pageType := range []Type{TypeMeditations, TypeTools, TypeContact, TypeSupport, TypeFAQ, TypeTerms, TypePrivacy} {
		value := Page{Type: string(pageType), Slug: strings.ToLower(string(pageType)), Title: string(pageType), DraftContent: EmptyContent()}
		if err := value.Validate(); err != nil {
			t.Fatalf("expected %s page to be valid: %v", pageType, err)
		}
		value.BookID = &bookID
		var validationError *ValidationError
		if !errors.As(value.Validate(), &validationError) || validationError.Fields["bookId"] == "" {
			t.Fatalf("expected %s to reject bookId", pageType)
		}
	}
}
