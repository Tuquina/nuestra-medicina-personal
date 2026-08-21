package manuscripts

import (
	"archive/zip"
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

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
