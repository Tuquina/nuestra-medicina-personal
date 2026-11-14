package httpapi

import (
	"net/http"
)

type publicSiteSettingsResponse struct {
	SiteName        string `json:"siteName"`
	SiteDescription string `json:"siteDescription"`
	SupportEmail    string `json:"supportEmail"`
	SEOTitle        string `json:"seoTitle"`
	SEODescription  string `json:"seoDescription"`
	SEOIndexable    bool   `json:"seoIndexable"`
}

// GetPublic is GET /api/v1/site: the part of Configuración the public site
// shows (name, description, support email and SEO defaults). Internal
// fields such as sender names stay admin-only.
func (h *SettingsHandler) GetPublic(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		writeError(w, http.StatusServiceUnavailable, "SETTINGS_UNAVAILABLE", "Site settings are not available", nil)
		return
	}
	value, err := h.service.Get(r.Context())
	if err != nil {
		h.internalError(w, r, "get public site settings", err)
		return
	}
	// Short cache: an edit in Configuración shows up within a few minutes.
	w.Header().Set("Cache-Control", "public, max-age=300")
	writeJSON(w, http.StatusOK, publicSiteSettingsResponse{
		SiteName: value.SiteName, SiteDescription: value.SiteDescription, SupportEmail: value.SupportEmail,
		SEOTitle: value.SEOTitle, SEODescription: value.SEODescription, SEOIndexable: value.SEOIndexable,
	})
}
