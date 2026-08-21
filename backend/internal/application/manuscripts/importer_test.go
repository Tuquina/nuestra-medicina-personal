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
	want := "<p>Primer párrafo.</p><p>Segundo párrafo<br>con salto simple.</p>"
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
	want := "<h1>Introducción</h1><p>Texto normal con <b>negrita</b> y <i>itálica</i>.</p>"
	if len(chapters) != 1 || chapters[0].HTML != want {
		t.Fatalf("unexpected chapters: %#v\nwant html: %s", chapters, want)
	}
}

func TestImportPDFRoundTripsTextGeneratedByOurOwnExporter(t *testing.T) {
	t.Parallel()
	// Cross-checks two independent libraries against each other: generate a
	// PDF with our own exporter, then confirm a real PDF reader can recover
	// the text we put in it.
	pdfBytes, err := ExportPDF("Libro de prueba", "Autora de prueba", []manuscript.Chapter{
		{ID: 1, Title: "Capítulo uno", HTML: "<p>Contenido reconocible del primer capítulo.</p>"},
	})
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
