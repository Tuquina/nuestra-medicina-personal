package email

import "embed"

//go:embed templates/*.html templates/*.txt
var templateFiles embed.FS
