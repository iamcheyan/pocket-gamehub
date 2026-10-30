package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestOpenSeedsCatalog(t *testing.T) {
	db, e := Open(":memory:")
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	var n int
	if e = db.QueryRow(`SELECT count(*) FROM games`).Scan(&n); e != nil {
		t.Fatal(e)
	}
	if n < 100 {
		t.Fatalf("seeded %d games", n)
	}
}

func TestMigrationVersionRecorded(t *testing.T) {
	db, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var applied int
	if err = db.QueryRow(`SELECT MAX(version) FROM schema_migrations`).Scan(&applied); err != nil {
		t.Fatal(err)
	}
	if applied != schemaVersion {
		t.Fatalf("schema version %d, want %d", applied, schemaVersion)
	}
	for _, table := range []string{"games", "platforms", "collections", "favorites", "history", "screenshots", "settings"} {
		var name string
		if err = db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&name); err != nil {
			t.Errorf("missing table %q: %v", table, err)
		}
	}
}

func TestScanPrunesDeletedROMs(t *testing.T) {
	db, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	root := t.TempDir()
	rom := filepath.Join(root, "keep.gba")
	gone := filepath.Join(root, "gone.gba")
	for _, path := range []string{rom, gone} {
		if err = os.WriteFile(path, []byte("x"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	s := &Server{db: db, scan: map[string]any{}}
	s.doScan(context.Background(), root)
	if err = os.Remove(gone); err != nil {
		t.Fatal(err)
	}
	s.doScan(context.Background(), root)
	var remaining int
	if err = db.QueryRow(`SELECT count(*) FROM games WHERE rom_path LIKE ?`, root+"%").Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 1 {
		t.Fatalf("kept %d rows after prune, want 1", remaining)
	}
	if removed, _ := s.scan["removed"].(int); removed != 1 {
		t.Fatalf("removed counter %d, want 1", removed)
	}
}
func TestInferPlatform(t *testing.T) {
	cases := map[string]string{"/roms/GBA/x.gba": "GBA", "/roms/PSP/x.iso": "PSP", "/roms/PS1/x.chd": "PS1", "/roms/x.nds": "NDS"}
	for p, want := range cases {
		if got := inferPlatform("/roms", p); got != want {
			t.Errorf("inferPlatform(%q)=%q, want %q", p, got, want)
		}
	}
}
func TestStandaloneAndPPSSPPAdapters(t *testing.T) {
	dir := t.TempDir()
	program := filepath.Join(dir, "emulator")
	if err := os.WriteFile(program, []byte("#!/bin/sh\nexit 0\n"), 0700); err != nil {
		t.Fatal(err)
	}
	game := Game{ID: 9, ROMPath: "/roms/game.iso"}
	for name, adapter := range map[string]EmulatorAdapter{
		"standalone": StandaloneAdapter{AdapterName: "external", Binary: program},
		"ppsspp":     NewPPSSPPAdapter(program),
	} {
		t.Run(name, func(t *testing.T) {
			if ok, _ := adapter.Available(); !ok || adapter.Name() == "" {
				t.Fatal("adapter must be available and named")
			}
			session, err := adapter.Launch(context.Background(), game)
			if err != nil {
				t.Fatal(err)
			}
			waiter, ok := adapter.(waitableAdapter)
			if !ok {
				t.Fatal("adapter must expose process completion")
			}
			if code, err := waiter.Wait(session); err != nil || code != 0 {
				t.Fatalf("wait returned code %d, error %v", code, err)
			}
		})
	}
}
func TestMockAndScrapeError(t *testing.T) {
	db, e := Open(":memory:")
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	s := &Server{db: db, version: version, adapter: &RetroArchAdapter{Binary: "missing-retroarch"}}
	rr := httptest.NewRecorder()
	s.scrape(rr, httptest.NewRequest("POST", "/api/metadata/scrape", strings.NewReader(`{"all":true}`)))
	if rr.Code != 501 || !strings.Contains(rr.Body.String(), "metadata_not_configured") {
		t.Fatalf("unexpected scrape response: %d %s", rr.Code, rr.Body.String())
	}
}
func TestFavoritesAndCollectionMutations(t *testing.T) {
	db, e := Open(":memory:")
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	s := &Server{db: db}
	fav := httptest.NewRecorder()
	s.favorites(fav, httptest.NewRequest("POST", "/api/favorites", strings.NewReader(`{"game_id":1}`)))
	if fav.Code != 201 {
		t.Fatalf("favorite status %d", fav.Code)
	}
	var v int
	if e = db.QueryRow(`SELECT favorite FROM games WHERE id=1`).Scan(&v); e != nil || v != 1 {
		t.Fatalf("favorite flag %d: %v", v, e)
	}
	c := httptest.NewRecorder()
	s.collections(c, httptest.NewRequest("POST", "/api/collections", strings.NewReader(`{"name":"Test"}`)))
	if c.Code != 201 {
		t.Fatalf("collection status %d: %s", c.Code, c.Body.String())
	}
}
func TestDetailReturnsObjectAndCoverSVG(t *testing.T) {
	db, e := Open(":memory:")
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	s := &Server{db: db}
	detail := httptest.NewRecorder()
	s.game(detail, httptest.NewRequest("GET", "/api/games/1", nil))
	if detail.Code != 200 || !strings.Contains(detail.Body.String(), `"title"`) {
		t.Fatalf("detail: %d %s", detail.Code, detail.Body.String())
	}
	if strings.HasPrefix(strings.TrimSpace(detail.Body.String()), "[") {
		t.Fatal("detail returned array")
	}
	cover := httptest.NewRecorder()
	s.cover(cover, httptest.NewRequest("GET", "/api/cover/1", nil))
	if cover.Code != 200 || cover.Header().Get("Content-Type") != "image/svg+xml" || !strings.Contains(cover.Body.String(), "<svg") {
		t.Fatalf("cover: %d %s", cover.Code, cover.Body.String())
	}
}
func TestRetroArchStubArgvAndAutomaticExitHistory(t *testing.T) {
	db, e := Open(":memory:")
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	dir := t.TempDir()
	argv := filepath.Join(dir, "argv")
	script := filepath.Join(dir, "retroarch")
	body := "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"" + argv + "\"\nexit 7\n"
	if e = os.WriteFile(script, []byte(body), 0700); e != nil {
		t.Fatal(e)
	}
	a := &RetroArchAdapter{Binary: script, Core: "core.so", Config: "cfg"}
	session, e := a.Launch(context.Background(), Game{ID: 1, ROMPath: "/roms/x.gba"})
	if e != nil {
		t.Fatal(e)
	}
	code, e := a.Wait(session)
	if e != nil || code != 7 {
		t.Fatalf("exit code %d, err %v", code, e)
	}
	got, e := os.ReadFile(argv)
	if e != nil {
		t.Fatal(e)
	}
	want := "-L\ncore.so\n/roms/x.gba\n--appendconfig=cfg\n"
	if string(got) != want {
		t.Fatalf("argv %q, want %q", got, want)
	}
	if _, e = db.Exec("INSERT INTO history(id,game_id,launch_at) VALUES(?,?,?)", session.ID, 1, session.LaunchAt.Format(time.RFC3339Nano)); e != nil {
		t.Fatal(e)
	}
	s := &Server{db: db}
	s.recordExit(session, time.Now().UTC(), code)
	var exit sql.NullString
	var storedCode int
	if e = db.QueryRow(`SELECT exit_at,exit_code FROM history WHERE id=?`, session.ID).Scan(&exit, &storedCode); e != nil || !exit.Valid || storedCode != 7 {
		t.Fatalf("history exit %v code %d err %v", exit, storedCode, e)
	}
}
func TestLaunchWatcherPersistsProcessExit(t *testing.T) {
	db, e := Open(":memory:")
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	dir := t.TempDir()
	script := filepath.Join(dir, "retroarch")
	if e = os.WriteFile(script, []byte("#!/bin/sh\nexit 3\n"), 0700); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec(`UPDATE games SET rom_path='/tmp/game.gba' WHERE id=1`); e != nil {
		t.Fatal(e)
	}
	s := &Server{db: db, adapter: &RetroArchAdapter{Binary: script, Core: "core"}}
	rr := httptest.NewRecorder()
	s.launch(rr, httptest.NewRequest("POST", "/api/launch", strings.NewReader(`{"game_id":1}`)))
	if rr.Code != 202 {
		t.Fatalf("launch: %d %s", rr.Code, rr.Body.String())
	}
	var session Session
	if e = json.Unmarshal(rr.Body.Bytes(), &session); e != nil {
		t.Fatal(e)
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		var exit sql.NullString
		var code sql.NullInt64
		if e = db.QueryRow(`SELECT exit_at,exit_code FROM history WHERE id=?`, session.ID).Scan(&exit, &code); e == nil && exit.Valid && code.Valid {
			if code.Int64 != 3 {
				t.Fatalf("exit code %d", code.Int64)
			}
			var count int
			if e = db.QueryRow(`SELECT play_count FROM games WHERE id=1`).Scan(&count); e != nil || count != 1 {
				t.Fatalf("play count %d err %v", count, e)
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("process exit was not persisted")
}
func TestIncrementalScanAndCueGrouping(t *testing.T) {
	db, e := Open(":memory:")
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	root := t.TempDir()
	if e = os.Mkdir(filepath.Join(root, "PS1"), 0700); e != nil {
		t.Fatal(e)
	}
	cue := filepath.Join(root, "PS1", "disc.cue")
	bin := filepath.Join(root, "PS1", "disc.bin")
	if e = os.WriteFile(cue, []byte("cue"), 0600); e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(bin, []byte("bin"), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e = db.Exec(`DELETE FROM games`); e != nil {
		t.Fatal(e)
	}
	s := &Server{db: db, scan: map[string]any{}}
	s.doScan(context.Background(), root)
	var count int
	if e = db.QueryRow(`SELECT count(*) FROM games WHERE platform='PS1'`).Scan(&count); e != nil || count != 1 {
		t.Fatalf("grouped games %d, err %v", count, e)
	}
	var size int64
	if e = db.QueryRow(`SELECT size FROM games WHERE platform='PS1'`).Scan(&size); e != nil || size != 6 {
		t.Fatalf("combined size %d, err %v", size, e)
	}
	s.doScan(context.Background(), root)
	if s.scan["added"].(int) != 0 || s.scan["updated"].(int) != 0 || s.scan["unchanged"].(int) != 1 {
		t.Fatalf("incremental counters: %#v", s.scan)
	}
}
func TestScreenScraperConfiguration(t *testing.T) {
	p := ScreenScraperProvider{}
	if e := p.Scrape(context.Background(), nil); e == nil || !strings.Contains(e.Error(), "metadata_not_configured") {
		t.Fatalf("expected explicit unconfigured error, got %v", e)
	}
	p = ScreenScraperProvider{Username: "u", Password: "p", DeveloperID: "d"}
	if e := p.Scrape(context.Background(), nil); e == nil || !strings.Contains(e.Error(), "API client is not configured") {
		t.Fatalf("expected configured client boundary, got %v", e)
	}
}
