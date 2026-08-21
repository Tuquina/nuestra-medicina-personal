package manuscripts

import (
	"bytes"
	"fmt"
	"strings"

	epub "github.com/go-shiori/go-epub"
	"github.com/gpdf-dev/gpdf"
	"github.com/gpdf-dev/gpdf/template"
	"golang.org/x/net/html"

	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

// ExportEPUB builds a real EPUB3 file from the saved chapters — each
// chapter's HTML goes straight into its own section, since it's already
// the same constrained tag set (p, h1-h3, blockquote, b, i, u, ul/li) an
// EPUB reader renders natively.
func ExportEPUB(bookTitle, authorName string, chapters []manuscript.Chapter) ([]byte, error) {
	book, err := epub.NewEpub(bookTitle)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	if authorName != "" {
		book.SetAuthor(authorName)
	}
	for _, chapter := range chapters {
		title := chapter.Title
		if title == "" {
			title = "Capítulo"
		}
		if _, err := book.AddSection(chapter.HTML, title, "", ""); err != nil {
			return nil, fmt.Errorf("%w: add chapter %q: %v", manuscript.ErrConversionFailed, title, err)
		}
	}
	var buf bytes.Buffer
	if _, err := book.WriteTo(&buf); err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	return buf.Bytes(), nil
}

// ExportPDF renders a title page plus one section per chapter. Fidelity is
// deliberately modest (ADR 0004): each block-level element (paragraph,
// heading, blockquote, list item) becomes one styled line — inline runs
// within a paragraph (a single bold word in the middle of a sentence, say)
// aren't preserved, only the block's own style. gpdf's AutoRow flows and
// paginates automatically, so chapters aren't pre-measured against a fixed
// page height here.
func ExportPDF(bookTitle, authorName string, chapters []manuscript.Chapter) ([]byte, error) {
	doc := gpdf.NewDocument()

	titlePage := doc.AddPage()
	titlePage.AutoRow(func(r *template.RowBuilder) {
		r.Col(12, func(c *template.ColBuilder) {
			c.Text(bookTitle, template.FontSize(28), template.Bold(), template.AlignCenter())
		})
	})
	if authorName != "" {
		titlePage.AutoRow(func(r *template.RowBuilder) {
			r.Col(12, func(c *template.ColBuilder) {
				c.Text(authorName, template.FontSize(14), template.AlignCenter())
			})
		})
	}

	for _, chapter := range chapters {
		blocks, err := blocksFromChapterHTML(chapter.HTML)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
		}
		page := doc.AddPage()
		title := chapter.Title
		if title == "" {
			title = "Capítulo"
		}
		page.AutoRow(func(r *template.RowBuilder) {
			r.Col(12, func(c *template.ColBuilder) {
				c.Text(title, template.FontSize(20), template.Bold())
			})
		})
		for _, block := range blocks {
			text := block.text
			if block.kind == "li" {
				text = "•  " + text
			}
			options := pdfBlockStyle(block.kind)
			page.AutoRow(func(r *template.RowBuilder) {
				r.Col(12, func(c *template.ColBuilder) {
					c.Text(text, options...)
				})
			})
		}
	}

	data, err := doc.Generate()
	if err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	return data, nil
}

type pdfBlock struct {
	kind string
	text string
}

func pdfBlockStyle(kind string) []template.TextOption {
	switch kind {
	case "h1":
		return []template.TextOption{template.FontSize(18), template.Bold()}
	case "h2":
		return []template.TextOption{template.FontSize(15), template.Bold()}
	case "h3":
		return []template.TextOption{template.FontSize(13), template.Bold()}
	case "quote":
		return []template.TextOption{template.FontSize(11), template.Italic()}
	default:
		return []template.TextOption{template.FontSize(11)}
	}
}

// blocksFromChapterHTML walks the chapter's HTML (parsed with the standard
// x/net/html tokenizer rather than hand-rolled regex, since it's already a
// transitive dependency of go-epub) into a flat list of block-level text
// runs, dropping formatting below the block level — see ExportPDF's doc
// comment for what that trades away.
func blocksFromChapterHTML(chapterHTML string) ([]pdfBlock, error) {
	root, err := html.Parse(strings.NewReader("<div>" + chapterHTML + "</div>"))
	if err != nil {
		return nil, err
	}
	var blocks []pdfBlock
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode {
			if kind, ok := blockKindOf(node.Data); ok {
				if text := strings.TrimSpace(textContent(node)); text != "" {
					blocks = append(blocks, pdfBlock{kind: kind, text: text})
				}
				return // block captured as one run; don't also descend into its children
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return blocks, nil
}

func blockKindOf(tag string) (string, bool) {
	switch tag {
	case "h1":
		return "h1", true
	case "h2":
		return "h2", true
	case "h3":
		return "h3", true
	case "blockquote":
		return "quote", true
	case "li":
		return "li", true
	case "p", "div":
		return "p", true
	default:
		return "", false
	}
}

func textContent(node *html.Node) string {
	var out strings.Builder
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.TextNode {
			out.WriteString(node.Data)
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return out.String()
}
