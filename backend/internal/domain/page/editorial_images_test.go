package page

import (
	"fmt"
	"testing"
)

func TestEditorialImagesUseOptionalManagedMediaIDs(t *testing.T) {
	const id = "10000000-0000-4000-8000-000000000001"
	for _, imageID := range []string{"", id, "https://example.com/image.png", "../../private", "invalid"} {
		tests := []struct {
			name     string
			validate func() error
		}{
			{"hero", func() error {
				return validateHomeHero([]byte(fmt.Sprintf(`{"eyebrow":"Escritura","headingLine1":"Nuestra","headingLine2":"medicina personal","lede":"Pausa","primaryCtaLabel":"Libros","primaryCtaTo":"/libros","secondaryCtaLabel":"Proyecto","secondaryCtaTo":"#about","imageCaption":"Amanecer","imageId":%q}`, imageID)))
			}},
			{"gallery", func() error {
				return validateGallery([]byte(fmt.Sprintf(`{"captions":["Bosque"],"imageIds":[%q]}`, imageID)))
			}},
			{"about", func() error {
				return validateAbout([]byte(fmt.Sprintf(`{"title":"Quién escribe","bio":"Biografía","imageId":%q}`, imageID)))
			}},
			{"teaser", func() error {
				return validateCollectionTeaser([]byte(fmt.Sprintf(`{"title":"Meditaciones","description":"Pausa","ctaLabel":"Explorar","ctaTo":"/meditaciones","accent":"sky","imageId":%q}`, imageID)))
			}},
			{"image", func() error {
				return validateSimpleHomeBlock("image", []byte(fmt.Sprintf(`{"caption":"Foto","imageId":%q}`, imageID)))
			}},
			{"book", func() error {
				return validateMiddleSection([]byte(fmt.Sprintf(`{"type":"image-text","imageAccent":"var(--color-sky-pale)","imageId":%q}`, imageID)))
			}},
			{"collection", func() error {
				return validateCollection(collectionProps{Title: "Colección", Description: "Descripción", Cards: []collectionCard{{ID: "card-1", Title: "Tarjeta", Description: "Descripción", ImageID: imageID}}})
			}},
		}
		for _, tc := range tests {
			t.Run(tc.name+"/"+imageID, func(t *testing.T) {
				err := tc.validate()
				valid := imageID == "" || imageID == id
				if (err == nil) != valid {
					t.Fatalf("valid=%v, got %v", valid, err)
				}
			})
		}
	}
}

func TestGalleryRejectsOrphanedImageIDs(t *testing.T) {
	if err := validateGallery([]byte(`{"captions":["Bosque"],"imageIds":["",""]}`)); err == nil {
		t.Fatal("image references must have matching caption slots")
	}
}
