package page

import (
	"strings"
	"testing"
)

func meditationContent(props string) []byte {
	return []byte(`{"schemaVersion":1,"sections":[{"id":"meditation","type":"meditation","props":` + props + `}]}`)
}

const validMeditationProps = `{"title":"Respirar y empezar","description":"Una práctica breve.","imageId":null,"imageAlt":"","video":{"provider":"youtube","videoId":"IJTmQzcsz7o"},"durationMinutes":10,"guidance":"Buscá un lugar cómodo.\n\nRespirá."}`

func TestMeditationBlockAcceptsValidContent(t *testing.T) {
	if _, err := DecodeContent(meditationContent(validMeditationProps)); err != nil {
		t.Fatalf("expected a valid meditation: %v", err)
	}
	minimal := `{"title":"Antes de dormir","description":"Una pausa.","imageId":"10000000-0000-4000-8000-000000000001","imageAlt":"Cielo","video":null,"durationMinutes":null,"guidance":""}`
	if _, err := DecodeContent(meditationContent(minimal)); err != nil {
		t.Fatalf("expected a meditation without video or duration to be valid: %v", err)
	}
}

func TestMeditationBlockRejectsUnsafeOrInvalidContent(t *testing.T) {
	cases := map[string]string{
		"raw url as id":   strings.Replace(validMeditationProps, `"IJTmQzcsz7o"`, `"https://evil.example/x"`, 1),
		"other provider":  strings.Replace(validMeditationProps, `"youtube"`, `"vimeo"`, 1),
		"missing title":   strings.Replace(validMeditationProps, `"Respirar y empezar"`, `""`, 1),
		"bad image id":    strings.Replace(validMeditationProps, `"imageId":null`, `"imageId":"not-a-uuid"`, 1),
		"zero duration":   strings.Replace(validMeditationProps, `"durationMinutes":10`, `"durationMinutes":0`, 1),
		"unknown field":   strings.Replace(validMeditationProps, `"guidance"`, `"html":"<b>x</b>","guidance"`, 1),
		"guidance length": strings.Replace(validMeditationProps, `Buscá un lugar cómodo.`, strings.Repeat("a", 6_001), 1),
	}
	for name, props := range cases {
		if _, err := DecodeContent(meditationContent(props)); err == nil {
			t.Fatalf("%s: expected the meditation to be rejected", name)
		}
	}
}

func TestMeditationPageTypeIsValidAndNeedsNoBook(t *testing.T) {
	value := Page{Type: string(TypeMeditation), Slug: "respirar-y-empezar", Title: "Respirar y empezar", DraftContent: EmptyContent()}
	if err := value.Validate(); err != nil {
		t.Fatalf("expected a meditation page to be valid: %v", err)
	}
	bookID := "10000000-0000-4000-8000-000000000001"
	value.BookID = &bookID
	if value.Validate() == nil {
		t.Fatal("expected a meditation page to reject bookId")
	}
}

func TestMeditationSummaryOf(t *testing.T) {
	content, err := DecodeContent(meditationContent(validMeditationProps))
	if err != nil {
		t.Fatal(err)
	}
	summary, ok := MeditationSummaryOf("respirar-y-empezar", content)
	if !ok || summary.Title != "Respirar y empezar" || !summary.HasVideo || summary.DurationMinutes == nil || *summary.DurationMinutes != 10 {
		t.Fatalf("unexpected summary %+v ok=%v", summary, ok)
	}
	content.Sections[0].Hidden = true
	if _, ok := MeditationSummaryOf("respirar-y-empezar", content); ok {
		t.Fatal("a hidden meditation block must not produce a summary")
	}
}
