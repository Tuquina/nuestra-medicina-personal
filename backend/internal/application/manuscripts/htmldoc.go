package manuscripts

import (
	"strconv"
	"strings"

	"golang.org/x/net/html"
)

// This file turns a chapter's editor HTML into a flat list of styled
// blocks. It exists so PDF export can reproduce what the author actually
// sees in the editor — alignment, bold/italic/underline runs *inside* a
// paragraph, colours, relative font sizes and list structure — instead of
// the previous "one block = one unstyled line of text" approximation,
// which is what made a generated PDF look nothing like the preview.
//
// The supported subset is exactly what the editor itself can produce (see
// ManuscritoTab's toolbar and manuscriptImages.ts) plus the tags a paste
// from Word/Docs typically leaves behind, since the frontend normalizes
// pasted markup into this same subset before it is ever saved.

type textAlign int

const (
	alignInherit textAlign = iota
	alignLeft
	alignCenter
	alignRight
	alignJustify
)

// inlineStyle is the character-level formatting in effect at some point in
// the tree. It is inherited downwards: a <b> inside a coloured <span>
// yields a run that is both bold and coloured.
type inlineStyle struct {
	bold      bool
	italic    bool
	underline bool
	strike    bool
	hasColor  bool
	color     uint32
	// sizeScale multiplies the block's base font size. 0 means "inherit"
	// (i.e. the block's own size), 1 means explicitly normal.
	sizeScale float64
}

// inlineRun is a contiguous piece of text with uniform formatting.
type inlineRun struct {
	text string
	inlineStyle
}

// Block kinds. These deliberately mirror the tag names the editor emits
// rather than inventing a parallel vocabulary.
const (
	kindParagraph = "p"
	kindH1        = "h1"
	kindH2        = "h2"
	kindH3        = "h3"
	kindQuote     = "quote"
	kindListItem  = "li"
	kindImage     = "image"
	kindRule      = "hr"
)

// docBlock is one block-level element of a chapter.
type docBlock struct {
	kind  string
	align textAlign
	runs  []inlineRun
	image *chapterImage

	// List context, only meaningful for kindListItem.
	listOrdered bool
	listNumber  int
	listDepth   int

	// tight marks a block that came from a <br> split rather than from a
	// real block element, so the renderer joins it to the previous line
	// instead of opening a new paragraph with a full paragraph gap.
	tight bool
}

func (b docBlock) isEmpty() bool {
	if b.kind == kindImage || b.kind == kindRule {
		return false
	}
	for _, run := range b.runs {
		if strings.TrimSpace(run.text) != "" {
			return false
		}
	}
	return true
}

// chapterImage carries one image out of the chapter HTML.
// widthPct/wrap mirror what the editor stores on the image's wrapper (see
// manuscriptImages.ts); how faithfully each wrap mode can be reproduced
// depends on the output format — see drawImageBlock for the PDF side.
type chapterImage struct {
	bytes    []byte
	wrap     string
	widthPct float64
}

// parseChapterBlocks walks chapterHTML into its block list.
func parseChapterBlocks(chapterHTML string) ([]docBlock, error) {
	root, err := html.Parse(strings.NewReader("<div>" + chapterHTML + "</div>"))
	if err != nil {
		return nil, err
	}
	// The <div> wrapper only exists to give html.Parse a single root for
	// the chapter's own top-level elements; walking *it* as a block would
	// collapse the whole chapter into one run-on paragraph, so the walk
	// starts from its children.
	container := firstElementByTag(root, "div")
	if container == nil {
		return nil, nil
	}
	collector := &blockCollector{}
	collector.walkContainer(container, inlineStyle{}, alignInherit, listContext{})
	return collector.blocks, nil
}

type listContext struct {
	inList  bool
	ordered bool
	depth   int
	counter *int
}

type blockCollector struct {
	blocks []docBlock
	// loose collects inline content sitting directly inside a container
	// with no block element of its own — `<div>hola<b>chau</b></div>`
	// after the div has already been recursed into, for instance.
	loose []inlineRun
}

// walkContainer iterates a container's children, emitting one block per
// block-level child and gathering everything else as loose inline text.
func (c *blockCollector) walkContainer(node *html.Node, inherited inlineStyle, align textAlign, list listContext) {
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.ElementNode {
			switch {
			case child.Data == "figure" || child.Data == "img":
				c.flushLoose(align, false)
				if image, ok := imageBlockFrom(child); ok {
					c.blocks = append(c.blocks, docBlock{kind: kindImage, image: image})
				}
				continue
			case child.Data == "hr":
				c.flushLoose(align, false)
				c.blocks = append(c.blocks, docBlock{kind: kindRule})
				continue
			case child.Data == "ul" || child.Data == "ol":
				c.flushLoose(align, false)
				c.walkList(child, inherited, align, list)
				continue
			case child.Data == "br":
				// A line break between blocks: close what we have as a
				// tight block so the next line hugs it.
				c.flushLoose(align, true)
				continue
			case isBlockTag(child.Data):
				c.flushLoose(align, false)
				c.walkBlockElement(child, inherited, align, list)
				continue
			}
		}
		if child.Type == html.CommentNode || child.Type == html.DoctypeNode {
			continue
		}
		groups := collectRunGroups(child, inherited)
		for i, group := range groups {
			c.loose = append(c.loose, group...)
			if i < len(groups)-1 {
				c.flushLoose(align, true)
			}
		}
	}
	c.flushLoose(align, false)
}

// walkBlockElement turns one block-level element into one or more blocks —
// more than one when it contains <br> line breaks, or when it is really a
// wrapper around further block elements.
func (c *blockCollector) walkBlockElement(node *html.Node, inherited inlineStyle, parentAlign textAlign, list listContext) {
	style := applyInlineElement(node, inherited)
	align := alignOf(node, parentAlign)
	kind := blockKindOf(node.Data)

	if kind == kindListItem {
		c.walkListItem(node, style, align, list)
		return
	}

	// A wrapper (`<div><p>…</p><p>…</p></div>`) must not be flattened into
	// a single block of its own — recurse so each real block survives.
	if hasBlockChild(node) {
		c.walkContainer(node, style, align, list)
		return
	}

	groups := collectRunGroups(node, style)
	emitted := false
	for i, runs := range groups {
		block := docBlock{kind: kind, align: align, runs: runs, tight: i > 0}
		if !block.isEmpty() {
			c.blocks = append(c.blocks, block)
			emitted = true
		}
	}
	// `<p><br></p>` is how a contentEditable represents a deliberately
	// blank line, and a blank line between scenes is real content in a
	// manuscript — so an empty paragraph survives as one (rendered as a
	// single line of vertical space) instead of silently disappearing.
	if !emitted && kind == kindParagraph {
		c.blocks = append(c.blocks, docBlock{kind: kindParagraph, align: align})
	}
}

func (c *blockCollector) walkList(node *html.Node, inherited inlineStyle, align textAlign, parent listContext) {
	style := applyInlineElement(node, inherited)
	counter := 0
	list := listContext{
		inList:  true,
		ordered: node.Data == "ol",
		depth:   parent.depth + 1,
		counter: &counter,
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type != html.ElementNode {
			continue
		}
		switch child.Data {
		case "li":
			c.walkListItem(child, style, alignOf(child, align), list)
		case "ul", "ol":
			// A list nested directly under a list (no <li> in between).
			c.walkList(child, style, align, list)
		}
	}
}

func (c *blockCollector) walkListItem(node *html.Node, inherited inlineStyle, align textAlign, list listContext) {
	style := applyInlineElement(node, inherited)
	if list.counter != nil {
		*list.counter++
	}
	number := 0
	if list.counter != nil {
		number = *list.counter
	}
	depth := max(list.depth, 1)

	// An <li> can hold both its own text and a nested list. Collect the
	// text from everything that is not a nested list, emit it as the item,
	// then walk the nested lists so they keep their own numbering/indent.
	var runs []inlineRun
	var groups [][]inlineRun
	var nested []*html.Node
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.ElementNode && (child.Data == "ul" || child.Data == "ol") {
			nested = append(nested, child)
			continue
		}
		childGroups := collectRunGroups(child, style)
		for i, group := range childGroups {
			runs = append(runs, group...)
			if i < len(childGroups)-1 {
				groups = append(groups, runs)
				runs = nil
			}
		}
	}
	groups = append(groups, runs)

	for i, group := range groups {
		block := docBlock{
			kind:        kindListItem,
			align:       align,
			runs:        group,
			listOrdered: list.ordered,
			listNumber:  number,
			listDepth:   depth,
			tight:       i > 0,
		}
		if !block.isEmpty() {
			c.blocks = append(c.blocks, block)
		}
	}
	for _, child := range nested {
		c.walkList(child, style, align, list)
	}
}

func (c *blockCollector) flushLoose(align textAlign, tight bool) {
	if len(c.loose) == 0 {
		return
	}
	block := docBlock{kind: kindParagraph, align: align, runs: c.loose, tight: tight}
	c.loose = nil
	if !block.isEmpty() {
		c.blocks = append(c.blocks, block)
	}
}

// ---- Inline collection -------------------------------------------------

// collectRunGroups gathers the inline runs inside node, split into one
// group per <br>-delimited line.
func collectRunGroups(node *html.Node, inherited inlineStyle) [][]inlineRun {
	groups := [][]inlineRun{{}}
	var walk func(*html.Node, inlineStyle)
	walk = func(current *html.Node, style inlineStyle) {
		switch current.Type {
		case html.TextNode:
			text := normalizeText(current.Data)
			if text == "" {
				return
			}
			last := len(groups) - 1
			groups[last] = appendRun(groups[last], inlineRun{text: text, inlineStyle: style})
		case html.ElementNode:
			if current.Data == "br" {
				groups = append(groups, []inlineRun{})
				return
			}
			// Images/figures are block-level; they are handled by the
			// container walk and must not leak in as inline text.
			if current.Data == "figure" || current.Data == "img" {
				return
			}
			childStyle := applyInlineElement(current, style)
			for child := current.FirstChild; child != nil; child = child.NextSibling {
				walk(child, childStyle)
			}
		}
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		walk(child, inherited)
	}
	// A text node passed in directly (not an element) still needs picking up.
	if node.Type == html.TextNode {
		if text := normalizeText(node.Data); text != "" {
			groups[0] = appendRun(groups[0], inlineRun{text: text, inlineStyle: inherited})
		}
	}
	return groups
}

// appendRun merges a run into the previous one when their formatting is
// identical, keeping the fragment list short and the rendered line free of
// artificial breaks between what is really one styled span.
func appendRun(runs []inlineRun, run inlineRun) []inlineRun {
	if run.text == "" {
		return runs
	}
	if len(runs) > 0 && runs[len(runs)-1].inlineStyle == run.inlineStyle {
		runs[len(runs)-1].text += run.text
		return runs
	}
	return append(runs, run)
}

// normalizeText collapses HTML whitespace the way a browser would, so a
// manuscript indented across several source lines doesn't render with
// stray gaps.
func normalizeText(text string) string {
	text = strings.ReplaceAll(text, " ", " ")
	var out strings.Builder
	lastWasSpace := false
	for _, r := range text {
		switch r {
		case ' ', '\t', '\n', '\r':
			if !lastWasSpace {
				out.WriteByte(' ')
				lastWasSpace = true
			}
		default:
			out.WriteRune(r)
			lastWasSpace = false
		}
	}
	return out.String()
}

// applyInlineElement folds one element's own formatting into the inherited
// style, covering both the semantic tags the editor emits (<b>, <i>, <u>)
// and the presentational ones a browser's execCommand or a paste can leave
// behind (<font color size>, style="color:…;font-weight:…").
func applyInlineElement(node *html.Node, style inlineStyle) inlineStyle {
	if node.Type != html.ElementNode {
		return style
	}
	switch node.Data {
	case "b", "strong":
		style.bold = true
	case "i", "em", "cite", "var":
		style.italic = true
	case "u", "ins":
		style.underline = true
	case "s", "strike", "del":
		style.strike = true
	case "h1", "h2", "h3", "h4", "h5", "h6", "th":
		style.bold = true
	}

	attrs := attrMap(node)
	if node.Data == "font" {
		if value, ok := attrs["color"]; ok {
			if rgb, ok := parseCSSColor(value); ok {
				style.hasColor, style.color = true, rgb
			}
		}
		if value, ok := attrs["size"]; ok {
			if scale, ok := fontTagSizeScale(value); ok {
				style.sizeScale = scale
			}
		}
	}

	declarations := parseStyleAttribute(attrs["style"])
	if value, ok := declarations["color"]; ok {
		if rgb, ok := parseCSSColor(value); ok {
			style.hasColor, style.color = true, rgb
		}
	}
	if value, ok := declarations["font-weight"]; ok {
		style.bold = isBoldFontWeight(value)
	}
	if value, ok := declarations["font-style"]; ok {
		style.italic = value == "italic" || value == "oblique"
	}
	if value, ok := declarations["text-decoration"]; ok {
		if strings.Contains(value, "underline") {
			style.underline = true
		}
		if strings.Contains(value, "line-through") {
			style.strike = true
		}
	}
	if value, ok := declarations["font-size"]; ok {
		if scale, ok := cssFontSizeScale(value); ok {
			style.sizeScale = scale
		}
	}
	return style
}

// alignOf reads a block's own alignment, falling back to the inherited one
// so `<div style="text-align:center"><p>…` centres the paragraph too.
func alignOf(node *html.Node, inherited textAlign) textAlign {
	attrs := attrMap(node)
	if value, ok := parseStyleAttribute(attrs["style"])["text-align"]; ok {
		if align, ok := parseAlign(value); ok {
			return align
		}
	}
	if value, ok := attrs["align"]; ok {
		if align, ok := parseAlign(strings.ToLower(strings.TrimSpace(value))); ok {
			return align
		}
	}
	return inherited
}

func parseAlign(value string) (textAlign, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "left", "start":
		return alignLeft, true
	case "center", "centre":
		return alignCenter, true
	case "right", "end":
		return alignRight, true
	case "justify":
		return alignJustify, true
	default:
		return alignInherit, false
	}
}

// ---- Tag classification ------------------------------------------------

func isBlockTag(tag string) bool {
	switch tag {
	case "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li", "pre", "section", "article", "header", "footer", "figcaption":
		return true
	default:
		return false
	}
}

func blockKindOf(tag string) string {
	switch tag {
	case "h1":
		return kindH1
	case "h2":
		return kindH2
	case "h3", "h4", "h5", "h6":
		return kindH3
	case "blockquote":
		return kindQuote
	case "li":
		return kindListItem
	default:
		return kindParagraph
	}
}

func hasBlockChild(node *html.Node) bool {
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type != html.ElementNode {
			continue
		}
		if isBlockTag(child.Data) || child.Data == "ul" || child.Data == "ol" ||
			child.Data == "figure" || child.Data == "img" || child.Data == "hr" {
			return true
		}
	}
	return false
}

// ---- CSS value parsing -------------------------------------------------

func parseStyleAttribute(style string) map[string]string {
	declarations := make(map[string]string)
	for _, declaration := range strings.Split(style, ";") {
		key, value, ok := strings.Cut(declaration, ":")
		if !ok {
			continue
		}
		key = strings.ToLower(strings.TrimSpace(key))
		value = strings.ToLower(strings.TrimSpace(value))
		if key != "" && value != "" {
			declarations[key] = value
		}
	}
	return declarations
}

func isBoldFontWeight(value string) bool {
	switch value {
	case "bold", "bolder":
		return true
	}
	if weight, err := strconv.Atoi(value); err == nil {
		return weight >= 600
	}
	return false
}

// editorBaseFontSizePx mirrors `.editable`'s own font-size in
// ManuscritoTab.module.css. Relative sizes coming back as CSS pixels are
// scaled against it so "one step bigger in the editor" means the same
// thing in the exported PDF.
const editorBaseFontSizePx = 17.0

func cssFontSizeScale(value string) (float64, bool) {
	value = strings.TrimSpace(value)
	switch {
	case strings.HasSuffix(value, "px"):
		if size, err := strconv.ParseFloat(strings.TrimSuffix(value, "px"), 64); err == nil && size > 0 {
			return size / editorBaseFontSizePx, true
		}
	case strings.HasSuffix(value, "pt"):
		if size, err := strconv.ParseFloat(strings.TrimSuffix(value, "pt"), 64); err == nil && size > 0 {
			return size * (96.0 / 72.0) / editorBaseFontSizePx, true
		}
	case strings.HasSuffix(value, "rem"), strings.HasSuffix(value, "em"):
		trimmed := strings.TrimSuffix(strings.TrimSuffix(value, "rem"), "em")
		if size, err := strconv.ParseFloat(trimmed, 64); err == nil && size > 0 {
			return size, true
		}
	case strings.HasSuffix(value, "%"):
		if size, err := strconv.ParseFloat(strings.TrimSuffix(value, "%"), 64); err == nil && size > 0 {
			return size / 100, true
		}
	}
	return 0, false
}

// fontTagSizeScale maps a legacy <font size="1".."7"> to a scale, using the
// pixel sizes browsers actually render those at against a 16px base.
func fontTagSizeScale(value string) (float64, bool) {
	sizes := map[string]float64{
		"1": 10.0 / 16.0,
		"2": 13.0 / 16.0,
		"3": 1,
		"4": 18.0 / 16.0,
		"5": 24.0 / 16.0,
		"6": 32.0 / 16.0,
		"7": 48.0 / 16.0,
	}
	scale, ok := sizes[strings.TrimSpace(value)]
	return scale, ok
}

var namedColors = map[string]uint32{
	"black": 0x000000, "white": 0xffffff, "red": 0xff0000, "green": 0x008000,
	"blue": 0x0000ff, "yellow": 0xffff00, "orange": 0xffa500, "purple": 0x800080,
	"gray": 0x808080, "grey": 0x808080, "silver": 0xc0c0c0, "maroon": 0x800000,
	"navy": 0x000080, "teal": 0x008080, "olive": 0x808000, "lime": 0x00ff00,
	"aqua": 0x00ffff, "cyan": 0x00ffff, "fuchsia": 0xff00ff, "magenta": 0xff00ff,
	"brown": 0xa52a2a, "pink": 0xffc0cb, "gold": 0xffd700, "indigo": 0x4b0082,
}

// parseCSSColor handles the three forms the editor and pasted markup
// actually produce: #rgb / #rrggbb, rgb()/rgba(), and the basic colour
// keywords.
func parseCSSColor(value string) (uint32, bool) {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return 0, false
	}
	if rgb, ok := namedColors[value]; ok {
		return rgb, true
	}
	if strings.HasPrefix(value, "#") {
		hex := strings.TrimPrefix(value, "#")
		if len(hex) == 3 {
			hex = string([]byte{hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]})
		}
		if len(hex) != 6 {
			return 0, false
		}
		parsed, err := strconv.ParseUint(hex, 16, 32)
		if err != nil {
			return 0, false
		}
		return uint32(parsed), true
	}
	if strings.HasPrefix(value, "rgb") {
		open := strings.Index(value, "(")
		closing := strings.LastIndex(value, ")")
		if open < 0 || closing < open {
			return 0, false
		}
		parts := strings.FieldsFunc(value[open+1:closing], func(r rune) bool {
			return r == ',' || r == ' ' || r == '/'
		})
		if len(parts) < 3 {
			return 0, false
		}
		var channels [3]uint32
		for i := range 3 {
			component, err := strconv.ParseFloat(strings.TrimSpace(parts[i]), 64)
			if err != nil {
				return 0, false
			}
			channels[i] = uint32(min(max(component, 0), 255))
		}
		return channels[0]<<16 | channels[1]<<8 | channels[2], true
	}
	return 0, false
}
