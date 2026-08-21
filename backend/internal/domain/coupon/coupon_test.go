package coupon

import (
	"testing"
	"time"
)

func TestCouponNormalizeAndValidate(t *testing.T) {
	limit := 10
	value := Coupon{Code: " bienvenida-10 ", Kind: KindPercentage, Value: 10, StartsAt: mustDate(t, "2026-08-01"), EndsAt: mustDate(t, "2026-08-31"), UsageLimit: &limit, AppliesToAll: true, Active: true}
	value.Normalize()
	if value.Code != "BIENVENIDA-10" || value.Currency != "ARS" {
		t.Fatalf("unexpected normalized coupon: %#v", value)
	}
	if err := value.Validate(); err != nil {
		t.Fatalf("validate coupon: %v", err)
	}
}

func TestCouponRejectsSpecificScopeWithoutBooks(t *testing.T) {
	value := Coupon{Code: "PROMO", Kind: KindFixed, Value: 1000, Currency: "ARS", StartsAt: mustDate(t, "2026-08-01"), EndsAt: mustDate(t, "2026-08-31")}
	if err := value.Validate(); err == nil {
		t.Fatal("expected validation error")
	}
}

func TestCouponEffectiveStatus(t *testing.T) {
	limit := 2
	value := Coupon{Active: true, StartsAt: mustDate(t, "2026-08-01"), EndsAt: mustDate(t, "2026-08-31"), UsageLimit: &limit}
	if got := value.EffectiveStatus(mustDate(t, "2026-07-31")); got != "SCHEDULED" {
		t.Fatalf("got %s", got)
	}
	if got := value.EffectiveStatus(mustDate(t, "2026-08-15")); got != "ACTIVE" {
		t.Fatalf("got %s", got)
	}
	value.UsageCount = 2
	if got := value.EffectiveStatus(mustDate(t, "2026-08-15")); got != "EXPIRED" {
		t.Fatalf("got %s", got)
	}
}

func mustDate(t *testing.T, raw string) time.Time {
	t.Helper()
	value, err := time.Parse("2006-01-02", raw)
	if err != nil {
		t.Fatal(err)
	}
	return value
}
