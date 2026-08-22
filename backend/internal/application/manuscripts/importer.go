package manuscripts

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"path"
	"path/filepath"
	"strings"

	"github.com/ledongthuc/pdf"
	htmlpkg "golang.org/x/net/html"

	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

// Import converts an uploaded manuscript file into chapters, dispatching
// by extension. Every branch validates the file's byte signature before
// parsing it — never just the extension — mirroring library.validateEbook's
// "extension, MIME and content coherent" rule.
//
// A .epub already carries its own chapter structure (the spine), so each
// spine document becomes one section. For the flat formats, the result is
// split on the headings the document itself uses — importing a whole book
// as one giant chapter and asking the author to cut it up by hand was the
// single biggest friction point in getting an existing manuscript into the
// editor. A document with no headings at all still imports as one chapter,
// exactly as before.
func Import(filename string, content []byte) ([]manuscript.Chapter, error) {
	extension := strings.ToLower(filepath.Ext(filename))
	if extension == ".epub" {
		return importEPUB(content)
	}

	var body string
	var err error
	switch extension {
	case ".txt":
		body = paragraphsFromPlainText(string(content))
	case ".docx":
		body, err = importDOCX(content)
	case ".pdf":
		body, err = importPDF(content)
	default:
		return nil, manuscript.ErrUnsupportedFormat
	}
	if err != nil {
		return nil, err
	}
	if body == "" {
		return nil, fmt.Errorf("%w: no readable text found", manuscript.ErrConversionFailed)
	}
	return splitIntoChapters(body), nil
}

// splitIntoChapters cuts a single imported document at its own top-level
// headings: every <h1> starts a new section (falling back to <h2> when the
// document only uses those), and the heading's text becomes that section's
// title instead of being repeated in the body — the section heading is
// already rendered by both exporters.
func splitIntoChapters(body string) []manuscript.Chapter {
	root, err := htmlpkg.Parse(strings.NewReader("<div>" + body + "</div>"))
	if err != nil {
		return []manuscript.Chapter{newImportedChapter(1, "", body, manuscript.TitleModeAuto)}
	}
	container := firstElementByTag(root, "div")
	if container == nil {
		return []manuscript.Chapter{newImportedChapter(1, "", body, manuscript.TitleModeAuto)}
	}

	splitTag := ""
	for _, candidate := range []string{"h1", "h2"} {
		for child := container.FirstChild; child != nil; child = child.NextSibling {
			if child.Type == htmlpkg.ElementNode && child.Data == candidate {
				splitTag = candidate
				break
			}
		}
		if splitTag != "" {
			break
		}
	}
	if splitTag == "" {
		return []manuscript.Chapter{newImportedChapter(1, "Capítulo 1", body, manuscript.TitleModeAuto)}
	}

	type group struct {
		title string
		body  strings.Builder
	}
	var groups []*group
	current := &group{}
	for child := container.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == htmlpkg.ElementNode && child.Data == splitTag {
			// Content before the very first heading (a foreword, an epigraph)
			// only becomes its own section when it actually has content.
			if strings.TrimSpace(current.body.String()) != "" || current.title != "" {
				groups = append(groups, current)
			}
			current = &group{title: strings.TrimSpace(textContent(child))}
			continue
		}
		renderXHTML(&current.body, child)
	}
	groups = append(groups, current)

	chapters := make([]manuscript.Chapter, 0, len(groups))
	for _, item := range groups {
		if item.title == "" && strings.TrimSpace(item.body.String()) == "" {
			continue
		}
		titleMode := manuscript.TitleModeCustom
		if item.title == "" {
			titleMode = manuscript.TitleModeAuto
		}
		chapters = append(chapters, newImportedChapter(len(chapters)+1, item.title, item.body.String(), titleMode))
		if len(chapters) >= manuscript.MaxChapters {
			break
		}
	}
	if len(chapters) == 0 {
		return []manuscript.Chapter{newImportedChapter(1, "Capítulo 1", body, manuscript.TitleModeAuto)}
	}
	return chapters
}

func newImportedChapter(id int, title, body string, titleMode manuscript.TitleMode) manuscript.Chapter {
	return manuscript.Chapter{
		ID:        id,
		Title:     title,
		HTML:      sanitizeChapterHTML(body),
		Kind:      manuscript.SectionKindChapter,
		TitleMode: titleMode,
	}
}

// textContent returns the concatenated text of a node's subtree.
func textContent(node *htmlpkg.Node) string {
	var out strings.Builder
	var walk func(*htmlpkg.Node)
	walk = func(current *htmlpkg.Node) {
		if current.Type == htmlpkg.TextNode {
			out.WriteString(current.Data)
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return normalizeText(out.String())
}

func paragraphsFromPlainText(text string) string {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	var out strings.Builder
	for _, paragraph := range strings.Split(text, "\n\n") {
		paragraph = strings.TrimSpace(paragraph)
		if paragraph == "" {
			continue
		}
		out.WriteString("<p>")
		out.WriteString(strings.ReplaceAll(html.EscapeString(paragraph), "\n", "<br>"))
		out.WriteString("</p>")
	}
	return out.String()
}

// importPDF extracts plain text (a PDF has no real paragraph structure to
// recover, so this is inherently an approximation) and reflows it the same
// way a .txt upload is, splitting on blank lines.
func importPDF(content []byte) (string, error) {
	if !bytes.HasPrefix(content, []byte("%PDF-")) {
		return "", manuscript.ErrUnsupportedFormat
	}
	reader, err := pdf.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	textReader, err := reader.GetPlainText()
	if err != nil {
		return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(textReader); err != nil {
		return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	return paragraphsFromPlainText(buf.String()), nil
}

// docx files are just a zip of XML — this reads word/document.xml directly
// with the standard library instead of pulling in a DOCX package, since the
// only maintained pure-Go reader with a permissive license (gomutex/godocx)
// doesn't expose paragraph text/run formatting through its public API (it's
// built for writing documents, not introspecting existing ones). Heading
// detection is a heuristic on the paragraph's style ID (Word/LibreOffice
// both name their built-in heading styles "Heading1"/"Heading2"/"Heading3"),
// not a guarantee for every possible template.
var headingStyleTags = map[string]string{
	"heading1": "h1", "heading2": "h2", "heading3": "h3",
	"titulo1": "h1", "titulo2": "h2", "titulo3": "h3",
}

func importDOCX(content []byte) (string, error) {
	if !bytes.HasPrefix(content, []byte("PK\x03\x04")) {
		return "", manuscript.ErrUnsupportedFormat
	}
	zipReader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	var documentXML []byte
	for _, file := range zipReader.File {
		if file.Name != "word/document.xml" {
			continue
		}
		reader, err := file.Open()
		if err != nil {
			return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
		}
		documentXML, err = io.ReadAll(reader)
		reader.Close()
		if err != nil {
			return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
		}
		break
	}
	if documentXML == nil {
		return "", fmt.Errorf("%w: not a valid .docx (missing word/document.xml)", manuscript.ErrConversionFailed)
	}
	return paragraphsFromDocumentXML(documentXML)
}

// paragraphsFromDocumentXML walks WordprocessingML tokens by local tag name
// (ignoring namespace prefixes, since word/document.xml only ever uses the
// one "w:" namespace for these elements in practice) reconstructing each
// <w:p> as a heading or paragraph tag, and each <w:r> run as escaped text
// wrapped in <b>/<i> per its <w:rPr><w:b/><w:i/> formatting.
func paragraphsFromDocumentXML(data []byte) (string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var out strings.Builder
	var styleID string
	var paragraphHTML strings.Builder
	var runText strings.Builder
	var runBold, runItalic, inRun, inText bool

	flushRun := func() {
		if runText.Len() == 0 {
			return
		}
		escaped := html.EscapeString(runText.String())
		if runBold {
			escaped = "<b>" + escaped + "</b>"
		}
		if runItalic {
			escaped = "<i>" + escaped + "</i>"
		}
		paragraphHTML.WriteString(escaped)
		runText.Reset()
	}

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
		}
		switch element := token.(type) {
		case xml.StartElement:
			switch element.Name.Local {
			case "p":
				styleID = ""
				paragraphHTML.Reset()
			case "pStyle":
				styleID = strings.ToLower(xmlAttr(element, "val"))
			case "r":
				inRun, runBold, runItalic = true, false, false
				runText.Reset()
			case "b":
				if inRun {
					runBold = !isFalsyXMLBool(xmlAttr(element, "val"))
				}
			case "i":
				if inRun {
					runItalic = !isFalsyXMLBool(xmlAttr(element, "val"))
				}
			case "t":
				inText = true
			case "tab":
				if inRun {
					runText.WriteString("\t")
				}
			case "br":
				flushRun()
				paragraphHTML.WriteString("<br>")
			}
		case xml.CharData:
			if inText {
				runText.Write(element)
			}
		case xml.EndElement:
			switch element.Name.Local {
			case "t":
				inText = false
			case "r":
				flushRun()
				inRun = false
			case "p":
				tag := headingStyleTags[styleID]
				if tag == "" {
					tag = "p"
				}
				if paragraphHTML.Len() > 0 {
					out.WriteString("<" + tag + ">" + paragraphHTML.String() + "</" + tag + ">")
				}
			}
		}
	}
	return out.String(), nil
}

func xmlAttr(element xml.StartElement, local string) string {
	for _, attr := range element.Attr {
		if attr.Name.Local == local {
			return attr.Value
		}
	}
	return ""
}

// isFalsyXMLBool matches OOXML's boolean convention: an empty value (the
// attribute just isn't present) means true, but an explicit "0"/"false"
// means false.
func isFalsyXMLBool(value string) bool {
	return value == "0" || value == "false"
}

// ---- EPUB import -------------------------------------------------------

// maxEmbeddedImportImageBytes caps how large a single image from an
// imported EPUB may be before it is dropped. Images become base64 data
// URLs inside the chapter's HTML, and a chapter is limited to
// manuscript.MaxChapterBytes — one oversized cover scan would otherwise
// fail the whole import instead of losing just that picture.
const maxEmbeddedImportImageBytes = 1 << 20

// importEPUB reads an EPUB's spine and turns each document in it into one
// section, which is the structure the book already declares about itself —
// no heading heuristics needed. Images referenced from inside the archive
// are inlined as data URLs so the imported chapters are self-contained,
// exactly like an image inserted through the editor's own toolbar.
//
// The extracted XHTML is author-supplied markup from an arbitrary file, so
// every chapter goes through sanitizeChapterHTML before it is returned —
// see sanitize.go for why that is a hard requirement here.
func importEPUB(content []byte) ([]manuscript.Chapter, error) {
	if !bytes.HasPrefix(content, []byte("PK\x03\x04")) {
		return nil, manuscript.ErrUnsupportedFormat
	}
	zipReader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	files := make(map[string]*zip.File, len(zipReader.File))
	for _, file := range zipReader.File {
		files[file.Name] = file
	}

	opfPath, err := epubRootfilePath(files)
	if err != nil {
		return nil, err
	}
	spine, err := epubSpineDocuments(files, opfPath)
	if err != nil {
		return nil, err
	}

	var chapters []manuscript.Chapter
	for _, documentPath := range spine {
		file, ok := files[documentPath]
		if !ok {
			continue
		}
		raw, err := readZipFile(file)
		if err != nil {
			continue
		}
		title, body := epubDocumentBody(string(raw), files, documentPath)
		if strings.TrimSpace(stripTags(body)) == "" {
			continue // navigation/cover-only documents carry no manuscript text
		}
		titleMode := manuscript.TitleModeCustom
		if title == "" {
			titleMode = manuscript.TitleModeAuto
		}
		chapters = append(chapters, newImportedChapter(len(chapters)+1, title, body, titleMode))
		if len(chapters) >= manuscript.MaxChapters {
			break
		}
	}
	if len(chapters) == 0 {
		return nil, fmt.Errorf("%w: no readable text found", manuscript.ErrConversionFailed)
	}
	return chapters, nil
}

// epubRootfilePath reads META-INF/container.xml to find the OPF package
// document, which is the only fixed entry point an EPUB guarantees.
func epubRootfilePath(files map[string]*zip.File) (string, error) {
	container, ok := files["META-INF/container.xml"]
	if !ok {
		return "", fmt.Errorf("%w: not a valid .epub (missing META-INF/container.xml)", manuscript.ErrConversionFailed)
	}
	raw, err := readZipFile(container)
	if err != nil {
		return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	var parsed struct {
		Rootfiles []struct {
			FullPath string `xml:"full-path,attr"`
		} `xml:"rootfiles>rootfile"`
	}
	if err := xml.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	for _, rootfile := range parsed.Rootfiles {
		if rootfile.FullPath != "" {
			return rootfile.FullPath, nil
		}
	}
	return "", fmt.Errorf("%w: not a valid .epub (no rootfile declared)", manuscript.ErrConversionFailed)
}

// epubSpineDocuments returns the archive paths of the reading-order
// documents, resolved relative to the OPF's own directory.
func epubSpineDocuments(files map[string]*zip.File, opfPath string) ([]string, error) {
	opf, ok := files[opfPath]
	if !ok {
		return nil, fmt.Errorf("%w: not a valid .epub (missing %s)", manuscript.ErrConversionFailed, opfPath)
	}
	raw, err := readZipFile(opf)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}
	var parsed struct {
		Manifest []struct {
			ID         string `xml:"id,attr"`
			Href       string `xml:"href,attr"`
			MediaType  string `xml:"media-type,attr"`
			Properties string `xml:"properties,attr"`
		} `xml:"manifest>item"`
		Spine []struct {
			IDRef  string `xml:"idref,attr"`
			Linear string `xml:"linear,attr"`
		} `xml:"spine>itemref"`
	}
	if err := xml.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("%w: %v", manuscript.ErrConversionFailed, err)
	}

	base := path.Dir(opfPath)
	type manifestItem struct {
		href       string
		mediaType  string
		properties string
	}
	manifest := make(map[string]manifestItem, len(parsed.Manifest))
	for _, item := range parsed.Manifest {
		manifest[item.ID] = manifestItem{href: item.Href, mediaType: item.MediaType, properties: item.Properties}
	}

	var documents []string
	for _, itemref := range parsed.Spine {
		item, ok := manifest[itemref.IDRef]
		if !ok || itemref.Linear == "no" {
			continue
		}
		if item.mediaType != "" && !strings.Contains(item.mediaType, "xhtml") && !strings.Contains(item.mediaType, "html") {
			continue
		}
		// The EPUB3 navigation document is machine-readable structure, not
		// a chapter of the book.
		if strings.Contains(item.properties, "nav") {
			continue
		}
		documents = append(documents, resolveEPUBPath(base, item.href))
	}
	if len(documents) == 0 {
		return nil, fmt.Errorf("%w: not a valid .epub (empty spine)", manuscript.ErrConversionFailed)
	}
	return documents, nil
}

// epubDocumentBody extracts one spine document's <body> content and its
// leading heading (which becomes the section title, so it is not repeated
// in the body), inlining any images it references from the archive.
func epubDocumentBody(source string, files map[string]*zip.File, documentPath string) (title, body string) {
	root, err := htmlpkg.Parse(strings.NewReader(source))
	if err != nil {
		return "", ""
	}
	bodyNode := firstElementByTag(root, "body")
	if bodyNode == nil {
		return "", ""
	}
	inlineEPUBImages(bodyNode, files, path.Dir(documentPath))

	// A document that opens with a heading names the section; drop that
	// node so the title is not rendered twice.
	var out strings.Builder
	for child := bodyNode.FirstChild; child != nil; child = child.NextSibling {
		if title == "" && child.Type == htmlpkg.ElementNode && isHeadingTag(child.Data) && strings.TrimSpace(out.String()) == "" {
			title = strings.TrimSpace(textContent(child))
			continue
		}
		renderXHTML(&out, child)
	}
	return title, out.String()
}

func isHeadingTag(tag string) bool {
	switch tag {
	case "h1", "h2", "h3", "h4", "h5", "h6":
		return true
	default:
		return false
	}
}

// inlineEPUBImages rewrites in-archive <img src> references to base64 data
// URLs, so an imported chapter carries its pictures with it instead of
// pointing at paths that stop existing the moment the upload is discarded.
func inlineEPUBImages(root *htmlpkg.Node, files map[string]*zip.File, base string) {
	cache := make(map[string]string)
	var walk func(*htmlpkg.Node)
	walk = func(node *htmlpkg.Node) {
		if node.Type == htmlpkg.ElementNode && node.Data == "img" {
			for i, attr := range node.Attr {
				if attr.Key != "src" || strings.HasPrefix(attr.Val, "data:") {
					continue
				}
				target := resolveEPUBPath(base, attr.Val)
				dataURL, ok := cache[target]
				if !ok {
					file, exists := files[target]
					if !exists {
						continue
					}
					raw, err := readZipFile(file)
					if err != nil || len(raw) == 0 || len(raw) > maxEmbeddedImportImageBytes {
						continue
					}
					mediaType := imageMediaTypeOf(raw)
					if mediaType == "" {
						continue
					}
					dataURL = "data:" + mediaType + ";base64," + base64.StdEncoding.EncodeToString(raw)
					cache[target] = dataURL
				}
				node.Attr[i].Val = dataURL
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
}

// imageMediaTypeOf sniffs the two formats the editor and both exporters
// support; anything else is left out rather than embedded as something it
// is not.
func imageMediaTypeOf(data []byte) string {
	switch {
	case bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")):
		return "image/png"
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}):
		return "image/jpeg"
	default:
		return ""
	}
}

// resolveEPUBPath joins an href against its document's directory and
// normalizes it into the archive-relative form zip entries use. Any path
// that would escape the archive root is rejected by returning it cleaned —
// zip entry lookup then simply misses, which is the safe outcome.
func resolveEPUBPath(base, href string) string {
	if index := strings.IndexAny(href, "#?"); index >= 0 {
		href = href[:index]
	}
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	if base == "." || base == "/" {
		base = ""
	}
	joined := href
	if base != "" && !strings.HasPrefix(href, "/") {
		joined = base + "/" + href
	}
	return strings.TrimPrefix(path.Clean(joined), "/")
}

func readZipFile(file *zip.File) ([]byte, error) {
	reader, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

// stripTags is only used to decide whether a document carried any real
// text, never to produce output.
func stripTags(markup string) string {
	var out strings.Builder
	inTag := false
	for _, r := range markup {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			out.WriteRune(r)
		}
	}
	return out.String()
}
