package manuscripts

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"path/filepath"
	"strings"

	"github.com/ledongthuc/pdf"
	"github.com/nuestra-medicina-personal/backend/internal/domain/manuscript"
)

// Import converts an uploaded manuscript file into a single chapter of HTML,
// dispatching by extension. Every branch validates the file's byte
// signature before parsing it — never just the extension — mirroring
// library.validateEbook's "extension, MIME and content coherent" rule.
// Splitting the result into multiple chapters stays a manual step in the
// editor ("Agregar capítulo"), same as an imported .txt file today.
func Import(filename string, content []byte) ([]manuscript.Chapter, error) {
	var body string
	var err error
	switch strings.ToLower(filepath.Ext(filename)) {
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
	return []manuscript.Chapter{{
		ID:        1,
		Title:     "Capítulo 1",
		HTML:      body,
		Kind:      manuscript.SectionKindChapter,
		TitleMode: manuscript.TitleModeAuto,
	}}, nil
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
