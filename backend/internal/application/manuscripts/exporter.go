package manuscripts

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"

	epub "github.com/go-shiori/go-epub"
	"github.com/gpdf-dev/gpdf"
	"github.com/gpdf-dev/gpdf/document"
	"github.com/gpdf-dev/gpdf/template"
	"golang.org/x/net/html"

	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

// ExportEPUB builds a real EPUB3 file from the saved chapters — each
// chapter's HTML goes straight into its own section, since it's already
// the same constrained tag set (p, h1-h3, blockquote, b, i, u, ul/li,
// figure/img) an EPUB reader renders natively. A chapter with an empty
// title (a section the author deliberately left unnamed — see
// SectionKind) is simply omitted from the table of contents, matching
// go-epub's own "title is optional" behavior, instead of forcing a
// "Capítulo" label onto every section the way this used to.
func ExportEPUB(bookTitle, authorName string, chapters []manuscript.Chapter) ([]byte, error) {
	book, err := epub.NewEpub(bookTitle)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	if authorName != "" {
		book.SetAuthor(authorName)
	}
	for index, chapter := range chapters {
		body, err := embedChapterImages(book, index, chapter.HTML)
		if err != nil {
			return nil, fmt.Errorf("%w: embed images for chapter %q: %v", manuscript.ErrConversionFailed, chapter.Title, err)
		}
		if _, err := book.AddSection(body, chapter.Title, "", ""); err != nil {
			return nil, fmt.Errorf("%w: add chapter %q: %v", manuscript.ErrConversionFailed, chapter.Title, err)
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
// heading, blockquote, list item, image) becomes one styled line/row —
// inline runs within a paragraph (a single bold word in the middle of a
// sentence, say) aren't preserved, only the block's own style. gpdf's
// AutoRow flows and paginates automatically, so chapters aren't
// pre-measured against a fixed page height here.
//
// Body text is drawn with an embedded PT Serif rather than gpdf's default:
// with no font registered, gpdf falls back to the core "Helvetica" font and
// writes text as WinAnsi-encoded bytes without ever declaring
// /Encoding /WinAnsiEncoding on that font — PDF viewers then read those
// bytes back against Helvetica's *implicit* StandardEncoding instead, which
// silently renders Spanish accented letters as unrelated glyphs (é/í came
// out as Ø/Æ). An embedded TrueType font sidesteps that path entirely —
// gpdf encodes text against the font's own cmap.
func ExportPDF(bookTitle, authorName string, chapters []manuscript.Chapter) ([]byte, error) {
	doc := gpdf.NewDocument(
		gpdf.WithFont(PDFFontFamily, pdfFontRegular),
		gpdf.WithFont(PDFFontFamily+"-Bold", pdfFontBold),
		gpdf.WithFont(PDFFontFamily+"-Italic", pdfFontItalic),
		gpdf.WithFont(PDFFontFamily+"-BoldItalic", pdfFontBoldItalic),
		gpdf.WithDefaultFont(PDFFontFamily, 11),
	)

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
		// An empty title (a section the author left unnamed) simply has no
		// heading row — it no longer falls back to a literal "Capítulo".
		if chapter.Title != "" {
			if chapter.EffectiveKind() == manuscript.SectionKindCover {
				// A portada reads as a real title page — large and
				// centered — rather than the small left-aligned running
				// head every other section gets.
				page.AutoRow(func(r *template.RowBuilder) {
					r.Col(12, func(c *template.ColBuilder) {
						c.Text(chapter.Title, template.FontSize(28), template.Bold(), template.AlignCenter())
					})
				})
			} else {
				page.AutoRow(func(r *template.RowBuilder) {
					r.Col(12, func(c *template.ColBuilder) {
						c.Text(chapter.Title, template.FontSize(20), template.Bold())
					})
				})
			}
		}
		for _, block := range blocks {
			if block.kind == "image" {
				drawImageBlock(page, block.image)
				continue
			}
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
	kind  string
	text  string
	image *pdfImageBlock
}

// pdfImageBlock carries one image out of the chapter HTML into the PDF.
// widthPct/wrap mirror what the editor stores on the image's wrapper (see
// ManuscritoTab's image toolbar) but PDF export only has room for an
// honest subset of it: gpdf's grid lays out one full-width row at a time,
// with no support for flowing text around a floated image or for
// absolutely-positioned content interacting correctly with a chapter that
// spans several auto-paginated pages. So every wrap mode places the image
// on its own row — "left"/"right" narrow it and align it to that side,
// "free" (the editor's draggable, front-or-behind-text placement) falls
// back to centered, same as "center". The editor itself and the EPUB
// export (both are just CSS) keep the full set of wrap behaviors.
type pdfImageBlock struct {
	bytes    []byte
	wrap     string
	widthPct float64
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

// drawImageBlock lays out one image as its own full-width row — see
// pdfImageBlock's doc comment for why every wrap mode collapses to a
// row-based placement here.
func drawImageBlock(page *template.PageBuilder, img *pdfImageBlock) {
	if img == nil || len(img.bytes) == 0 {
		return
	}
	widthPct := img.widthPct
	if widthPct <= 0 {
		widthPct = 60
	}
	align := document.AlignCenter
	switch img.wrap {
	case "left":
		align = document.AlignLeft
		widthPct = min(widthPct, 45)
	case "right":
		align = document.AlignRight
		widthPct = min(widthPct, 45)
	case "inline":
		align = document.AlignLeft
	}
	page.AutoRow(func(r *template.RowBuilder) {
		r.Col(12, func(c *template.ColBuilder) {
			c.Image(img.bytes, template.FitWidth(document.Pct(widthPct)), template.WithAlign(align))
		})
	})
}

// blocksFromChapterHTML walks the chapter's HTML (parsed with the standard
// x/net/html tokenizer rather than hand-rolled regex, since it's already a
// transitive dependency of go-epub) into a flat list of block-level runs
// (text or image), dropping formatting below the block level — see
// ExportPDF's doc comment for what that trades away.
func blocksFromChapterHTML(chapterHTML string) ([]pdfBlock, error) {
	root, err := html.Parse(strings.NewReader("<div>" + chapterHTML + "</div>"))
	if err != nil {
		return nil, err
	}
	// The <div> wrapper above only exists to give html.Parse a single root
	// to hang chapterHTML's own top-level elements off of — it must never
	// itself be treated as one block. blockKindOf below maps "div" to a
	// paragraph (chapterHTML can legitimately contain its own nested divs),
	// so starting the walk at this synthetic wrapper would immediately
	// match *it*, run textContent over the entire chapter, and return one
	// single run-on paragraph with every heading/paragraph/quote mashed
	// together with no space between them — exactly the "run-on wall of
	// text" a generated PDF showed before this fix. Walking the wrapper's
	// children individually instead keeps each of the chapter's own
	// top-level elements as its own block.
	container := firstElementByTag(root, "div")
	if container == nil {
		return nil, nil
	}
	var blocks []pdfBlock
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode {
			if node.Data == "figure" || node.Data == "img" {
				if block, ok := imageBlockFrom(node); ok {
					blocks = append(blocks, block)
				}
				return // image captured (or discarded) as one run either way
			}
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
	for child := container.FirstChild; child != nil; child = child.NextSibling {
		walk(child)
	}
	return blocks, nil
}

// imageBlockFrom reads one <figure class="ms-image" data-wrap="..."
// style="width:NN%"><img src="data:..."></figure> — the exact markup the
// editor's image toolbar inserts (see ManuscritoTab/manuscriptImages.ts) —
// or a bare <img> with no wrapper. Anything whose src isn't a decodable
// PNG/JPEG data URL is dropped rather than failing the whole export.
func imageBlockFrom(node *html.Node) (pdfBlock, bool) {
	wrapperAttrs := attrMap(node)
	imgNode := node
	if node.Data == "figure" {
		imgNode = firstElementByTag(node, "img")
		if imgNode == nil {
			return pdfBlock{}, false
		}
	}
	data, ok := decodeDataURLImage(attrMap(imgNode)["src"])
	if !ok {
		return pdfBlock{}, false
	}
	wrap := wrapperAttrs["data-wrap"]
	if wrap == "" {
		wrap = "inline"
	}
	widthPct, _ := widthPercentFromStyle(wrapperAttrs["style"])
	return pdfBlock{kind: "image", image: &pdfImageBlock{bytes: data, wrap: wrap, widthPct: widthPct}}, true
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

// embedChapterImages rewrites every <img src="data:..."> in chapterHTML
// into a real EPUB-internal path via book.AddImage, so images end up as
// proper zip entries instead of giant inline base64 blobs duplicated
// straight into the XHTML. An image whose data URL can't be embedded (a
// format go-epub rejects, say) is left with its original data: src rather
// than failing the whole export.
func embedChapterImages(book *epub.Epub, chapterIndex int, chapterHTML string) (string, error) {
	if !strings.Contains(chapterHTML, "<img") {
		return chapterHTML, nil
	}
	root, err := html.Parse(strings.NewReader("<div>" + chapterHTML + "</div>"))
	if err != nil {
		return "", err
	}
	container := firstElementByTag(root, "div")
	if container == nil {
		return chapterHTML, nil
	}
	seen := make(map[string]string)
	imageIndex := 0
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "img" {
			for i, attr := range node.Attr {
				if attr.Key != "src" || !strings.HasPrefix(attr.Val, "data:") {
					continue
				}
				internalPath, ok := seen[attr.Val]
				if !ok {
					imageIndex++
					filename := fmt.Sprintf("manuscript-%d-%d%s", chapterIndex, imageIndex, extensionFromDataURL(attr.Val))
					added, addErr := book.AddImage(attr.Val, filename)
					if addErr != nil {
						continue // leave this one occurrence as-is; keep going
					}
					internalPath = added
					seen[attr.Val] = internalPath
				}
				node.Attr[i].Val = internalPath
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(container)
	var buf strings.Builder
	for child := container.FirstChild; child != nil; child = child.NextSibling {
		if err := html.Render(&buf, child); err != nil {
			return "", err
		}
	}
	return buf.String(), nil
}

func firstElementByTag(node *html.Node, tag string) *html.Node {
	if node.Type == html.ElementNode && node.Data == tag {
		return node
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if found := firstElementByTag(child, tag); found != nil {
			return found
		}
	}
	return nil
}

func attrMap(node *html.Node) map[string]string {
	m := make(map[string]string, len(node.Attr))
	for _, attr := range node.Attr {
		m[attr.Key] = attr.Val
	}
	return m
}

// decodeDataURLImage accepts only "data:image/png;base64,..." and
// "data:image/jpeg;base64,..." — the two formats the editor's image
// toolbar ever produces (see manuscriptImages.ts) and the only two gpdf's
// Image component recognizes by signature.
func decodeDataURLImage(src string) ([]byte, bool) {
	if !strings.HasPrefix(src, "data:image/png;base64,") && !strings.HasPrefix(src, "data:image/jpeg;base64,") {
		return nil, false
	}
	_, payload, ok := strings.Cut(src, ",")
	if !ok {
		return nil, false
	}
	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil || len(data) == 0 {
		return nil, false
	}
	return data, true
}

func extensionFromDataURL(dataURL string) string {
	header, _, _ := strings.Cut(dataURL, ",")
	if strings.Contains(header, "image/jpeg") || strings.Contains(header, "image/jpg") {
		return ".jpg"
	}
	if strings.Contains(header, "image/webp") {
		return ".webp"
	}
	if strings.Contains(header, "image/gif") {
		return ".gif"
	}
	return ".png"
}

// widthPercentFromStyle reads a "width: NN%" declaration out of an inline
// style attribute — the only CSS property this exporter needs from it.
func widthPercentFromStyle(style string) (float64, bool) {
	for _, decl := range strings.Split(style, ";") {
		key, value, ok := strings.Cut(decl, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key != "width" || !strings.HasSuffix(value, "%") {
			continue
		}
		amount, err := strconv.ParseFloat(strings.TrimSuffix(value, "%"), 64)
		if err != nil {
			continue
		}
		return amount, true
	}
	return 0, false
}
