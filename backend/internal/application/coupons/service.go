package coupons

import (
	"context"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/domain/coupon"
)

type Repository interface {
	List(context.Context) ([]coupon.Coupon, error)
	Create(context.Context, coupon.Coupon) (coupon.Coupon, error)
	Update(context.Context, coupon.Coupon) (coupon.Coupon, error)
	Delete(context.Context, string) error
}

type Service struct {
	repository Repository
	now        func() time.Time
	newID      func() (string, error)
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository, now: time.Now, newID: randomUUID}
}

func (s *Service) List(ctx context.Context) ([]coupon.Coupon, error) {
	return s.repository.List(ctx)
}

func (s *Service) Create(ctx context.Context, value coupon.Coupon) (coupon.Coupon, error) {
	value.Normalize()
	if err := value.Validate(); err != nil {
		return coupon.Coupon{}, err
	}
	id, err := s.newID()
	if err != nil {
		return coupon.Coupon{}, fmt.Errorf("generate coupon id: %w", err)
	}
	now := s.now().UTC()
	value.ID, value.CreatedAt, value.UpdatedAt = id, now, now
	return s.repository.Create(ctx, value)
}

func (s *Service) Update(ctx context.Context, id string, value coupon.Coupon) (coupon.Coupon, error) {
	value.Normalize()
	if err := value.Validate(); err != nil {
		return coupon.Coupon{}, err
	}
	value.ID = id
	value.UpdatedAt = s.now().UTC()
	return s.repository.Update(ctx, value)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repository.Delete(ctx, id)
}

func randomUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
