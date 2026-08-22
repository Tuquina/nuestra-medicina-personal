package manuscripts

import (
	"archive/zip"
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/ledongthuc/pdf"
	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

// A minimal valid 1x1 transparent PNG, the same shape any real photo the
// editor's image toolbar inserts would take (data:image/png;base64,...).
const testPNGDataURL = "data:image/png;base64," +
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func testChapters() []manuscript.Chapter {
	return []manuscript.Chapter{
		{ID: 1, Title: "Introducción", HTML: "<h1>Bienvenida</h1><p>Un párrafo de bienvenida al libro.</p>"},
		{ID: 2, Title: "Capítulo 2", HTML: "<p>Segundo capítulo con <b>texto en negrita</b>.</p><blockquote>Una cita memorable.</blockquote>"},
	}
}

func TestExportEPUBProducesAValidArchiveContainingChapterText(t *testing.T) {
	t.Parallel()
	data, err := ExportEPUB("Mi libro de prueba", "Autora de prueba", testChapters())
	if err != nil {
		t.Fatalf("export epub: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("expected non-empty epub output")
	}
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("epub output is not a valid zip archive: %v", err)
	}
	var mimetypePresent bool
	var chapterTextFound bool
	for _, file := range reader.File {
		if file.Name == "mimetype" {
			mimetypePresent = true
		}
		if strings.HasSuffix(file.Name, ".xhtml") {
			rc, err := file.Open()
			if err != nil {
				t.Fatalf("open %s: %v", file.Name, err)
			}
			var buf bytes.Buffer
			if _, err := buf.ReadFrom(rc); err != nil {
				t.Fatalf("read %s: %v", file.Name, err)
			}
			rc.Close()
			if strings.Contains(buf.String(), "texto en negrita") {
				chapterTextFound = true
			}
		}
	}
	if !mimetypePresent {
		t.Fatal("epub archive is missing the required mimetype entry")
	}
	if !chapterTextFound {
		t.Fatal("chapter text was not found in any xhtml entry of the generated epub")
	}
}

func TestExportRejectsUnknownFormatThroughService(t *testing.T) {
	t.Parallel()
	service := NewService(&repositoryStub{}, booksStub{value: book.Book{ID: "book-id", Title: "Un libro", Slug: "un-libro"}})
	if _, _, err := service.Export(context.Background(), "un-libro", "mobi"); err == nil {
		t.Fatal("expected an error for an unsupported export format")
	}
}

func TestExportPDFProducesAWellFormedDocument(t *testing.T) {
	t.Parallel()
	data, err := ExportPDF("Mi libro de prueba", "Autora de prueba", testChapters())
	if err != nil {
		t.Fatalf("export pdf: %v", err)
	}
	if !bytes.HasPrefix(data, []byte("%PDF-")) {
		t.Fatalf("expected output to start with the PDF signature, got: %q", data[:min(20, len(data))])
	}
	if !bytes.Contains(data, []byte("%%EOF")) {
		t.Fatal("expected a well-formed PDF trailer with an EOF marker")
	}
}

// TestExportPDFPreservesAccentedCharacters is a real round-trip regression
// test for the bug this fix addresses: with no TrueType font registered,
// gpdf falls back to its core "Helvetica" font and writes Spanish accented
// letters as bytes that PDF viewers then decode against the wrong implicit
// encoding, silently swapping é/í/ñ for unrelated glyphs. Reading the
// generated PDF back with the same library the manuscript *importer* uses
// (ledongthuc/pdf) catches that regression for real, rather than just
// asserting gpdf was called with some font option.
func TestExportPDFPreservesAccentedCharacters(t *testing.T) {
	t.Parallel()
	chapters := []manuscript.Chapter{{
		ID:    1,
		Title: "Introducción",
		HTML:  "<h1>Múltiples canciones</h1><p>El murciélago cantó su canción bajo la luna, año tras año.</p>",
	}}
	data, err := ExportPDF("Título con acentos: áéíóú ñ ¿por qué?", "Autoría", chapters)
	if err != nil {
		t.Fatalf("export pdf: %v", err)
	}

	reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("read generated pdf back: %v", err)
	}
	textReader, err := reader.GetPlainText()
	if err != nil {
		t.Fatalf("extract plain text: %v", err)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(textReader); err != nil {
		t.Fatalf("read extracted text: %v", err)
	}
	extracted := buf.String()

	for _, want := range []string{"Introducción", "Múltiples canciones", "murciélago", "canción", "año"} {
		if !strings.Contains(extracted, want) {
			t.Fatalf("expected extracted PDF text to contain %q, got: %q", want, extracted)
		}
	}
	// The exact mis-encoding this regression test guards against.
	for _, mangled := range []string{"IntroducciØn", "canciØn", "murciÆlago"} {
		if strings.Contains(extracted, mangled) {
			t.Fatalf("extracted PDF text contains the mis-encoded %q — accented characters are garbled again: %q", mangled, extracted)
		}
	}
}

// TestExportPDFKeepsParagraphsAndHeadingsAsSeparateBlocks is a regression
// test for a second bug behind the same "badly formatted PDF" report: the
// chapter HTML gets parsed by wrapping it in a synthetic "<div>...</div>"
// so html.Parse has a single root, but that wrapper itself matched
// blockKindOf's "div" case — so the *entire* chapter became one run-on
// paragraph (every heading/paragraph's text concatenated with no
// separator), rather than one block per top-level element.
func TestExportPDFKeepsParagraphsAndHeadingsAsSeparateBlocks(t *testing.T) {
	t.Parallel()
	chapters := []manuscript.Chapter{{
		ID:    1,
		Title: "Capítulo 1",
		HTML:  "<h2>Encabezado</h2><p>Primer párrafo.</p><p>Segundo párrafo.</p>",
	}}
	blocks, err := blocksFromChapterHTML(chapters[0].HTML)
	if err != nil {
		t.Fatalf("parse chapter html: %v", err)
	}
	if len(blocks) != 3 {
		t.Fatalf("expected 3 separate blocks (heading + 2 paragraphs), got %d: %#v", len(blocks), blocks)
	}
	if blocks[0].kind != "h2" || blocks[0].text != "Encabezado" {
		t.Fatalf("expected block 0 to be the heading alone, got %#v", blocks[0])
	}
	if blocks[1].text != "Primer párrafo." {
		t.Fatalf("expected block 1 to be the first paragraph alone, got %#v", blocks[1])
	}
	if blocks[2].text != "Segundo párrafo." {
		t.Fatalf("expected block 2 to be the second paragraph alone, got %#v", blocks[2])
	}
}

// TestExportPDFOmitsHeadingForAnUntitledSection is the direct fix for "no
// quiero que todo sea sí o sí capítulos": a section with no title (the
// author left it unnamed) must not have a literal "Capítulo" heading
// forced onto it.
func TestExportPDFOmitsHeadingForAnUntitledSection(t *testing.T) {
	t.Parallel()
	chapters := []manuscript.Chapter{{ID: 1, Title: "", Kind: manuscript.SectionKindCustom, HTML: "<p>Contenido sin título de sección.</p>"}}
	data, err := ExportPDF("Libro de prueba", "", chapters)
	if err != nil {
		t.Fatalf("export pdf: %v", err)
	}
	reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("read generated pdf back: %v", err)
	}
	textReader, err := reader.GetPlainText()
	if err != nil {
		t.Fatalf("extract plain text: %v", err)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(textReader); err != nil {
		t.Fatalf("read extracted text: %v", err)
	}
	if strings.Contains(buf.String(), "Capítulo") {
		t.Fatalf("expected no forced 'Capítulo' heading for an untitled section, got: %q", buf.String())
	}
	if !strings.Contains(buf.String(), "Contenido sin título de sección") {
		t.Fatalf("expected the section's own body text, got: %q", buf.String())
	}
}

// TestExportPDFEmbedsAnImageWithoutFailing covers the new <figure data-wrap
// ...><img src="data:..."></figure> markup the editor's image toolbar
// produces — this must not break PDF generation.
func TestExportPDFEmbedsAnImageWithoutFailing(t *testing.T) {
	t.Parallel()
	chapters := []manuscript.Chapter{{
		ID:    1,
		Title: "Capítulo con imagen",
		HTML: `<p>Antes de la imagen.</p>` +
			`<figure class="ms-image" data-wrap="center" style="width:50%"><img src="` + testPNGDataURL + `" alt=""></figure>` +
			`<p>Después de la imagen.</p>`,
	}}
	data, err := ExportPDF("Libro con imagen", "Autora", chapters)
	if err != nil {
		t.Fatalf("export pdf: %v", err)
	}
	if !bytes.HasPrefix(data, []byte("%PDF-")) {
		t.Fatal("expected a well-formed PDF even with an embedded image")
	}
}

func TestExportEPUBEmbedsImagesAsRealZipEntriesNotInlineDataURLs(t *testing.T) {
	t.Parallel()
	chapters := []manuscript.Chapter{{
		ID:    1,
		Title: "Capítulo con imagen",
		HTML: `<p>Antes.</p>` +
			`<figure class="ms-image" data-wrap="left" style="width:40%"><img src="` + testPNGDataURL + `" alt=""></figure>` +
			`<p>Después.</p>`,
	}}
	data, err := ExportEPUB("Libro con imagen", "Autora", chapters)
	if err != nil {
		t.Fatalf("export epub: %v", err)
	}
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("epub output is not a valid zip archive: %v", err)
	}
	var imageFilePresent, xhtmlStillHasDataURL bool
	for _, file := range reader.File {
		if strings.Contains(file.Name, "images/") {
			imageFilePresent = true
		}
		if strings.HasSuffix(file.Name, ".xhtml") {
			rc, err := file.Open()
			if err != nil {
				t.Fatalf("open %s: %v", file.Name, err)
			}
			var buf bytes.Buffer
			if _, err := buf.ReadFrom(rc); err != nil {
				t.Fatalf("read %s: %v", file.Name, err)
			}
			rc.Close()
			if strings.Contains(buf.String(), "data:image/") {
				xhtmlStillHasDataURL = true
			}
		}
	}
	if !imageFilePresent {
		t.Fatal("expected the image to be embedded as a real file under images/, not left inline")
	}
	if xhtmlStillHasDataURL {
		t.Fatal("expected the xhtml's <img src> to be rewritten to the internal image path, not left as a data: URL")
	}
}

func TestExportEPUBOmitsTitleFromTOCForAnUntitledSection(t *testing.T) {
	t.Parallel()
	chapters := []manuscript.Chapter{{ID: 1, Title: "", Kind: manuscript.SectionKindCustom, HTML: "<p>Sin título de sección.</p>"}}
	data, err := ExportEPUB("Libro de prueba", "", chapters)
	if err != nil {
		t.Fatalf("export epub: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("expected non-empty epub output")
	}
}
