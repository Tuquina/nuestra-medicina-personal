package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/nuestra-medicina-personal/backend/internal/config"
	"github.com/nuestra-medicina-personal/backend/internal/infrastructure/postgres"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	pool, err := postgres.Open(ctx, cfg.DatabaseURL, 1, cfg.DatabaseTimeout)
	if err != nil {
		logger.Error("connect database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	directory := os.Getenv("MIGRATIONS_PATH")
	if directory == "" {
		directory = "../migrations"
	}
	if err := postgres.RunMigrations(ctx, pool, directory); err != nil {
		logger.Error("apply migrations", "error", err)
		os.Exit(1)
	}
	logger.Info("migrations applied")
}
