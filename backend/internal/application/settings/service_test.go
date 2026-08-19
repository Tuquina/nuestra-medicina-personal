package settings

import (
	"context"
	"testing"
	"time"

	settingsdomain "github.com/nuestra-medicina-personal/backend/internal/domain/settings"
)

type repositoryStub struct{ updated settingsdomain.Settings }

func (stub *repositoryStub) Get(context.Context) (settingsdomain.Settings, error) {
	return stub.updated, nil
}
func (stub *repositoryStub) Update(_ context.Context, value settingsdomain.Settings) (settingsdomain.Settings, error) {
	stub.updated = value
	return value, nil
}

func TestUpdateNormalizesAndStampsSettings(t *testing.T) {
	repository := &repositoryStub{}
	service := NewService(repository)
	wantTime := time.Date(2026, 8, 20, 10, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return wantTime }
	_, err := service.Update(context.Background(), settingsdomain.Settings{
		SiteName: " Site ", SupportEmail: " SUPPORT@example.com ",
		NewsletterEmail: "news@example.com", SenderName: " Sender ",
	})
	if err != nil {
		t.Fatal(err)
	}
	if repository.updated.SiteName != "Site" || repository.updated.SupportEmail != "support@example.com" || !repository.updated.UpdatedAt.Equal(wantTime) {
		t.Fatalf("unexpected update: %#v", repository.updated)
	}
}
