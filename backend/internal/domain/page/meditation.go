package page

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

// TypeMeditation is one guided meditation page (`/meditaciones/{slug}`).
// Unlike the singleton editorial pages there can be any number of them,
// each with its own slug, draft/publish cycle and version history.
const TypeMeditation Type = "MEDITACION"

// MeditationBlockType is the block that holds a meditation's content.
const MeditationBlockType = "meditation"

var youTubeIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

// MeditationProps is the content of a meditation page. The video is stored
// as a bare YouTube id (never a raw URL or embed HTML), so the frontend
// builds the only embed URL it allows.
type MeditationProps struct {
	Title           string           `json:"title"`
	Description     string           `json:"description"`
	ImageID         *string          `json:"imageId"`
	ImageAlt        string           `json:"imageAlt"`
	Video           *MeditationVideo `json:"video"`
	DurationMinutes *int             `json:"durationMinutes"`
	// Guidance is plain text; blank lines separate paragraphs.
	Guidance string `json:"guidance"`
}

type MeditationVideo struct {
	Provider string `json:"provider"`
	VideoID  string `json:"videoId"`
}

// MeditationSummary is what the public meditation list shows for one page.
type MeditationSummary struct {
	Slug            string
	Title           string
	Description     string
	ImageID         *string
	ImageAlt        string
	DurationMinutes *int
	HasVideo        bool
}

func validateMeditation(raw json.RawMessage) error {
	var props MeditationProps
	if err := strictDecode(raw, &props); err != nil {
		return err
	}
	if err := requiredText("title", props.Title, 200); err != nil {
		return err
	}
	if err := requiredText("description", props.Description, 600); err != nil {
		return err
	}
	if props.ImageID != nil && !validUUID(*props.ImageID) {
		return errors.New("imageId must be a media UUID")
	}
	if err := optionalText("imageAlt", props.ImageAlt, 300); err != nil {
		return err
	}
	if props.Video != nil {
		if props.Video.Provider != "youtube" {
			return errors.New("video provider must be youtube")
		}
		if !youTubeIDPattern.MatchString(props.Video.VideoID) {
			return errors.New("video id must be an 11-character YouTube id")
		}
	}
	if props.DurationMinutes != nil && (*props.DurationMinutes < 1 || *props.DurationMinutes > 180) {
		return errors.New("durationMinutes must be between 1 and 180")
	}
	return optionalText("guidance", props.Guidance, 6_000)
}

// MeditationSummaryOf extracts the list card of a meditation page from its
// content: the first visible meditation block. ok is false when there is none.
func MeditationSummaryOf(slug string, content Content) (summary MeditationSummary, ok bool) {
	for _, block := range content.Sections {
		if block.Type != MeditationBlockType || block.Hidden {
			continue
		}
		var props MeditationProps
		if err := json.Unmarshal(block.Props, &props); err != nil {
			return MeditationSummary{}, false
		}
		return MeditationSummary{
			Slug:            slug,
			Title:           strings.TrimSpace(props.Title),
			Description:     strings.TrimSpace(props.Description),
			ImageID:         props.ImageID,
			ImageAlt:        props.ImageAlt,
			DurationMinutes: props.DurationMinutes,
			HasVideo:        props.Video != nil,
		}, true
	}
	return MeditationSummary{}, false
}
