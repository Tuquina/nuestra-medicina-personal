package manuscripts

import (
	"strings"

	"golang.org/x/net/html"
)

// Sanitizing imported manuscript HTML is not optional: the editor loads a
// chapter by assigning it to `innerHTML` (a contentEditable cannot be
// driven any other way), so any markup that survives import is markup that
// executes in the administrator's browser. A .docx or .pdf import builds
// its HTML from escaped text and is safe by construction, but an .epub is
// a zip of arbitrary author-supplied XHTML — `<script>`, `onerror=`,
// `javascript:` hrefs and friends all arrive verbatim unless they are
// stripped here, on the server, before the chapter is ever persisted.
// This also keeps the stored subset aligned with what the exporters and
// the editor's own toolbar actually understand (architecture.md §40's
// "constrained, sanitized structure" applied to the manuscript surface).

var allowedTags = map[string]bool{
	"p": true, "div": true, "br": true, "hr": true,
	"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true,
	"blockquote": true, "pre": true,
	"ul": true, "ol": true, "li": true,
	"b": true, "strong": true, "i": true, "em": true, "u": true, "ins": true,
	"s": true, "strike": true, "del": true, "span": true, "sub": true, "sup": true,
	"figure": true, "figcaption": true, "img": true,
}

// unwrappedTags are dropped as elements but keep their children — a
// `<section>` or `<a>` around real text should not take the text with it.
var unwrappedTags = map[string]bool{
	"section": true, "article": true, "main": true, "header": true, "footer": true,
	"a": true, "font": true, "small": true, "big": true, "center": true,
	"body": true, "html": true, "tbody": true, "table": true, "tr": true, "td": true, "th": true,
}

// droppedTags are removed together with everything inside them.
var droppedTags = map[string]bool{
	"script": true, "style": true, "iframe": true, "object": true, "embed": true,
	"svg": true, "math": true, "form": true, "input": true, "button": true,
	"select": true, "textarea": true, "link": true, "meta": true, "head": true,
	"audio": true, "video": true, "canvas": true, "noscript": true,
}

// allowedStyleProperties is the CSS the exporters and the editor actually
// read back. Anything else (positioning, backgrounds, Word's mso-* noise)
// is discarded rather than carried around in every chapter.
var allowedStyleProperties = map[string]bool{
	"text-align": true, "font-weight": true, "font-style": true,
	"text-decoration": true, "color": true, "font-size": true,
	"width": true, "left": true, "top": true,
}

// sanitizeChapterHTML parses, filters and re-serializes chapter HTML,
// returning well-formed XHTML limited to the allowed subset.
func sanitizeChapterHTML(chapterHTML string) string {
	root, err := html.Parse(strings.NewReader("<div>" + chapterHTML + "</div>"))
	if err != nil {
		return ""
	}
	container := firstElementByTag(root, "div")
	if container == nil {
		return ""
	}
	var out strings.Builder
	for child := container.FirstChild; child != nil; child = child.NextSibling {
		sanitizeNode(&out, child)
	}
	return out.String()
}

func sanitizeNode(out *strings.Builder, node *html.Node) {
	switch node.Type {
	case html.TextNode:
		out.WriteString(escapeXMLText(node.Data))
		return
	case html.ElementNode:
		if droppedTags[node.Data] {
			return
		}
		if !allowedTags[node.Data] || unwrappedTags[node.Data] {
			// Keep the content, drop the wrapper.
			for child := node.FirstChild; child != nil; child = child.NextSibling {
				sanitizeNode(out, child)
			}
			return
		}
		attrs := sanitizeAttributes(node)
		out.WriteByte('<')
		out.WriteString(node.Data)
		for _, attr := range attrs {
			out.WriteString(" " + attr.Key + "=\"" + escapeXMLAttribute(attr.Val) + "\"")
		}
		if voidElements[node.Data] {
			out.WriteString(" />")
			return
		}
		out.WriteByte('>')
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			sanitizeNode(out, child)
		}
		out.WriteString("</" + node.Data + ">")
		return
	default:
		return
	}
}

func sanitizeAttributes(node *html.Node) []html.Attribute {
	var kept []html.Attribute
	for _, attr := range node.Attr {
		key := strings.ToLower(attr.Key)
		// Every `on*` handler, and anything namespaced, goes.
		if strings.HasPrefix(key, "on") || strings.Contains(key, ":") {
			continue
		}
		switch key {
		case "style":
			if value := sanitizeStyle(attr.Val); value != "" {
				kept = append(kept, html.Attribute{Key: "style", Val: value})
			}
		case "class":
			if value := sanitizeClass(attr.Val); value != "" {
				kept = append(kept, html.Attribute{Key: "class", Val: value})
			}
		case "data-wrap", "data-front", "alt", "align", "contenteditable":
			kept = append(kept, html.Attribute{Key: key, Val: attr.Val})
		case "src":
			// Only inline image data survives. A remote or in-zip path
			// would either leak a request from the editor or simply 404,
			// and `javascript:`/`data:text/html` must never round-trip.
			if node.Data == "img" && isInlineImageDataURL(attr.Val) {
				kept = append(kept, html.Attribute{Key: "src", Val: attr.Val})
			}
		}
	}
	return kept
}

func isInlineImageDataURL(value string) bool {
	return strings.HasPrefix(value, "data:image/png;base64,") ||
		strings.HasPrefix(value, "data:image/jpeg;base64,")
}

func sanitizeStyle(style string) string {
	var kept []string
	for _, declaration := range strings.Split(style, ";") {
		key, value, ok := strings.Cut(declaration, ":")
		if !ok {
			continue
		}
		key = strings.ToLower(strings.TrimSpace(key))
		value = strings.TrimSpace(value)
		if !allowedStyleProperties[key] || value == "" {
			continue
		}
		// `url(...)` and `expression(...)` are the two classic ways to
		// smuggle a request or script through a style attribute.
		lowered := strings.ToLower(value)
		if strings.Contains(lowered, "url(") || strings.Contains(lowered, "expression(") || strings.Contains(lowered, "javascript:") {
			continue
		}
		kept = append(kept, key+":"+value)
	}
	return strings.Join(kept, ";")
}

// sanitizeClass keeps only the editor's own image classes, so an imported
// document cannot smuggle in styling hooks that mean nothing here.
func sanitizeClass(class string) string {
	var kept []string
	for _, name := range strings.Fields(class) {
		if strings.HasPrefix(name, "ms-image") {
			kept = append(kept, name)
		}
	}
	return strings.Join(kept, " ")
}
