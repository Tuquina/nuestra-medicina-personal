package settings

import (
	"context"
	"time"

	settingsdomain "github.com/nuestra-medicina-personal/backend/internal/domain/settings"
)

type Repository interface {
	Get(context.Context) (settingsdomain.Settings, error)
	Update(context.Context, settingsdomain.Settings) (settingsdomain.Settings, error)
}

type Service struct {
	repository Repository
	now        func() time.Time
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository, now: time.Now}
}

func (s *Service) Get(ctx context.Context) (settingsdomain.Settings, error) {
	return s.repository.Get(ctx)
}

func (s *Service) Update(ctx context.Context, value settingsdomain.Settings) (settingsdomain.Settings, error) {
	value.Normalize()
	if err := value.Validate(); err != nil {
		return settingsdomain.Settings{}, err
	}
	value.UpdatedAt = s.now().UTC()
	return s.repository.Update(ctx, value)
}
