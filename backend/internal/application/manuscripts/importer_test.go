package manuscripts

import (
	"archive/zip"
	"bytes"
	"errors"
	"strings"
	"testing"

	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

func TestImportRejectsUnsupportedExtension(t *testing.T) {
	t.Parallel()
	if _, err := Import("manuscript.rtf", []byte("whatever")); !errors.Is(err, manuscript.ErrUnsupportedFormat) {
		t.Fatalf("expected unsupported format, got %v", err)
	}
}

func TestImportPlainTextSplitsParagraphs(t *testing.T) {
	t.Parallel()
	chapters, err := Import("manuscript.txt", []byte("Primer párrafo.\n\nSegundo párrafo\ncon salto simple."))
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if len(chapters) != 1 || chapters[0].ID != 1 {
		t.Fatalf("expected a single chapter, got %#v", chapters)
	}
	// Void elements come back self-closed: imported chapters are
	// re-serialized as XHTML so the EPUB they end up in stays well-formed
	// XML (see ExportEPUB), not just parseable-as-HTML.
	want := "<p>Primer párrafo.</p><p>Segundo párrafo<br />con salto simple.</p>"
	if chapters[0].HTML != want {
		t.Fatalf("unexpected html:\n got: %s\nwant: %s", chapters[0].HTML, want)
	}
}

func TestImportRejectsCorruptDocxWithValidExtension(t *testing.T) {
	t.Parallel()
	// Right extension, but the content isn't even a zip — must fail closed
	// with a typed error instead of a generic panic/500.
	if _, err := Import("manuscript.docx", []byte("not a zip file")); !errors.Is(err, manuscript.ErrUnsupportedFormat) {
		t.Fatalf("expected unsupported format for a non-zip .docx, got %v", err)
	}
}

func TestImportDocxReconstructsHeadingsAndInlineFormatting(t *testing.T) {
	t.Parallel()
	documentXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Introducción</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t xml:space="preserve">Texto normal con </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>negrita</w:t></w:r>
      <w:r><w:t xml:space="preserve"> y </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>itálica</w:t></w:r>
      <w:r><w:t>.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
	docx := buildTestDocx(t, documentXML)

	chapters, err := Import("manuscript.docx", docx)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	// The document's own Heading1 becomes the section's title rather than
	// being repeated inside the body — both exporters already render the
	// section heading themselves.
	want := "<p>Texto normal con <b>negrita</b> y <i>itálica</i>.</p>"
	if len(chapters) != 1 || chapters[0].HTML != want {
		t.Fatalf("unexpected chapters: %#v\nwant html: %s", chapters, want)
	}
	if chapters[0].Title != "Introducción" || chapters[0].TitleMode != manuscript.TitleModeCustom {
		t.Fatalf("expected the heading to become a custom section title, got %#v", chapters[0])
	}
}

// A document that uses headings to separate its chapters should import as
// separate sections — having to hand-split a whole imported book was the
// biggest friction point in getting an existing manuscript into the editor.
func TestImportSplitsIntoChaptersOnTopLevelHeadings(t *testing.T) {
	t.Parallel()
	documentXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Primero</w:t></w:r></w:p>
    <w:p><w:r><w:t>Cuerpo del primero.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Segundo</w:t></w:r></w:p>
    <w:p><w:r><w:t>Cuerpo del segundo.</w:t></w:r></w:p>
  </w:body>
</w:document>`

	chapters, err := Import("manuscript.docx", buildTestDocx(t, documentXML))
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if len(chapters) != 2 {
		t.Fatalf("expected 2 chapters, got %d: %#v", len(chapters), chapters)
	}
	if chapters[0].Title != "Primero" || !strings.Contains(chapters[0].HTML, "Cuerpo del primero") {
		t.Fatalf("unexpected first chapter: %#v", chapters[0])
	}
	if chapters[1].Title != "Segundo" || !strings.Contains(chapters[1].HTML, "Cuerpo del segundo") {
		t.Fatalf("unexpected second chapter: %#v", chapters[1])
	}
	if chapters[0].ID == chapters[1].ID {
		t.Fatalf("expected distinct chapter ids, got %d twice", chapters[0].ID)
	}
}

// A document with no headings at all still imports as a single chapter,
// exactly as it did before splitting existed.
func TestImportKeepsAHeadinglessDocumentAsOneChapter(t *testing.T) {
	t.Parallel()
	chapters, err := Import("manuscript.txt", []byte("Sólo un párrafo.\n\nY otro más."))
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if len(chapters) != 1 || chapters[0].Title != "Capítulo 1" {
		t.Fatalf("expected one auto-titled chapter, got %#v", chapters)
	}
}

func TestImportPDFRoundTripsTextGeneratedByOurOwnExporter(t *testing.T) {
	t.Parallel()
	// Cross-checks two independent libraries against each other: generate a
	// PDF with our own exporter, then confirm a real PDF reader can recover
	// the text we put in it.
	pdfBytes, err := ExportPDF("Libro de prueba", "Autora de prueba", []manuscript.Chapter{
		{ID: 1, Title: "Capítulo uno", HTML: "<p>Contenido reconocible del primer capítulo.</p>"},
	}, manuscript.DefaultPageSizeID)
	if err != nil {
		t.Fatalf("export pdf: %v", err)
	}
	chapters, err := Import("manuscript.pdf", pdfBytes)
	if err != nil {
		t.Fatalf("import pdf: %v", err)
	}
	if len(chapters) != 1 {
		t.Fatalf("expected a single chapter, got %#v", chapters)
	}
	if !strings.Contains(chapters[0].HTML, "reconocible") {
		t.Fatalf("expected extracted text to contain our known content, got: %s", chapters[0].HTML)
	}
}

// buildTestDocx wraps documentXML as the sole member of a zip archive named
// word/document.xml — the only file our importer actually reads, so it's
// the only one a test fixture needs.
func buildTestDocx(t *testing.T, documentXML string) []byte {
	t.Helper()
	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	entry, err := writer.Create("word/document.xml")
	if err != nil {
		t.Fatalf("create zip entry: %v", err)
	}
	if _, err := entry.Write([]byte(documentXML)); err != nil {
		t.Fatalf("write zip entry: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close zip writer: %v", err)
	}
	return buf.Bytes()
}
