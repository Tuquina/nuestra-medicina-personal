package page

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

type homeHeroProps struct {
	Eyebrow           string `json:"eyebrow"`
	HeadingLine1      string `json:"headingLine1"`
	HeadingLine2      string `json:"headingLine2"`
	Lede              string `json:"lede"`
	PrimaryCTALabel   string `json:"primaryCtaLabel"`
	PrimaryCTATo      string `json:"primaryCtaTo"`
	SecondaryCTALabel string `json:"secondaryCtaLabel"`
	SecondaryCTATo    string `json:"secondaryCtaTo"`
	ImageCaption      string `json:"imageCaption"`
}

type galleryProps struct {
	Captions []string `json:"captions"`
}

type manifestoProps struct {
	Quote string `json:"quote"`
	Body  string `json:"body"`
}

type featuredBooksProps struct {
	Eyebrow     string `json:"eyebrow"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type collectionTeaserProps struct {
	Eyebrow      string `json:"eyebrow"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	CTALabel     string `json:"ctaLabel"`
	CTATo        string `json:"ctaTo"`
	ImageCaption string `json:"imageCaption"`
	Reverse      bool   `json:"reverse"`
	Accent       string `json:"accent"`
}

type aboutProps struct {
	Eyebrow      string `json:"eyebrow"`
	Title        string `json:"title"`
	Bio          string `json:"bio"`
	ImageCaption string `json:"imageCaption"`
}

type newsletterProps struct {
	Title            string `json:"title"`
	Subtitle         string `json:"subtitle"`
	ButtonLabel      string `json:"buttonLabel"`
	ConfirmationText string `json:"confirmationText"`
	Fineprint        string `json:"fineprint"`
}

type textProps struct {
	Text string `json:"text"`
}

type imageProps struct {
	Caption string `json:"caption"`
}

type spacerProps struct {
	Height string `json:"height"`
}

type bookLandingProps struct {
	Slug                 string          `json:"slug,omitempty"`
	TaglineColor         string          `json:"taglineColor"`
	HeroGlowColor        string          `json:"heroGlowColor"`
	AuthorName           string          `json:"authorName"`
	Tagline              string          `json:"tagline"`
	HeroDescription      string          `json:"heroDescription"`
	SynopsisEyebrowColor string          `json:"synopsisEyebrowColor"`
	SynopsisParagraphs   []string        `json:"synopsisParagraphs"`
	MiddleSection        json.RawMessage `json:"middleSection"`
	Quote                string          `json:"quote"`
	QuoteGlowSide        string          `json:"quoteGlowSide"`
	PublicationDate      string          `json:"publicationDate"`
	ISBN                 string          `json:"isbn"`
	FileSize             string          `json:"fileSize"`
	FAQs                 []landingFAQ    `json:"faqs,omitempty"`
	RelatedSlug          string          `json:"relatedSlug"`
	CTAGlowSide          string          `json:"ctaGlowSide"`
}

type landingFAQ struct {
	Question string `json:"q"`
	Answer   string `json:"a"`
}

type middleSectionType struct {
	Type string `json:"type"`
}

type imageTextLandingSection struct {
	Type         string `json:"type"`
	Heading      string `json:"heading"`
	Text         string `json:"text"`
	ImageAccent  string `json:"imageAccent"`
	ImageCaption string `json:"imageCaption"`
}

type benefitsLandingSection struct {
	Type    string        `json:"type"`
	Heading string        `json:"heading"`
	Items   []benefitItem `json:"items"`
}

type benefitItem struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

func validateHomeHero(raw json.RawMessage) error {
	var props homeHeroProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	checks := []struct {
		name  string
		value string
		max   int
	}{
		{"eyebrow", props.Eyebrow, 200}, {"headingLine1", props.HeadingLine1, 120},
		{"headingLine2", props.HeadingLine2, 120}, {"lede", props.Lede, 1_000},
		{"primaryCtaLabel", props.PrimaryCTALabel, 80}, {"secondaryCtaLabel", props.SecondaryCTALabel, 80},
	}
	for _, check := range checks {
		if err := requiredText(check.name, check.value, check.max); err != nil {
			return err
		}
	}
	if err := validateNavigationTarget(props.PrimaryCTATo); err != nil {
		return fmt.Errorf("primaryCtaTo: %w", err)
	}
	if err := validateNavigationTarget(props.SecondaryCTATo); err != nil {
		return fmt.Errorf("secondaryCtaTo: %w", err)
	}
	return optionalText("imageCaption", props.ImageCaption, 300)
}

func validateGallery(raw json.RawMessage) error {
	var props galleryProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	if len(props.Captions) < 1 || len(props.Captions) > 20 {
		return errors.New("captions must contain between 1 and 20 entries")
	}
	for _, caption := range props.Captions {
		if err := requiredText("caption", caption, 300); err != nil {
			return err
		}
	}
	return nil
}

func validateManifesto(raw json.RawMessage) error {
	var props manifestoProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	if err := requiredText("quote", props.Quote, 500); err != nil {
		return err
	}
	return requiredText("body", props.Body, 2_000)
}

func validateFeaturedBooks(raw json.RawMessage) error {
	var props featuredBooksProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	if err := optionalText("eyebrow", props.Eyebrow, 200); err != nil {
		return err
	}
	if err := requiredText("title", props.Title, 200); err != nil {
		return err
	}
	return requiredText("description", props.Description, 1_000)
}

func validateCollectionTeaser(raw json.RawMessage) error {
	var props collectionTeaserProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	if err := optionalText("eyebrow", props.Eyebrow, 200); err != nil {
		return err
	}
	if err := requiredText("title", props.Title, 200); err != nil {
		return err
	}
	if err := requiredText("description", props.Description, 1_000); err != nil {
		return err
	}
	if err := requiredText("ctaLabel", props.CTALabel, 80); err != nil {
		return err
	}
	if err := validateNavigationTarget(props.CTATo); err != nil {
		return fmt.Errorf("ctaTo: %w", err)
	}
	if err := optionalText("imageCaption", props.ImageCaption, 300); err != nil {
		return err
	}
	if props.Accent != "sky" && props.Accent != "amber" {
		return errors.New("accent must be sky or amber")
	}
	return nil
}

func validateAbout(raw json.RawMessage) error {
	var props aboutProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	if err := optionalText("eyebrow", props.Eyebrow, 200); err != nil {
		return err
	}
	if err := requiredText("title", props.Title, 200); err != nil {
		return err
	}
	if err := requiredText("bio", props.Bio, 5_000); err != nil {
		return err
	}
	return optionalText("imageCaption", props.ImageCaption, 300)
}

func validateNewsletter(raw json.RawMessage) error {
	var props newsletterProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	for _, check := range []struct {
		name  string
		value string
		max   int
	}{{"title", props.Title, 200}, {"subtitle", props.Subtitle, 1_000}, {"buttonLabel", props.ButtonLabel, 80}, {"confirmationText", props.ConfirmationText, 500}, {"fineprint", props.Fineprint, 500}} {
		if err := requiredText(check.name, check.value, check.max); err != nil {
			return err
		}
	}
	return nil
}

func validateSimpleHomeBlock(blockType string, raw json.RawMessage) error {
	if blockType == "image" {
		var props imageProps
		if err := strictDecode(raw, &props); err != nil {
			return err
		}
		return requiredText("caption", props.Caption, 300)
	}
	var props textProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	maximum := 5_000
	if blockType == "title" {
		maximum = 200
	}
	return requiredText("text", props.Text, maximum)
}

func validateDivider(raw json.RawMessage) error {
	var props struct{}
	return strictDecode(raw, &props)
}

func validateSpacer(raw json.RawMessage) error {
	var props spacerProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	if props.Height != "sm" && props.Height != "md" && props.Height != "lg" {
		return errors.New("height must be sm, md or lg")
	}
	return nil
}

func validateBookLanding(raw json.RawMessage) error {
	var props bookLandingProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	if props.Slug != "" && !validSlug(props.Slug) {
		return errors.New("slug must be a lowercase slug")
	}
	for name, color := range map[string]string{
		"taglineColor": props.TaglineColor, "heroGlowColor": props.HeroGlowColor,
		"synopsisEyebrowColor": props.SynopsisEyebrowColor,
	} {
		if err := validateControlledColor(color); err != nil {
			return fmt.Errorf("%s: %w", name, err)
		}
	}
	if err := requiredText("authorName", props.AuthorName, 200); err != nil {
		return err
	}
	for name, value := range map[string]string{
		"tagline": props.Tagline, "heroDescription": props.HeroDescription, "quote": props.Quote,
		"publicationDate": props.PublicationDate, "isbn": props.ISBN, "fileSize": props.FileSize,
	} {
		if err := optionalText(name, value, 2_000); err != nil {
			return err
		}
	}
	if len(props.SynopsisParagraphs) < 1 || len(props.SynopsisParagraphs) > 20 {
		return errors.New("synopsisParagraphs must contain between 1 and 20 entries")
	}
	for _, paragraph := range props.SynopsisParagraphs {
		if err := optionalText("synopsis paragraph", paragraph, 5_000); err != nil {
			return err
		}
	}
	if err := validateMiddleSection(props.MiddleSection); err != nil {
		return err
	}
	if props.QuoteGlowSide != "left" && props.QuoteGlowSide != "right" {
		return errors.New("quoteGlowSide must be left or right")
	}
	if props.CTAGlowSide != "left" && props.CTAGlowSide != "right" {
		return errors.New("ctaGlowSide must be left or right")
	}
	if props.RelatedSlug != "" && !validSlug(props.RelatedSlug) {
		return errors.New("relatedSlug must be a lowercase slug")
	}
	if len(props.FAQs) > 30 {
		return errors.New("faqs must contain at most 30 entries")
	}
	for _, item := range props.FAQs {
		if err := optionalText("faq question", item.Question, 300); err != nil {
			return err
		}
		if err := optionalText("faq answer", item.Answer, 2_000); err != nil {
			return err
		}
	}
	return nil
}

func validateMiddleSection(raw json.RawMessage) error {
	var discriminator middleSectionType
	if err := json.Unmarshal(raw, &discriminator); err != nil {
		return errors.New("middleSection is required")
	}
	switch discriminator.Type {
	case "image-text":
		var section imageTextLandingSection
		if err := strictDecode(raw, &section); err != nil {
			return err
		}
		if err := optionalText("middle heading", section.Heading, 200); err != nil {
			return err
		}
		if err := optionalText("middle text", section.Text, 5_000); err != nil {
			return err
		}
		if err := validateControlledColor(section.ImageAccent); err != nil {
			return fmt.Errorf("imageAccent: %w", err)
		}
		return optionalText("imageCaption", section.ImageCaption, 300)
	case "benefits":
		var section benefitsLandingSection
		if err := strictDecode(raw, &section); err != nil {
			return err
		}
		if err := optionalText("middle heading", section.Heading, 200); err != nil {
			return err
		}
		if len(section.Items) < 1 || len(section.Items) > 12 {
			return errors.New("benefits must contain between 1 and 12 entries")
		}
		for _, item := range section.Items {
			if err := optionalText("benefit title", item.Title, 200); err != nil {
				return err
			}
			if err := optionalText("benefit description", item.Description, 1_000); err != nil {
				return err
			}
		}
		return nil
	default:
		return errors.New("middleSection type must be image-text or benefits")
	}
}

func validateControlledColor(value string) error {
	if len(value) < 1 || len(value) > 100 {
		return errors.New("color must contain between 1 and 100 characters")
	}
	if strings.HasPrefix(value, "var(--color-") && strings.HasSuffix(value, ")") {
		name := strings.TrimSuffix(strings.TrimPrefix(value, "var(--color-"), ")")
		if name != "" && strings.Trim(name, "abcdefghijklmnopqrstuvwxyz0123456789-") == "" {
			return nil
		}
	}
	if strings.HasPrefix(value, "oklch(") && strings.HasSuffix(value, ")") {
		body := strings.TrimSuffix(strings.TrimPrefix(value, "oklch("), ")")
		if body != "" && strings.Trim(body, "0123456789.% /-") == "" {
			return nil
		}
	}
	return errors.New("color must use a design token or a literal oklch value")
}

func validateNavigationTarget(value string) error {
	if strings.HasPrefix(value, "#") && len(value) > 1 && !strings.ContainsAny(value, " \t\r\n") {
		return nil
	}
	return validateHref(value)
}

func validSlug(value string) bool {
	if value == "" || strings.HasPrefix(value, "-") || strings.HasSuffix(value, "-") || strings.Contains(value, "--") {
		return false
	}
	for _, character := range value {
		if (character < 'a' || character > 'z') && (character < '0' || character > '9') && character != '-' {
			return false
		}
	}
	return true
}
