package page

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"
)

var (
	ErrNotFound        = errors.New("page not found")
	ErrSlugConflict    = errors.New("page slug already exists")
	ErrVersionNotFound = errors.New("page version not found")
	ErrBookNotFound    = errors.New("book not found for page")
	ErrPageExists      = errors.New("page already exists for target")
)

type Status string

type Type string

const (
	StatusDraft     Status = "DRAFT"
	StatusPublished Status = "PUBLISHED"
	TypeHome        Type   = "HOME"
	TypeBook        Type   = "BOOK"
	TypeMeditations Type   = "MEDITACIONES"
	TypeTools       Type   = "HERRAMIENTAS"
	TypeContact     Type   = "CONTACTO"
	TypeSupport     Type   = "SOPORTE"
	TypeFAQ         Type   = "FAQ"
	TypeTerms       Type   = "TERMINOS"
	TypePrivacy     Type   = "PRIVACIDAD"
)

type Page struct {
	ID               string
	Type             string
	BookID           *string
	Slug             string
	Title            string
	Status           Status
	DraftContent     Content
	PublishedContent *Content
	CreatedAt        time.Time
	UpdatedAt        time.Time
	PublishedAt      *time.Time
}

type Version struct {
	ID            string
	PageID        string
	VersionNumber int
	Content       Content
	CreatedBy     string
	CreatedAt     time.Time
}

type Content struct {
	SchemaVersion int     `json:"schemaVersion"`
	Sections      []Block `json:"sections"`
}

type Block struct {
	ID     string          `json:"id"`
	Type   string          `json:"type"`
	Props  json.RawMessage `json:"props"`
	Hidden bool            `json:"hidden,omitempty"`
}

type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string { return "page content is invalid" }

func EmptyContent() Content { return Content{SchemaVersion: 1, Sections: []Block{}} }

func (value Page) Validate() error {
	fields := make(map[string]string)
	if !validPageType(value.Type) {
		fields["type"] = "is not supported"
	}
	if value.Type != string(TypeBook) && value.BookID != nil {
		fields["bookId"] = "must be empty unless type is BOOK"
	}
	if value.Type == string(TypeBook) && (value.BookID == nil || strings.TrimSpace(*value.BookID) == "") {
		fields["bookId"] = "is required for a book page"
	} else if value.Type == string(TypeBook) && value.BookID != nil && !validUUID(*value.BookID) {
		fields["bookId"] = "must be a UUID"
	}
	if strings.TrimSpace(value.Slug) == "" || len(value.Slug) > 160 {
		fields["slug"] = "must contain between 1 and 160 characters"
	} else if strings.HasPrefix(value.Slug, "-") || strings.HasSuffix(value.Slug, "-") || strings.Contains(value.Slug, "--") {
		fields["slug"] = "must use single hyphens between words"
	} else {
		for _, character := range value.Slug {
			if (character < 'a' || character > 'z') && (character < '0' || character > '9') && character != '-' {
				fields["slug"] = "must contain only lowercase letters, numbers and hyphens"
				break
			}
		}
	}
	if strings.TrimSpace(value.Title) == "" || len([]rune(value.Title)) > 200 {
		fields["title"] = "must contain between 1 and 200 characters"
	}
	if err := value.DraftContent.Validate(); err != nil {
		fields["content"] = err.Error()
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

func validPageType(value string) bool {
	switch Type(value) {
	case TypeHome, TypeBook, TypeMeditations, TypeTools, TypeContact, TypeSupport, TypeFAQ, TypeTerms, TypePrivacy:
		return true
	default:
		return false
	}
}

func validUUID(value string) bool {
	if len(value) != 36 || value[8] != '-' || value[13] != '-' || value[18] != '-' || value[23] != '-' {
		return false
	}
	for index, character := range value {
		if index == 8 || index == 13 || index == 18 || index == 23 {
			continue
		}
		if (character < '0' || character > '9') && (character < 'a' || character > 'f') && (character < 'A' || character > 'F') {
			return false
		}
	}
	return true
}

func DecodeContent(raw []byte) (Content, error) {
	var content Content
	if err := strictDecode(raw, &content); err != nil {
		return Content{}, fmt.Errorf("decode page content: %w", err)
	}
	if err := content.Validate(); err != nil {
		return Content{}, err
	}
	return content, nil
}

func (content Content) Validate() error {
	fields := make(map[string]string)
	if content.SchemaVersion != 1 {
		fields["schemaVersion"] = "must be 1"
	}
	if content.Sections == nil {
		fields["sections"] = "must be an array"
	} else if len(content.Sections) > 100 {
		fields["sections"] = "must contain at most 100 blocks"
	}
	seen := make(map[string]struct{}, len(content.Sections))
	for index, block := range content.Sections {
		path := fmt.Sprintf("sections.%d", index)
		if block.ID == "" || len(block.ID) > 100 {
			fields[path+".id"] = "must contain between 1 and 100 characters"
		} else if _, exists := seen[block.ID]; exists {
			fields[path+".id"] = "must be unique within the page"
		} else {
			seen[block.ID] = struct{}{}
		}
		if err := validateBlock(block); err != nil {
			fields[path+".props"] = err.Error()
		}
	}
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

type heroProps struct {
	Title     string  `json:"title"`
	Subtitle  string  `json:"subtitle"`
	ImageID   *string `json:"imageId"`
	Alignment string  `json:"alignment"`
	CTA       *link   `json:"cta"`
}

type imageTextProps struct {
	Heading       string `json:"heading"`
	Text          string `json:"text"`
	ImageID       string `json:"imageId"`
	ImagePosition string `json:"imagePosition"`
}

type featuresProps struct {
	Heading string        `json:"heading"`
	Items   []featureItem `json:"items"`
}

type featureItem struct {
	Title   string  `json:"title"`
	Text    string  `json:"text"`
	ImageID *string `json:"imageId"`
}

type faqProps struct {
	Heading string    `json:"heading"`
	Items   []faqItem `json:"items"`
}

type faqItem struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type collectionProps struct {
	Title       string           `json:"title"`
	Description string           `json:"description"`
	Cards       []collectionCard `json:"cards"`
}

type collectionCard struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	ImageCaption string `json:"imageCaption"`
}

type contactProps struct {
	Title   string          `json:"title"`
	Intro   string          `json:"intro"`
	Methods []contactMethod `json:"methods"`
}

type contactMethod struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Value string `json:"value"`
	Href  string `json:"href"`
}

type supportProps struct {
	Title  string         `json:"title"`
	Intro  string         `json:"intro"`
	Topics []supportTopic `json:"topics"`
}

type supportTopic struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type faqPageProps struct {
	Title string        `json:"title"`
	Intro string        `json:"intro"`
	FAQs  []faqPageItem `json:"faqs"`
}

type faqPageItem struct {
	ID       string `json:"id"`
	Question string `json:"q"`
	Answer   string `json:"a"`
}

type legalDocumentProps struct {
	Title        string                 `json:"title"`
	UpdatedLabel string                 `json:"updatedLabel"`
	IntroNote    string                 `json:"introNote"`
	Sections     []legalDocumentSection `json:"sections"`
}

type legalDocumentSection struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Body  string `json:"body"`
}

type ctaProps struct {
	Heading string `json:"heading"`
	Text    string `json:"text"`
	Link    link   `json:"link"`
}

type buyButtonProps struct {
	Label string `json:"label"`
}

type richTextProps struct {
	Nodes []richTextNode `json:"nodes"`
}

type richTextNode struct {
	Type    string             `json:"type"`
	Level   int                `json:"level,omitempty"`
	Content []richTextInline   `json:"content,omitempty"`
	Items   [][]richTextInline `json:"items,omitempty"`
}

type richTextInline struct {
	Text  string   `json:"text"`
	Marks []string `json:"marks,omitempty"`
	Link  *string  `json:"link,omitempty"`
}

type link struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

func validateBlock(block Block) error {
	switch block.Type {
	case "hero":
		var shape map[string]json.RawMessage
		if err := json.Unmarshal(block.Props, &shape); err != nil {
			return err
		}
		if _, isHomeHero := shape["headingLine1"]; isHomeHero {
			return validateHomeHero(block.Props)
		}
		var props heroProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		if err := requiredText("title", props.Title, 200); err != nil {
			return err
		}
		if err := optionalText("subtitle", props.Subtitle, 500); err != nil {
			return err
		}
		if props.Alignment != "left" && props.Alignment != "center" {
			return errors.New("alignment must be left or center")
		}
		if props.CTA != nil {
			return validateLink(*props.CTA)
		}
		return nil
	case "richText":
		var props richTextProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		return validateRichText(props)
	case "imageText":
		var props imageTextProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		if err := requiredText("heading", props.Heading, 200); err != nil {
			return err
		}
		if err := requiredText("text", props.Text, 2_000); err != nil {
			return err
		}
		if strings.TrimSpace(props.ImageID) == "" {
			return errors.New("imageId is required")
		}
		if props.ImagePosition != "left" && props.ImagePosition != "right" {
			return errors.New("imagePosition must be left or right")
		}
		return nil
	case "features":
		var props featuresProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		if err := optionalText("heading", props.Heading, 200); err != nil {
			return err
		}
		if len(props.Items) < 1 || len(props.Items) > 12 {
			return errors.New("items must contain between 1 and 12 entries")
		}
		for _, item := range props.Items {
			if err := requiredText("item title", item.Title, 120); err != nil {
				return err
			}
			if err := requiredText("item text", item.Text, 500); err != nil {
				return err
			}
		}
		return nil
	case "faq":
		var shape map[string]json.RawMessage
		if err := json.Unmarshal(block.Props, &shape); err != nil {
			return err
		}
		if _, isPage := shape["faqs"]; isPage {
			var props faqPageProps
			if err := strictDecode(block.Props, &props); err != nil {
				return err
			}
			return validateFAQPage(props)
		}
		var props faqProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		if err := optionalText("heading", props.Heading, 200); err != nil {
			return err
		}
		if len(props.Items) < 1 || len(props.Items) > 30 {
			return errors.New("items must contain between 1 and 30 entries")
		}
		for _, item := range props.Items {
			if err := requiredText("question", item.Question, 300); err != nil {
				return err
			}
			if err := requiredText("answer", item.Answer, 2_000); err != nil {
				return err
			}
		}
		return nil
	case "collection":
		var props collectionProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		return validateCollection(props)
	case "contacto":
		var props contactProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		return validateContact(props)
	case "soporte":
		var props supportProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		return validateSupport(props)
	case "legal-doc":
		var props legalDocumentProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		return validateLegalDocument(props)
	case "gallery":
		return validateGallery(block.Props)
	case "manifesto":
		return validateManifesto(block.Props)
	case "featured-books":
		return validateFeaturedBooks(block.Props)
	case "collection-teaser":
		return validateCollectionTeaser(block.Props)
	case "about":
		return validateAbout(block.Props)
	case "newsletter":
		return validateNewsletter(block.Props)
	case "title", "text", "image", "quote":
		return validateSimpleHomeBlock(block.Type, block.Props)
	case "divider":
		return validateDivider(block.Props)
	case "spacer":
		return validateSpacer(block.Props)
	case "book-landing":
		return validateBookLanding(block.Props)
	case "cta":
		var props ctaProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		if err := requiredText("heading", props.Heading, 200); err != nil {
			return err
		}
		if err := optionalText("text", props.Text, 500); err != nil {
			return err
		}
		return validateLink(props.Link)
	case "buyButton":
		var props buyButtonProps
		if err := strictDecode(block.Props, &props); err != nil {
			return err
		}
		return requiredText("label", props.Label, 80)
	default:
		return fmt.Errorf("unsupported block type %q", block.Type)
	}
}

func validateCollection(props collectionProps) error {
	if err := requiredText("title", props.Title, 200); err != nil {
		return err
	}
	if err := requiredText("description", props.Description, 1_000); err != nil {
		return err
	}
	if len(props.Cards) < 1 || len(props.Cards) > 30 {
		return errors.New("cards must contain between 1 and 30 entries")
	}
	for _, card := range props.Cards {
		if err := validateItemID(card.ID); err != nil {
			return err
		}
		if err := requiredText("card title", card.Title, 200); err != nil {
			return err
		}
		if err := requiredText("card description", card.Description, 1_000); err != nil {
			return err
		}
		if err := optionalText("card imageCaption", card.ImageCaption, 300); err != nil {
			return err
		}
	}
	return nil
}

func validateContact(props contactProps) error {
	if err := validateEditorialHeader(props.Title, props.Intro); err != nil {
		return err
	}
	if len(props.Methods) < 1 || len(props.Methods) > 20 {
		return errors.New("methods must contain between 1 and 20 entries")
	}
	for _, method := range props.Methods {
		if err := validateItemID(method.ID); err != nil {
			return err
		}
		if err := requiredText("method label", method.Label, 100); err != nil {
			return err
		}
		if err := requiredText("method value", method.Value, 320); err != nil {
			return err
		}
		if err := validateContactHref(method.Href); err != nil {
			return err
		}
	}
	return nil
}

func validateSupport(props supportProps) error {
	if err := validateEditorialHeader(props.Title, props.Intro); err != nil {
		return err
	}
	if len(props.Topics) < 1 || len(props.Topics) > 30 {
		return errors.New("topics must contain between 1 and 30 entries")
	}
	for _, topic := range props.Topics {
		if err := validateItemID(topic.ID); err != nil {
			return err
		}
		if err := requiredText("topic title", topic.Title, 200); err != nil {
			return err
		}
		if err := requiredText("topic description", topic.Description, 1_000); err != nil {
			return err
		}
	}
	return nil
}

func validateFAQPage(props faqPageProps) error {
	if err := validateEditorialHeader(props.Title, props.Intro); err != nil {
		return err
	}
	if len(props.FAQs) < 1 || len(props.FAQs) > 50 {
		return errors.New("faqs must contain between 1 and 50 entries")
	}
	for _, item := range props.FAQs {
		if err := validateItemID(item.ID); err != nil {
			return err
		}
		if err := requiredText("question", item.Question, 300); err != nil {
			return err
		}
		if err := requiredText("answer", item.Answer, 2_000); err != nil {
			return err
		}
	}
	return nil
}

func validateLegalDocument(props legalDocumentProps) error {
	if err := requiredText("title", props.Title, 200); err != nil {
		return err
	}
	if err := requiredText("updatedLabel", props.UpdatedLabel, 200); err != nil {
		return err
	}
	if err := requiredText("introNote", props.IntroNote, 5_000); err != nil {
		return err
	}
	if len(props.Sections) < 1 || len(props.Sections) > 50 {
		return errors.New("sections must contain between 1 and 50 legal entries")
	}
	for _, section := range props.Sections {
		if err := validateItemID(section.ID); err != nil {
			return err
		}
		if err := requiredText("section title", section.Title, 300); err != nil {
			return err
		}
		if err := requiredText("section body", section.Body, 20_000); err != nil {
			return err
		}
	}
	return nil
}

func validateEditorialHeader(title, intro string) error {
	if err := requiredText("title", title, 200); err != nil {
		return err
	}
	return requiredText("intro", intro, 2_000)
}

func validateItemID(value string) error {
	if strings.TrimSpace(value) == "" || len(value) > 100 {
		return errors.New("item id must contain between 1 and 100 characters")
	}
	return nil
}

func validateContactHref(href string) error {
	if strings.HasPrefix(href, "mailto:") {
		address := strings.TrimPrefix(href, "mailto:")
		if address == "" || strings.ContainsAny(address, "?&#\r\n") || !strings.Contains(address, "@") {
			return errors.New("mailto href must contain a plain email address")
		}
		return nil
	}
	return validateHref(href)
}

func validateRichText(props richTextProps) error {
	if len(props.Nodes) < 1 || len(props.Nodes) > 200 {
		return errors.New("nodes must contain between 1 and 200 entries")
	}
	for _, node := range props.Nodes {
		switch node.Type {
		case "paragraph":
			if node.Level != 0 || len(node.Items) != 0 {
				return errors.New("paragraph only accepts content")
			}
			if err := validateInline(node.Content); err != nil {
				return err
			}
		case "heading":
			if node.Level < 2 || node.Level > 4 || len(node.Items) != 0 {
				return errors.New("heading level must be between 2 and 4")
			}
			if err := validateInline(node.Content); err != nil {
				return err
			}
		case "bulletList", "orderedList":
			if node.Level != 0 || len(node.Content) != 0 || len(node.Items) < 1 || len(node.Items) > 50 {
				return errors.New("list must contain between 1 and 50 items")
			}
			for _, item := range node.Items {
				if err := validateInline(item); err != nil {
					return err
				}
			}
		default:
			return fmt.Errorf("unsupported rich text node type %q", node.Type)
		}
	}
	return nil
}

func validateInline(values []richTextInline) error {
	if len(values) < 1 || len(values) > 100 {
		return errors.New("rich text content must contain between 1 and 100 spans")
	}
	for _, value := range values {
		if err := requiredText("rich text", value.Text, 2_000); err != nil {
			return err
		}
		seen := make(map[string]struct{}, len(value.Marks))
		for _, mark := range value.Marks {
			if mark != "bold" && mark != "italic" {
				return fmt.Errorf("unsupported rich text mark %q", mark)
			}
			if _, exists := seen[mark]; exists {
				return fmt.Errorf("duplicate rich text mark %q", mark)
			}
			seen[mark] = struct{}{}
		}
		if value.Link != nil {
			if err := validateHref(*value.Link); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateLink(value link) error {
	if err := requiredText("link label", value.Label, 80); err != nil {
		return err
	}
	return validateHref(value.Href)
}

func validateHref(href string) error {
	if len(href) < 1 || len(href) > 2_000 {
		return errors.New("link href must contain between 1 and 2000 characters")
	}
	if strings.HasPrefix(href, "/") && !strings.HasPrefix(href, "//") {
		return nil
	}
	parsed, err := url.ParseRequestURI(href)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return errors.New("link href must be a relative path or an http/https URL")
	}
	return nil
}

func requiredText(name, value string, maximum int) error {
	if strings.TrimSpace(value) == "" || len([]rune(value)) > maximum {
		return fmt.Errorf("%s must contain between 1 and %d characters", name, maximum)
	}
	return nil
}

func optionalText(name, value string, maximum int) error {
	if len([]rune(value)) > maximum {
		return fmt.Errorf("%s must contain at most %d characters", name, maximum)
	}
	return nil
}

func strictDecode(raw []byte, destination any) error {
	if len(raw) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return errors.New("value is required")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("value must contain a single JSON object")
	}
	return nil
}
