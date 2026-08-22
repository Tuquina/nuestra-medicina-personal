package manuscripts

import (
	"strings"
	"testing"
)

// blockText joins a block's runs back into plain text, for assertions that
// only care about the words and not their formatting.
func blockText(block docBlock) string {
	var out strings.Builder
	for _, run := range block.runs {
		out.WriteString(run.text)
	}
	return out.String()
}

// The whole point of the block model is that formatting *inside* a
// paragraph survives into the PDF. Previously a paragraph became one
// unstyled string, so a bold word mid-sentence was silently flattened.
func TestParseKeepsInlineFormattingWithinAParagraph(t *testing.T) {
	t.Parallel()
	blocks, err := parseChapterBlocks("<p>Un texto <b>en negrita</b> y otro <i>en itálica</i>.</p>")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(blocks) != 1 {
		t.Fatalf("expected one paragraph, got %d: %#v", len(blocks), blocks)
	}
	runs := blocks[0].runs
	if len(runs) != 5 {
		t.Fatalf("expected 5 runs (plain/bold/plain/italic/plain), got %d: %#v", len(runs), runs)
	}
	if runs[1].text != "en negrita" || !runs[1].bold {
		t.Fatalf("expected run 1 to be the bold fragment, got %#v", runs[1])
	}
	if runs[3].text != "en itálica" || !runs[3].italic {
		t.Fatalf("expected run 3 to be the italic fragment, got %#v", runs[3])
	}
	if runs[0].bold || runs[0].italic {
		t.Fatalf("expected run 0 to carry no formatting, got %#v", runs[0])
	}
}

// Nested inline elements must compose rather than the innermost winning.
func TestParseComposesNestedInlineFormatting(t *testing.T) {
	t.Parallel()
	blocks, err := parseChapterBlocks(`<p><span style="color:#ff0000"><b><u>rojo negrita subrayado</u></b></span></p>`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(blocks) != 1 || len(blocks[0].runs) != 1 {
		t.Fatalf("expected a single run, got %#v", blocks)
	}
	run := blocks[0].runs[0]
	if !run.bold || !run.underline || !run.hasColor || run.color != 0xff0000 {
		t.Fatalf("expected bold+underline+red to compose onto one run, got %#v", run)
	}
}

// The editor's colour picker and its legacy execCommand output must both
// resolve to the same colour.
func TestParseReadsColourFromBothFontTagAndCSS(t *testing.T) {
	t.Parallel()
	for _, markup := range []string{
		`<p><font color="#3366cc">azul</font></p>`,
		`<p><span style="color: rgb(51, 102, 204)">azul</span></p>`,
		`<p><span style="color:#36c">azul</span></p>`,
	} {
		blocks, err := parseChapterBlocks(markup)
		if err != nil {
			t.Fatalf("parse %q: %v", markup, err)
		}
		if len(blocks) != 1 || len(blocks[0].runs) != 1 {
			t.Fatalf("%q: expected a single run, got %#v", markup, blocks)
		}
		run := blocks[0].runs[0]
		if !run.hasColor || run.color != 0x3366cc {
			t.Fatalf("%q: expected #3366cc, got %#v", markup, run)
		}
	}
}

// Alignment is what the toolbar's four align buttons produce; if the
// exporter ignores it, every button looks like it does the same thing.
func TestParseReadsBlockAlignment(t *testing.T) {
	t.Parallel()
	blocks, err := parseChapterBlocks(
		`<p style="text-align:center">centro</p>` +
			`<p style="text-align:right">derecha</p>` +
			`<p style="text-align:justify">justificado</p>` +
			`<p>izquierda</p>`,
	)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	want := []textAlign{alignCenter, alignRight, alignJustify, alignInherit}
	if len(blocks) != len(want) {
		t.Fatalf("expected %d blocks, got %d: %#v", len(want), len(blocks), blocks)
	}
	for i, expected := range want {
		if blocks[i].align != expected {
			t.Fatalf("block %d (%q): expected align %v, got %v", i, blockText(blocks[i]), expected, blocks[i].align)
		}
	}
}

// A centred wrapper div must pass its alignment down to the paragraphs
// inside it, which is how execCommand often applies alignment.
func TestParseInheritsAlignmentFromAWrapper(t *testing.T) {
	t.Parallel()
	blocks, err := parseChapterBlocks(`<div style="text-align:center"><p>uno</p><p>dos</p></div>`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(blocks) != 2 {
		t.Fatalf("expected 2 paragraphs, got %d: %#v", len(blocks), blocks)
	}
	for i, block := range blocks {
		if block.align != alignCenter {
			t.Fatalf("block %d: expected centred, got %v", i, block.align)
		}
	}
}

func TestParseNumbersOrderedListItems(t *testing.T) {
	t.Parallel()
	blocks, err := parseChapterBlocks(`<ol><li>uno</li><li>dos</li><li>tres</li></ol>`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(blocks) != 3 {
		t.Fatalf("expected 3 list items, got %d: %#v", len(blocks), blocks)
	}
	for i, block := range blocks {
		if block.kind != kindListItem || !block.listOrdered {
			t.Fatalf("block %d: expected an ordered list item, got %#v", i, block)
		}
		if block.listNumber != i+1 {
			t.Fatalf("block %d: expected number %d, got %d", i, i+1, block.listNumber)
		}
	}
}

// `<p><br></p>` is how a contentEditable stores a deliberately blank line.
// Dropping it would silently close up the gaps an author put between
// scenes.
func TestParseKeepsADeliberatelyBlankParagraph(t *testing.T) {
	t.Parallel()
	blocks, err := parseChapterBlocks("<p>antes</p><p><br></p><p>después</p>")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(blocks) != 3 {
		t.Fatalf("expected the blank line to survive as its own block, got %d: %#v", len(blocks), blocks)
	}
	if len(blocks[1].runs) != 0 {
		t.Fatalf("expected block 1 to be the empty paragraph, got %#v", blocks[1])
	}
}

func TestParseSplitsAParagraphOnLineBreaks(t *testing.T) {
	t.Parallel()
	blocks, err := parseChapterBlocks("<p>primera<br>segunda</p>")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(blocks) != 2 {
		t.Fatalf("expected 2 lines, got %d: %#v", len(blocks), blocks)
	}
	if blockText(blocks[0]) != "primera" || blockText(blocks[1]) != "segunda" {
		t.Fatalf("unexpected line contents: %q / %q", blockText(blocks[0]), blockText(blocks[1]))
	}
	// The second line is part of the same paragraph, so it must not open a
	// new one with a full paragraph gap above it.
	if !blocks[1].tight {
		t.Fatal("expected the post-<br> line to be marked tight")
	}
}

func TestParseCollapsesWhitespaceLikeABrowser(t *testing.T) {
	t.Parallel()
	blocks, err := parseChapterBlocks("<p>uno\n   dos\t\tres</p>")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if got := blockText(blocks[0]); got != "uno dos res" {
		t.Fatalf("expected collapsed whitespace, got %q", got)
	}
}
