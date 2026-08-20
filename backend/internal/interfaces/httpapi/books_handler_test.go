package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nuestra-medicina-personal/backend/internal/domain/book"
)

type landingConflictBookService struct{ bookServiceStub }

func (landingConflictBookService) Create(context.Context, book.Book) (book.Book, error) {
	return book.Book{}, book.ErrLandingNotPublished
}

func TestCreateBookReportsUnpublishedLandingConflict(t *testing.T) {
	t.Parallel()
	handler := NewBookHandler(
		landingConflictBookService{},
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/books", strings.NewReader(`{
		"slug":"un-libro",
		"title":"Un libro",
		"variant":"gold",
		"priceMinorUnits":1000,
		"currency":"ARS",
		"status":"PUBLISHED",
		"seoIndexable":true
	}`))
	recorder := httptest.NewRecorder()

	handler.Create(recorder, request)

	if recorder.Code != http.StatusConflict || !strings.Contains(recorder.Body.String(), `"code":"BOOK_LANDING_NOT_PUBLISHED"`) {
		t.Fatalf("expected landing publication conflict, got %d: %s", recorder.Code, recorder.Body.String())
	}
}
