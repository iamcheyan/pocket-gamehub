package main

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

const version = "0.1.0"

// schemaVersion is the highest migration applied by Open. Migrations are
// append-only: every entry upgrades a database from its previous version.
const schemaVersion = 1

type Game struct {
	ID             int64      `json:"id"`
	Title          string     `json:"title"`
	Platform       string     `json:"platform"`
	ROMPath        string     `json:"rom_path,omitempty"`
	Developer      string     `json:"developer,omitempty"`
	Publisher      string     `json:"publisher,omitempty"`
	Description    string     `json:"description,omitempty"`
	Genre          string     `json:"genre,omitempty"`
	ReleaseDate    string     `json:"release_date,omitempty"`
	CoverURL       string     `json:"cover_url,omitempty"`
	Favorite       bool       `json:"favorite"`
	PlayCount      int        `json:"play_count"`
	LastPlayed     *time.Time `json:"last_played,omitempty"`
	PlayTime       int64      `json:"play_time"`
	MetadataStatus string     `json:"metadata_status"`
}

type migration struct {
	version    int
	statements string
}

var migrations = []migration{
	{1, `
CREATE TABLE IF NOT EXISTS platforms(id INTEGER PRIMARY KEY,name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS games(
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, platform TEXT NOT NULL,
  rom_path TEXT UNIQUE, developer TEXT, publisher TEXT, description TEXT,
  genre TEXT, release_date TEXT, cover_url TEXT,
  favorite INTEGER NOT NULL DEFAULT 0, play_count INTEGER NOT NULL DEFAULT 0,
  last_played TEXT, play_time INTEGER NOT NULL DEFAULT 0,
  metadata_status TEXT NOT NULL DEFAULT 'mock',
  mtime INTEGER NOT NULL DEFAULT 0, size INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS collections(
  id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS collection_games(
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  PRIMARY KEY(collection_id,game_id));
CREATE TABLE IF NOT EXISTS favorites(
  game_id INTEGER PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS history(
  id TEXT PRIMARY KEY, game_id INTEGER NOT NULL REFERENCES games(id),
  launch_at TEXT NOT NULL, exit_at TEXT,
  duration INTEGER NOT NULL DEFAULT 0, exit_code INTEGER);
CREATE TABLE IF NOT EXISTS screenshots(
  id INTEGER PRIMARY KEY, game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  path TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
`},
}

// seedTitles gives the mock catalogue recognisable placeholder titles so the
// UI can be demonstrated without a licensed metadata provider.
var seedPlatforms = []string{"GB", "GBC", "GBA", "NES", "SNES", "PS1", "NDS", "PSP"}

var seedTitles = []string{
	"Super Mario Land", "Tetris", "Pokémon Red", "Kirby's Dream Land",
	"Metroid II", "Wario Land", "Donkey Kong", "Zelda: Link's Awakening",
	"Pokémon Gold", "Wario Land II", "Metal Gear Solid", "Castlevania",
	"Golden Sun", "Advance Wars", "Fire Emblem", "Mother 3",
	"Pokémon Emerald", "Mario Kart: Super Circuit", "Zelda: Minish Cap",
	"Super Mario Bros.", "The Legend of Zelda", "Mega Man 2", "Contra",
	"Castlevania III", "Punch-Out!!", "Kirby's Adventure", "Ninja Gaiden",
	"Super Mario World", "Chrono Trigger", "Super Metroid", "Final Fantasy VI",
	"Donkey Kong Country", "EarthBound", "Secret of Mana", "Star Fox",
	"Final Fantasy VII", "Metal Gear Solid", "Resident Evil 2", "Crash Bandicoot",
	"Tekken 3", "Gran Turismo 2", "Silent Hill", "Castlevania: SotN",
	"Spyro the Dragon", "Vagrant Story", "Tony Hawk's Pro Skater 2",
	"Final Fantasy IX", "Ape Escape",
	"Mario Kart DS", "New Super Mario Bros.", "Pokémon Diamond", "Brain Age",
	"Animal Crossing: Wild World", "Castlevania: Dawn of Sorrow",
	"The World Ends with You", "Advance Wars: Dual Strike", "Professor Layton",
	"Phoenix Wright", "Kingdom Hearts 358/2 Days",
	"God of War: Chains of Olympus", "Monster Hunter Freedom Unite",
	"Crisis Core: Final Fantasy VII", "Metal Gear Solid: Peace Walker",
	"Daxter", "Ratchet & Clank: Size Matters", "Patapon", "LocoRoco",
	"Persona 3 Portable", "Kingdom Hearts: Birth by Sleep", "Dissidia",
}

func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err = db.Exec(`PRAGMA foreign_keys=ON`); err != nil {
		db.Close()
		return nil, err
	}
	if err = migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	if err = seedMockCatalog(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func migrate(db *sql.DB) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY)`); err != nil {
		return err
	}
	var current int
	if err := db.QueryRow(`SELECT COALESCE(MAX(version),0) FROM schema_migrations`).Scan(&current); err != nil {
		return err
	}
	for _, m := range migrations {
		if m.version <= current {
			continue
		}
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		if _, err = tx.Exec(m.statements); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %d: %w", m.version, err)
		}
		if _, err = tx.Exec(`INSERT INTO schema_migrations(version) VALUES(?)`, m.version); err != nil {
			tx.Rollback()
			return fmt.Errorf("record migration %d: %w", m.version, err)
		}
		if err = tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func seedMockCatalog(db *sql.DB) error {
	var count int
	if err := db.QueryRow(`SELECT count(*) FROM games`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for i := range 120 {
		title := seedTitles[i%len(seedTitles)]
		if i >= len(seedTitles) {
			title = fmt.Sprintf("%s (%d)", title, i/len(seedTitles)+1)
		}
		platform := seedPlatforms[i%len(seedPlatforms)]
		if _, err = tx.Exec(
			`INSERT INTO games(title,platform,developer,publisher,description,genre,release_date,cover_url,metadata_status)
			 VALUES(?,?,?,?,?,?,?,?,?)`,
			title, platform, "Mock Studio", "Mock Publisher",
			"A sample catalogue entry used for interface development.", "Action",
			"1998-01-01", fmt.Sprintf("mock://cover/%d", i+1), "mock",
		); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}
