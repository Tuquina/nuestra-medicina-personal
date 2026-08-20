package page

import (
	"errors"
	"testing"
)

func TestContentAcceptsCurrentHomeEditorContract(t *testing.T) {
	raw := []byte(`{
		"schemaVersion":1,
		"sections":[
			{"id":"hero","type":"hero","props":{"eyebrow":"Escritura","headingLine1":"Nuestra","headingLine2":"medicina personal","lede":"Un espacio para escribir.","primaryCtaLabel":"Explorar","primaryCtaTo":"/libros","secondaryCtaLabel":"Conocer el proyecto","secondaryCtaTo":"#sobre-el-proyecto","imageCaption":"Foto — amanecer"}},
			{"id":"gallery","type":"gallery","props":{"captions":["Naturaleza en calma"]}},
			{"id":"manifesto","type":"manifesto","props":{"quote":"Una frase","body":"Un manifiesto."}},
			{"id":"books","type":"featured-books","props":{"eyebrow":"Colección","title":"Libros destacados","description":"Libros para acompañarte."}},
			{"id":"teaser","type":"collection-teaser","props":{"eyebrow":"Colección","title":"Meditaciones","description":"Prácticas breves.","ctaLabel":"Explorar","ctaTo":"/meditaciones","imageCaption":"Colección","reverse":false,"accent":"sky"}},
			{"id":"about","type":"about","props":{"eyebrow":"Sobre el proyecto","title":"Quién escribe","bio":"Una breve biografía.","imageCaption":"Retrato"}},
			{"id":"newsletter","type":"newsletter","props":{"title":"Novedades","subtitle":"Nuevos contenidos.","buttonLabel":"Suscribirme","confirmationText":"Gracias.","fineprint":"Podés darte de baja."}},
			{"id":"title","type":"title","props":{"text":"Nuevo título"}},
			{"id":"text","type":"text","props":{"text":"Texto libre pero escapado."}},
			{"id":"image","type":"image","props":{"caption":"Foto — descripción"}},
			{"id":"quote","type":"quote","props":{"text":"Una cita."}},
			{"id":"divider","type":"divider","props":{}},
			{"id":"spacer","type":"spacer","props":{"height":"md"}}
		]
	}`)
	content, err := DecodeContent(raw)
	if err != nil {
		t.Fatalf("decode current Home contract: %v", err)
	}
	if len(content.Sections) != 13 {
		t.Fatalf("expected all Home blocks, got %d", len(content.Sections))
	}
}

func TestContentAcceptsCurrentBookLandingVariantsAndDraftDefaults(t *testing.T) {
	tests := []struct {
		name   string
		middle string
		faqs   string
	}{
		{
			name:   "image and text with FAQs",
			middle: `{"type":"image-text","heading":"Un cuaderno","text":"Texto central.","imageAccent":"var(--color-sky-pale)","imageCaption":"Foto — cuaderno"}`,
			faqs:   `,"faqs":[{"q":"¿En qué formato?","a":"PDF y EPUB."}]`,
		},
		{
			name:   "benefits without FAQs",
			middle: `{"type":"benefits","heading":"Qué vas a encontrar","items":[{"title":"Actividades","description":"Listas para usar."}]}`,
		},
		{
			name:   "new book draft defaults",
			middle: `{"type":"image-text","heading":"","text":"","imageAccent":"var(--color-sky-pale)","imageCaption":"Foto — portada del libro"}`,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			slug := ""
			if test.name == "image and text with FAQs" {
				slug = `"slug":"el-poder-de-tu-historia",`
			}
			raw := []byte(`{"schemaVersion":1,"sections":[{"id":"book-landing","type":"book-landing","props":{` + slug +
				`"taglineColor":"var(--color-accent-gold-dark)","heroGlowColor":"var(--color-accent-amber-soft)",` +
				`"authorName":"Nombre del autor/a","tagline":"","heroDescription":"",` +
				`"synopsisEyebrowColor":"oklch(40% 0.07 235)","synopsisParagraphs":[""],` +
				`"middleSection":` + test.middle + `,"quote":"","quoteGlowSide":"left",` +
				`"publicationDate":"","isbn":"","fileSize":""` + test.faqs + `,"relatedSlug":"","ctaGlowSide":"right"}}]}`)
			if _, err := DecodeContent(raw); err != nil {
				t.Fatalf("decode book landing: %v", err)
			}
		})
	}
}

func TestBookLandingRejectsArbitraryCSSAndUnknownProperties(t *testing.T) {
	raw := []byte(`{"schemaVersion":1,"sections":[{"id":"book-landing","type":"book-landing","props":{` +
		`"taglineColor":"red;background:url(https://attacker.example)","heroGlowColor":"var(--color-sky)",` +
		`"authorName":"Autor","tagline":"","heroDescription":"","synopsisEyebrowColor":"var(--color-sky)",` +
		`"synopsisParagraphs":[""],"middleSection":{"type":"benefits","heading":"","items":[{"title":"","description":""}]},` +
		`"quote":"","quoteGlowSide":"left","publicationDate":"","isbn":"","fileSize":"","relatedSlug":"","ctaGlowSide":"right"}}]}`)
	_, err := DecodeContent(raw)
	var validationError *ValidationError
	if !errors.As(err, &validationError) {
		t.Fatalf("expected unsafe color rejection, got %v", err)
	}
}
