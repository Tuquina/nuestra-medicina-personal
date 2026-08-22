package manuscripts

import _ "embed"

// The book body font, embedded into the binary and registered with gpdf so
// PDF export renders real glyphs from the font's own cmap instead of going
// through gpdf's fallback path for an unregistered family — that fallback
// writes text as WinAnsi-encoded bytes against the core 14 "Helvetica" font
// without ever declaring /Encoding /WinAnsiEncoding on it, so PDF viewers
// read those bytes back against the font's implicit *StandardEncoding*
// instead, which silently maps Spanish accented letters to unrelated glyphs
// (é/í came out as Ø/Æ in a book generated before this fix) — the exact bug
// this fixes. PT Serif (Google Fonts, OFL) ships real static Bold/Italic/
// BoldItalic instances (most families on Google Fonts today are
// variable-only, which gpdf.WithFont can't select a weight from), reads
// well at book body size, and covers Spanish accents/ñ/¿/¡ plus the rest of
// Latin Extended.
//
// PDFFontFamily is also the key gpdf's font resolver expects for the
// bold/italic variants — it looks up "<family>-Bold" / "<family>-Italic" /
// "<family>-BoldItalic" by convention (document/render + template/fontresolver
// in gpdf), which is why each variant below is registered under a name built
// from PDFFontFamily rather than an arbitrary key.
const PDFFontFamily = "PTSerif"

//go:embed fonts/PTSerif-Regular.ttf
var pdfFontRegular []byte

//go:embed fonts/PTSerif-Bold.ttf
var pdfFontBold []byte

//go:embed fonts/PTSerif-Italic.ttf
var pdfFontItalic []byte

//go:embed fonts/PTSerif-BoldItalic.ttf
var pdfFontBoldItalic []byte
