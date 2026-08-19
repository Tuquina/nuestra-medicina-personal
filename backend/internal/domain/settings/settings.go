package settings

import (
	"net/mail"
	"strconv"
	"strings"
	"time"
)

type Settings struct {
	SiteName        string
	SiteDescription string
	SupportEmail    string
	NewsletterEmail string
	SenderName      string
	SEOTitle        string
	SEODescription  string
	SEOIndexable    bool
	UpdatedAt       time.Time
}

type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string { return "site settings are invalid" }

func (value *Settings) Normalize() {
	value.SiteName = strings.TrimSpace(value.SiteName)
	value.SiteDescription = strings.TrimSpace(value.SiteDescription)
	value.SupportEmail = strings.ToLower(strings.TrimSpace(value.SupportEmail))
	value.NewsletterEmail = strings.ToLower(strings.TrimSpace(value.NewsletterEmail))
	value.SenderName = strings.TrimSpace(value.SenderName)
	value.SEOTitle = strings.TrimSpace(value.SEOTitle)
	value.SEODescription = strings.TrimSpace(value.SEODescription)
}

func (value Settings) Validate() error {
	fields := make(map[string]string)
	requiredText(fields, "siteName", value.SiteName, 200)
	optionalText(fields, "siteDescription", value.SiteDescription, 500)
	validEmail(fields, "supportEmail", value.SupportEmail)
	validEmail(fields, "newsletterEmail", value.NewsletterEmail)
	requiredText(fields, "senderName", value.SenderName, 200)
	optionalText(fields, "seoTitle", value.SEOTitle, 200)
	optionalText(fields, "seoDescription", value.SEODescription, 500)
	if len(fields) > 0 {
		return &ValidationError{Fields: fields}
	}
	return nil
}

func requiredText(fields map[string]string, field, value string, maximum int) {
	length := len([]rune(value))
	if length < 1 || length > maximum {
		fields[field] = "must contain between 1 and " + strconv.Itoa(maximum) + " characters"
	}
}

func optionalText(fields map[string]string, field, value string, maximum int) {
	if len([]rune(value)) > maximum {
		fields[field] = "must contain at most " + strconv.Itoa(maximum) + " characters"
	}
}

func validEmail(fields map[string]string, field, value string) {
	address, err := mail.ParseAddress(value)
	if err != nil || address.Address != value || len(value) > 320 {
		fields[field] = "must be a valid email address"
	}
}
