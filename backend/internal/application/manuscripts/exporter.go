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
	"github.com/gpdf-dev/gpdf/pdf"
	"github.com/gpdf-dev/gpdf/template"
	"golang.org/x/net/html"

	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

// ---- Shared typography -------------------------------------------------
//
// The editor draws the manuscript on a simulated physical page: the
// editable area is exactly the chosen paper's width, with 1in margins, at
// 17px/1.85 line-height (see ManuscritoTab.module.css). CSS defines the
// pixel as a fixed 1/96in, so that 17px is a real physical 12.75pt — which
// means using these numbers in the PDF reproduces the editor's own line
// wrapping, not merely a similar-looking approximation. It also makes the
// editor's "N hojas en esta sección" counter actually predict the exported
// page count.

const (
	bodyFontSizePt = 17.0 * 72.0 / 96.0 // the editor's 17px, in points
	bodyLineHeight = 1.85               // .editable's line-height
	mmToPt         = 2.83465
	// cssPxToPt converts the browser's fixed 1/96in pixel to points, used
	// for the block margins/indents below, which are browser defaults
	// expressed in px or em.
	cssPxToPt = 72.0 / 96.0
)

// blockSpec is the typography of one block kind. Sizes and margins mirror
// the browser's own default stylesheet, because that is literally what
// renders inside the contentEditable the author is looking at: headings at
// 2em/1.5em/1.17em with 0.67em/0.83em/1em margins, paragraphs at 1em with
// 1em margins, and so on. Margins are in em *of the block's own font
// size*, following CSS.
type blockSpec struct {
	fontEm         float64
	marginTopEm    float64
	marginBottomEm float64
	bold           bool
	italic         bool
	// indentPx is a left inset in CSS pixels (browsers indent lists and
	// blockquotes by 40px).
	indentPx     float64
	defaultAlign textAlign
}

func specFor(block docBlock) blockSpec {
	switch block.kind {
	case kindH1:
		return blockSpec{fontEm: 2, marginTopEm: 0.67, marginBottomEm: 0.67, bold: true}
	case kindH2:
		return blockSpec{fontEm: 1.5, marginTopEm: 0.83, marginBottomEm: 0.83, bold: true}
	case kindH3:
		return blockSpec{fontEm: 1.17, marginTopEm: 1, marginBottomEm: 1, bold: true}
	case kindQuote:
		return blockSpec{fontEm: 1, marginTopEm: 1, marginBottomEm: 1, italic: true, indentPx: 40}
	case kindListItem:
		// Items inside a list have no margins of their own; the gap above
		// and below the list as a whole comes from the neighbouring
		// paragraph's 1em margin collapsing against it.
		return blockSpec{fontEm: 1, indentPx: 40 * float64(max(block.listDepth, 1))}
	case kindImage:
		return blockSpec{fontEm: 1, marginTopEm: 0.5, marginBottomEm: 0.9}
	case kindRule:
		return blockSpec{fontEm: 1, marginTopEm: 0.5, marginBottomEm: 0.5}
	default:
		return blockSpec{fontEm: 1, marginTopEm: 1, marginBottomEm: 1}
	}
}

func (s blockSpec) fontSizePt() float64 { return bodyFontSizePt * s.fontEm }

// ---- EPUB --------------------------------------------------------------

// ExportEPUB builds a real EPUB3 file from the saved chapters.
//
// Each chapter's HTML is re-serialized as XHTML rather than passed
// through verbatim: go-epub splices the body in as raw innerxml without
// validating it (see its xhtml.go), so an unclosed HTML5 void tag — a
// `<br>` from any line break, an `<img>` from any inserted image — would
// otherwise produce an EPUB whose XHTML is not well-formed XML at all,
// which strict readers and epubcheck reject. A stylesheet mirroring the
// editor's own typography is attached to every section so the book reads
// the way it looked while being written, instead of falling back to
// whatever defaults the reader happens to have.
//
// A chapter with an empty title (a section the author deliberately left
// unnamed — see manuscript.SectionKind) is simply omitted from the table
// of contents, matching go-epub's own "title is optional" behaviour,
// instead of having a "Capítulo" label forced onto it.
func ExportEPUB(bookTitle, authorName string, chapters []manuscript.Chapter) ([]byte, error) {
	book, err := epub.NewEpub(bookTitle)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	if authorName != "" {
		book.SetAuthor(authorName)
	}

	cssPath, err := book.AddCSS(cssDataURL(epubStylesheet), "manuscript.css")
	if err != nil {
		return nil, fmt.Errorf("%w: add stylesheet: %v", manuscript.ErrConversionFailed, err)
	}

	for index, chapter := range chapters {
		body, err := chapterXHTML(book, index, chapter)
		if err != nil {
			return nil, fmt.Errorf("%w: chapter %q: %v", manuscript.ErrConversionFailed, chapter.Title, err)
		}
		if _, err := book.AddSection(body, chapter.Title, "", cssPath); err != nil {
			return nil, fmt.Errorf("%w: add chapter %q: %v", manuscript.ErrConversionFailed, chapter.Title, err)
		}
	}

	var buf bytes.Buffer
	if _, err := book.WriteTo(&buf); err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	return buf.Bytes(), nil
}

// chapterXHTML embeds the chapter's images into the EPUB, prepends its
// heading, and serializes the result as well-formed XHTML.
func chapterXHTML(book *epub.Epub, index int, chapter manuscript.Chapter) (string, error) {
	root, err := html.Parse(strings.NewReader("<div>" + chapter.HTML + "</div>"))
	if err != nil {
		return "", err
	}
	container := firstElementByTag(root, "div")
	if container == nil {
		return "", nil
	}
	embedChapterImages(book, index, container)

	var body strings.Builder
	if chapter.Title != "" {
		tag := "h1"
		class := "ms-chapter-title"
		if chapter.EffectiveKind() == manuscript.SectionKindCover {
			class = "ms-cover-title"
		}
		fmt.Fprintf(&body, "<%s class=%q>%s</%s>\n", tag, class, escapeXMLText(chapter.Title), tag)
	}
	for child := container.FirstChild; child != nil; child = child.NextSibling {
		renderXHTML(&body, child)
	}
	return body.String(), nil
}

// embedChapterImages rewrites every <img src="data:…"> to a real
// EPUB-internal path, so images become proper zip entries instead of
// giant base64 blobs inlined into the XHTML. An image that cannot be
// embedded keeps its original data: src rather than failing the export.
func embedChapterImages(book *epub.Epub, chapterIndex int, root *html.Node) {
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
						continue // leave this occurrence as-is; keep going
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
	walk(root)
}

func cssDataURL(css string) string {
	return "data:text/css;base64," + base64.StdEncoding.EncodeToString([]byte(css))
}

// ---- PDF ---------------------------------------------------------------

// ExportPDF renders the saved chapters as a real book-shaped PDF on the
// paper size the author chose in the editor.
//
// Fidelity is the point here: every block keeps its own alignment, its
// inline runs (a single bold or coloured word mid-sentence survives as its
// own styled fragment via gpdf's RichText), its relative font size, and
// the browser-default margins that produce the spacing the author sees on
// screen — including CSS margin collapsing between adjacent blocks, which
// is what makes headings sit at the right distance from their paragraphs.
//
// Body text is drawn with an embedded PT Serif rather than gpdf's default:
// with no font registered, gpdf falls back to the core "Helvetica" font and
// writes text as WinAnsi-encoded bytes without ever declaring
// /Encoding /WinAnsiEncoding on that font — PDF viewers then read those
// bytes back against Helvetica's *implicit* StandardEncoding instead,
// which silently renders Spanish accented letters as unrelated glyphs
// (é/í came out as Ø/Æ). An embedded TrueType font sidesteps that path
// entirely — gpdf encodes text against the font's own cmap.
func ExportPDF(bookTitle, authorName string, chapters []manuscript.Chapter, pageSizeID string) ([]byte, error) {
	size := manuscript.FindPageSize(pageSizeID)
	doc := gpdf.NewDocument(
		gpdf.WithPageSize(document.Size{
			Width:  size.WidthMm * mmToPt,
			Height: size.HeightMm * mmToPt,
		}),
		gpdf.WithMargins(document.UniformEdges(document.Mm(manuscript.PageMarginMm))),
		gpdf.WithFont(PDFFontFamily, pdfFontRegular),
		gpdf.WithFont(PDFFontFamily+"-Bold", pdfFontBold),
		gpdf.WithFont(PDFFontFamily+"-Italic", pdfFontItalic),
		gpdf.WithFont(PDFFontFamily+"-BoldItalic", pdfFontBoldItalic),
		gpdf.WithDefaultFont(PDFFontFamily, bodyFontSizePt),
		gpdf.WithMetadata(document.DocumentMetadata{
			Title:   bookTitle,
			Author:  authorName,
			Creator: "Nuestra Medicina Personal",
		}),
	)

	// Only generate a title page when the author hasn't written their own
	// portada — otherwise the book would open with two competing covers.
	if !hasCoverSection(chapters) {
		renderTitlePage(doc, bookTitle, authorName)
	}

	for _, chapter := range chapters {
		blocks, err := parseChapterBlocks(chapter.HTML)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
		}
		page := doc.AddPage()
		pendingBottomPt := renderChapterHeading(page, chapter)
		for index, block := range blocks {
			spec := specFor(block)
			gap := 0.0
			if !(index == 0 && pendingBottomPt == 0) && !block.tight {
				gap = max(pendingBottomPt, spec.marginTopEm*spec.fontSizePt())
			}
			emitSpacer(page, gap)
			renderBlock(page, block, spec)
			pendingBottomPt = spec.marginBottomEm * spec.fontSizePt()
		}
	}

	data, err := doc.Generate()
	if err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	return data, nil
}

func hasCoverSection(chapters []manuscript.Chapter) bool {
	for _, chapter := range chapters {
		if chapter.EffectiveKind() == manuscript.SectionKindCover {
			return true
		}
	}
	return false
}

func renderTitlePage(doc *template.Document, bookTitle, authorName string) {
	page := doc.AddPage()
	// Push the title down towards the optical centre rather than leaving
	// it stranded against the top margin.
	emitSpacer(page, 70*mmToPt)
	emitLine(page, bookTitle, bodyFontSizePt*2.2, true, false, alignCenter, 0)
	if authorName != "" {
		emitSpacer(page, bodyFontSizePt)
		emitLine(page, authorName, bodyFontSizePt*1.2, false, false, alignCenter, 0)
	}
}

// renderChapterHeading draws the section's own title and returns the
// bottom margin it leaves behind, so the first block of the chapter is
// spaced against it by the same collapsing rule as any other pair.
// An empty title (a section the author left unnamed) draws nothing — it
// no longer falls back to a literal "Capítulo".
func renderChapterHeading(page *template.PageBuilder, chapter manuscript.Chapter) float64 {
	if chapter.Title == "" {
		return 0
	}
	if chapter.EffectiveKind() == manuscript.SectionKindCover {
		// A portada reads as a real title page — large and centred —
		// rather than the running head every other section gets.
		emitSpacer(page, 60*mmToPt)
		emitLine(page, chapter.Title, bodyFontSizePt*2.2, true, false, alignCenter, 0)
		return bodyFontSizePt * 2
	}
	emitLine(page, chapter.Title, bodyFontSizePt*1.6, true, false, alignCenter, 0)
	return bodyFontSizePt * 1.6 * 0.83
}

func renderBlock(page *template.PageBuilder, block docBlock, spec blockSpec) {
	switch block.kind {
	case kindImage:
		drawImageBlock(page, block.image)
		return
	case kindRule:
		page.AutoRow(func(row *template.RowBuilder) {
			row.Col(12, func(col *template.ColBuilder) {
				col.Line(template.LineColor(pdf.Gray(0.75)), template.LineThickness(document.Pt(0.5)))
			})
		})
		return
	}

	// A deliberately blank paragraph is a blank line in the manuscript, so
	// it renders as exactly one line of vertical space.
	if len(block.runs) == 0 {
		emitSpacer(page, spec.fontSizePt()*bodyLineHeight)
		return
	}

	fontSizePt := spec.fontSizePt()
	indentPt := spec.indentPx * cssPxToPt
	runs := block.runs
	if block.kind == kindListItem {
		runs = append([]inlineRun{{text: listMarker(block)}}, runs...)
	}

	page.AutoRow(func(row *template.RowBuilder) {
		row.Col(12, func(col *template.ColBuilder) {
			write := func(target *template.ColBuilder) {
				target.RichText(func(rt *template.RichTextBuilder) {
					for _, run := range runs {
						rt.Span(run.text, runOption(run, fontSizePt))
					}
				}, blockOption(spec, block.align, fontSizePt))
			}
			if indentPt > 0 {
				col.Box(write, template.WithBoxPadding(document.Edges{
					Left:  document.Pt(indentPt),
					Right: document.Pt(quoteRightIndentPt(block, spec)),
				}))
				return
			}
			write(col)
		})
	})
}

// quoteRightIndentPt mirrors the browser's `blockquote { margin: 1em 40px }`
// — indented from both sides, unlike a list, which is only indented from
// the left.
func quoteRightIndentPt(block docBlock, spec blockSpec) float64 {
	if block.kind != kindQuote {
		return 0
	}
	return spec.indentPx * cssPxToPt
}

func listMarker(block docBlock) string {
	if block.listOrdered {
		return strconv.Itoa(max(block.listNumber, 1)) + ".  "
	}
	return "•  "
}

// blockOption applies paragraph-level style: size, line height, alignment
// and the kind's own bold/italic default.
func blockOption(spec blockSpec, align textAlign, fontSizePt float64) template.TextOption {
	return func(style *document.Style) {
		style.FontSize = fontSizePt
		style.LineHeight = bodyLineHeight
		if spec.bold {
			style.FontWeight = document.WeightBold
		}
		if spec.italic {
			style.FontStyle = document.StyleItalic
		}
		style.TextAlign = documentAlign(align, spec.defaultAlign)
	}
}

// runOption layers one inline run's own formatting over the block style.
// It only ever *sets* attributes, never clears them, so a run inside a
// heading stays bold and a plain run inside a blockquote stays italic.
func runOption(run inlineRun, blockFontSizePt float64) template.TextOption {
	return func(style *document.Style) {
		if run.bold {
			style.FontWeight = document.WeightBold
		}
		if run.italic {
			style.FontStyle = document.StyleItalic
		}
		if run.underline {
			style.TextDecoration |= document.DecorationUnderline
		}
		if run.strike {
			style.TextDecoration |= document.DecorationStrikethrough
		}
		if run.hasColor {
			style.Color = pdf.RGBHex(run.color)
		}
		if run.sizeScale > 0 {
			style.FontSize = blockFontSizePt * run.sizeScale
		}
	}
}

func documentAlign(align, fallback textAlign) document.TextAlign {
	if align == alignInherit {
		align = fallback
	}
	switch align {
	case alignCenter:
		return document.AlignCenter
	case alignRight:
		return document.AlignRight
	case alignJustify:
		return document.AlignJustify
	default:
		return document.AlignLeft
	}
}

func emitSpacer(page *template.PageBuilder, heightPt float64) {
	if heightPt <= 0 {
		return
	}
	page.AutoRow(func(row *template.RowBuilder) {
		row.Col(12, func(col *template.ColBuilder) {
			col.Spacer(document.Pt(heightPt))
		})
	})
}

func emitLine(page *template.PageBuilder, text string, fontSizePt float64, bold, italic bool, align textAlign, indentPt float64) {
	page.AutoRow(func(row *template.RowBuilder) {
		row.Col(12, func(col *template.ColBuilder) {
			options := []template.TextOption{
				template.FontSize(fontSizePt),
				func(style *document.Style) {
					style.LineHeight = bodyLineHeight
					style.TextAlign = documentAlign(align, alignLeft)
					if indentPt > 0 {
						style.Padding.Left = document.Pt(indentPt)
					}
				},
			}
			if bold {
				options = append(options, template.Bold())
			}
			if italic {
				options = append(options, template.Italic())
			}
			col.Text(text, options...)
		})
	})
}

// drawImageBlock lays out one image as its own full-width row.
//
// gpdf's grid lays out one full-width row at a time, with no support for
// flowing text around a floated image, and its absolute positioning always
// paints above the flow content of a single page — which a chapter that
// auto-paginates across several physical pages has no unambiguous anchor
// into. So every wrap mode places the image on its own row here:
// "left"/"right" narrow it and align it to that side, and "free" (the
// editor's draggable, front-or-behind-text placement) falls back to
// centred. The editor itself and the EPUB export — both plain CSS — keep
// the full set of wrap behaviours.
func drawImageBlock(page *template.PageBuilder, image *chapterImage) {
	if image == nil || len(image.bytes) == 0 {
		return
	}
	widthPct := image.widthPct
	if widthPct <= 0 {
		widthPct = 60
	}
	align := document.AlignCenter
	switch image.wrap {
	case "left":
		align = document.AlignLeft
		widthPct = min(widthPct, 45)
	case "right":
		align = document.AlignRight
		widthPct = min(widthPct, 45)
	case "inline":
		align = document.AlignLeft
	}
	page.AutoRow(func(row *template.RowBuilder) {
		row.Col(12, func(col *template.ColBuilder) {
			col.Image(image.bytes, template.FitWidth(document.Pct(widthPct)), template.WithAlign(align))
		})
	})
}

// ---- HTML/XHTML helpers ------------------------------------------------

// imageBlockFrom reads one <figure class="ms-image" data-wrap="…"
// style="width:NN%"><img src="data:…"></figure> — the markup the editor's
// image toolbar inserts (see manuscriptImages.ts) — or a bare <img> with
// no wrapper. Anything whose src is not a decodable PNG/JPEG data URL is
// dropped rather than failing the whole export.
func imageBlockFrom(node *html.Node) (*chapterImage, bool) {
	wrapperAttrs := attrMap(node)
	imgNode := node
	if node.Data == "figure" {
		imgNode = firstElementByTag(node, "img")
		if imgNode == nil {
			return nil, false
		}
	}
	data, ok := decodeDataURLImage(attrMap(imgNode)["src"])
	if !ok {
		return nil, false
	}
	wrap := wrapperAttrs["data-wrap"]
	if wrap == "" {
		wrap = "inline"
	}
	widthPct, _ := widthPercentFromStyle(wrapperAttrs["style"])
	return &chapterImage{bytes: data, wrap: wrap, widthPct: widthPct}, true
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

// decodeDataURLImage accepts only the two formats the editor's image
// toolbar produces (see manuscriptImages.ts), which are also the only two
// gpdf's Image component recognizes by signature.
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
	switch {
	case strings.Contains(header, "image/jpeg"), strings.Contains(header, "image/jpg"):
		return ".jpg"
	case strings.Contains(header, "image/webp"):
		return ".webp"
	case strings.Contains(header, "image/gif"):
		return ".gif"
	default:
		return ".png"
	}
}

// widthPercentFromStyle reads a "width: NN%" declaration out of an inline
// style attribute — the only CSS property the exporters need from it.
func widthPercentFromStyle(style string) (float64, bool) {
	if value, ok := parseStyleAttribute(style)["width"]; ok && strings.HasSuffix(value, "%") {
		if amount, err := strconv.ParseFloat(strings.TrimSuffix(value, "%"), 64); err == nil {
			return amount, true
		}
	}
	return 0, false
}

// voidElements are the HTML elements with no closing tag. XHTML requires
// them self-closed, which is why they cannot simply be written out the way
// html.Render would.
var voidElements = map[string]bool{
	"area": true, "base": true, "br": true, "col": true, "embed": true,
	"hr": true, "img": true, "input": true, "link": true, "meta": true,
	"param": true, "source": true, "track": true, "wbr": true,
}

// renderXHTML serializes a parsed node as well-formed XHTML — the same job
// html.Render does, except void elements are self-closed and attribute
// values are XML-escaped, so the result is valid inside an EPUB's XHTML
// document (see ExportEPUB's doc comment for why that matters).
func renderXHTML(out *strings.Builder, node *html.Node) {
	switch node.Type {
	case html.TextNode:
		out.WriteString(escapeXMLText(node.Data))
		return
	case html.ElementNode:
		out.WriteByte('<')
		out.WriteString(node.Data)
		for _, attr := range node.Attr {
			// Namespaced attributes from a paste (xml:lang, v:shape…) are
			// dropped: without their namespace declared, they would make
			// the document fail to parse as XML.
			if strings.Contains(attr.Key, ":") {
				continue
			}
			fmt.Fprintf(out, " %s=\"%s\"", attr.Key, escapeXMLAttribute(attr.Val))
		}
		if voidElements[node.Data] {
			out.WriteString(" />")
			return
		}
		out.WriteByte('>')
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			renderXHTML(out, child)
		}
		fmt.Fprintf(out, "</%s>", node.Data)
		return
	default:
		// Comments, doctypes and anything else are omitted.
		return
	}
}

func escapeXMLText(text string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")
	return replacer.Replace(text)
}

func escapeXMLAttribute(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;")
	return replacer.Replace(value)
}
