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

const (
	StatusDraft     Status = "DRAFT"
	StatusPublished Status = "PUBLISHED"
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
	ID    string          `json:"id"`
	Type  string          `json:"type"`
	Props json.RawMessage `json:"props"`
}

type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string { return "page content is invalid" }

func EmptyContent() Content { return Content{SchemaVersion: 1, Sections: []Block{}} }

func (value Page) Validate() error {
	fields := make(map[string]string)
	if value.Type != "HOME" && value.Type != "BOOK" {
		fields["type"] = "must be HOME or BOOK"
	}
	if value.Type == "HOME" && value.BookID != nil {
		fields["bookId"] = "must be empty for a home page"
	}
	if value.Type == "BOOK" && (value.BookID == nil || strings.TrimSpace(*value.BookID) == "") {
		fields["bookId"] = "is required for a book page"
	} else if value.Type == "BOOK" && value.BookID != nil && !validUUID(*value.BookID) {
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
