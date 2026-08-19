package postgres

import "testing"

func TestMigrationVersion(t *testing.T) {
	t.Parallel()
	version, err := migrationVersion("001_initial_schema.up.sql")
	if err != nil || version != 1 {
		t.Fatalf("expected version 1, got %d, %v", version, err)
	}
	if _, err := migrationVersion("invalid.sql"); err == nil {
		t.Fatal("expected invalid migration name to fail")
	}
}
