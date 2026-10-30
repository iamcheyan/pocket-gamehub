package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
)

func (s *Server) scrape(w http.ResponseWriter, r *http.Request) {
	var input struct {
		GameIDs []int64 `json:"game_ids"`
		All     bool    `json:"all"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)
	_ = input
	provider := ScreenScraperProvider{Username: os.Getenv("SCREENSCRAPER_USERNAME"), Password: os.Getenv("SCREENSCRAPER_PASSWORD"), DeveloperID: os.Getenv("SCREENSCRAPER_DEVELOPER_ID")}
	err := provider.Scrape(r.Context(), nil)
	fail(w, 501, "metadata_not_configured", err.Error())
}

type MetadataProvider interface {
	Name() string
	Scrape(context.Context, []Game) error
}
type MockMetadataProvider struct{}

func (MockMetadataProvider) Name() string                         { return "mock" }
func (MockMetadataProvider) Scrape(context.Context, []Game) error { return nil }

type ScreenScraperProvider struct{ Username, Password, DeveloperID string }

func (ScreenScraperProvider) Name() string { return "screenscraper" }
func (p ScreenScraperProvider) Scrape(context.Context, []Game) error {
	if p.Username == "" || p.Password == "" || p.DeveloperID == "" {
		return errors.New("metadata_not_configured: ScreenScraper credentials are not configured")
	}
	return errors.New("metadata_not_configured: ScreenScraper API client is not configured")
}
