package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Server struct {
	db         *sql.DB
	version    string
	adapter    EmulatorAdapter
	romRoot    string
	scanMu     sync.Mutex
	scanCancel context.CancelFunc
	scan       map[string]any
}

func (s *Server) routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("/api/health", s.health)
	m.HandleFunc("/api/home", s.home)
	m.HandleFunc("/api/games", s.games)
	m.HandleFunc("/api/games/", s.game)
	m.HandleFunc("/api/platforms", s.platforms)
	m.HandleFunc("/api/favorites", s.favorites)
	m.HandleFunc("/api/favorites/", s.favoriteID)
	m.HandleFunc("/api/collections", s.collections)
	m.HandleFunc("/api/collections/", s.collectionID)
	m.HandleFunc("/api/search", s.search)
	m.HandleFunc("/api/launch", s.launch)
	m.HandleFunc("/api/launch/", s.stop)
	m.HandleFunc("/api/history", s.history)
	m.HandleFunc("/api/cover/", s.cover)
	m.HandleFunc("/api/screenshots/", s.screenshots)
	m.HandleFunc("/api/scan", s.scanStart)
	m.HandleFunc("/api/scan/status", s.scanStatus)
	m.HandleFunc("/api/metadata/scrape", s.scrape)
	m.HandleFunc("/api/settings", s.settings)
	return m
}

func jsonOut(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, code, msg string) {
	jsonOut(w, status, map[string]any{"error": map[string]string{"code": code, "message": msg}})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	available, detail := s.adapter.Available()
	state := "not-installed"
	if available {
		state = "available"
	}
	jsonOut(w, 200, map[string]any{"version": s.version, "gamed_version": s.version, "emulator": state, "emulator_detail": detail, "metadata_provider": "mock", "metadata_mock": true})
}

func scanGame(rows *sql.Rows) (Game, error) {
	var g Game
	var fav int
	var lp sql.NullString
	e := rows.Scan(&g.ID, &g.Title, &g.Platform, &g.ROMPath, &g.Developer, &g.Publisher, &g.Description, &g.Genre, &g.ReleaseDate, &g.CoverURL, &fav, &g.PlayCount, &lp, &g.PlayTime, &g.MetadataStatus)
	g.Favorite = fav != 0
	if lp.Valid {
		t, _ := time.Parse(time.RFC3339Nano, lp.String)
		g.LastPlayed = &t
	}
	return g, e
}

const selectGames = `SELECT id,title,platform,COALESCE(rom_path,''),COALESCE(developer,''),COALESCE(publisher,''),COALESCE(description,''),COALESCE(genre,''),COALESCE(release_date,''),COALESCE(cover_url,''),favorite,play_count,last_played,play_time,metadata_status FROM games`

func (s *Server) list(w http.ResponseWriter, q string, args ...any) {
	rows, e := s.db.Query(selectGames+q, args...)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	defer rows.Close()
	out := []Game{}
	for rows.Next() {
		g, e := scanGame(rows)
		if e != nil {
			fail(w, 500, "database_error", e.Error())
			return
		}
		out = append(out, g)
	}
	jsonOut(w, 200, out)
}

func (s *Server) games(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		fail(w, 405, "method_not_allowed", "GET required")
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	platform := r.URL.Query().Get("platform")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 200 {
		limit = 100
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	where := " WHERE 1=1"
	args := []any{}
	if q != "" {
		where += " AND (title LIKE ? OR platform LIKE ? OR developer LIKE ? OR publisher LIKE ?)"
		for i := 0; i < 4; i++ {
			args = append(args, "%"+q+"%")
		}
	}
	if platform != "" {
		where += " AND platform=?"
		args = append(args, platform)
	}
	args = append(args, limit, (page-1)*limit)
	s.list(w, where+" ORDER BY title LIMIT ? OFFSET ?", args...)
}
func (s *Server) game(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/games/")
	if id == "" {
		s.games(w, r)
		return
	}
	rows, e := s.db.Query(selectGames+` WHERE id=?`, id)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	defer rows.Close()
	if !rows.Next() {
		fail(w, 404, "game_not_found", "game not found")
		return
	}
	g, e := scanGame(rows)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	jsonOut(w, 200, g)
}
func (s *Server) platforms(w http.ResponseWriter, r *http.Request) {
	rows, e := s.db.Query(`SELECT platform,count(*) FROM games GROUP BY platform ORDER BY platform`)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	defer rows.Close()
	a := []map[string]any{}
	for rows.Next() {
		var p string
		var n int
		_ = rows.Scan(&p, &n)
		a = append(a, map[string]any{"name": p, "game_count": n})
	}
	jsonOut(w, 200, a)
}

func (s *Server) favorites(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var b struct {
			GameID int64 `json:"game_id"`
		}
		if json.NewDecoder(r.Body).Decode(&b) != nil {
			fail(w, 400, "invalid_json", "expected game_id")
			return
		}
		res, e := s.db.Exec(`INSERT OR IGNORE INTO favorites(game_id) SELECT id FROM games WHERE id=?`, b.GameID)
		_ = res
		if e != nil {
			fail(w, 500, "database_error", e.Error())
			return
		}
		_, _ = s.db.Exec(`UPDATE games SET favorite=1 WHERE id=?`, b.GameID)
		jsonOut(w, 201, map[string]any{"game_id": b.GameID, "favorite": true})
		return
	}
	s.list(w, " WHERE favorite=1 ORDER BY title")
}
func (s *Server) favoriteID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/favorites/")
	if r.Method != "DELETE" {
		fail(w, 405, "method_not_allowed", "DELETE required")
		return
	}
	_, e := s.db.Exec(`DELETE FROM favorites WHERE game_id=?`, id)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	_, _ = s.db.Exec(`UPDATE games SET favorite=0 WHERE id=?`, id)
	w.WriteHeader(204)
}

func (s *Server) home(w http.ResponseWriter, r *http.Request) {
	data := map[string]any{}
	for key, q := range map[string]string{"continue_playing": " WHERE play_count>0 ORDER BY last_played DESC LIMIT 10", "recently_played": " WHERE play_count>0 ORDER BY last_played DESC LIMIT 10", "favorites": " WHERE favorite=1 ORDER BY title LIMIT 20", "recently_added": " ORDER BY id DESC LIMIT 20"} {
		rows, e := s.db.Query(selectGames + q)
		if e != nil {
			continue
		}
		a := []Game{}
		for rows.Next() {
			g, _ := scanGame(rows)
			a = append(a, g)
		}
		rows.Close()
		data[key] = a
	}
	rows, _ := s.db.Query(`SELECT id,name,description FROM collections`)
	c := []map[string]any{}
	if rows != nil {
		for rows.Next() {
			var id int64
			var n, d string
			_ = rows.Scan(&id, &n, &d)
			c = append(c, map[string]any{"id": id, "name": n, "description": d})
		}
		rows.Close()
	}
	data["collections"] = c
	jsonOut(w, 200, data)
}
func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		jsonOut(w, 200, []Game{})
		return
	}
	s.list(w, " WHERE title LIKE ? OR platform LIKE ? OR developer LIKE ? OR publisher LIKE ? ORDER BY title LIMIT 100", strings.Repeat("%"+q+"%", 1), "%"+q+"%", "%"+q+"%", "%"+q+"%")
}

func (s *Server) collections(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var b struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if json.NewDecoder(r.Body).Decode(&b) != nil || strings.TrimSpace(b.Name) == "" {
			fail(w, 400, "invalid_collection", "name required")
			return
		}
		res, e := s.db.Exec(`INSERT INTO collections(name,description) VALUES(?,?)`, b.Name, b.Description)
		if e != nil {
			fail(w, 409, "collection_exists", e.Error())
			return
		}
		id, _ := res.LastInsertId()
		jsonOut(w, 201, map[string]any{"id": id, "name": b.Name, "description": b.Description, "games": []Game{}})
		return
	}
	rows, e := s.db.Query(`SELECT id,name,description FROM collections ORDER BY name`)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var n, d string
		_ = rows.Scan(&id, &n, &d)
		out = append(out, map[string]any{"id": id, "name": n, "description": d})
	}
	jsonOut(w, 200, out)
}
func (s *Server) collectionID(w http.ResponseWriter, r *http.Request) {
	part := strings.TrimPrefix(r.URL.Path, "/api/collections/")
	bits := strings.Split(part, "/")
	id := bits[0]
	if len(bits) > 1 && bits[1] == "games" {
		var b struct {
			GameID int64 `json:"game_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		if r.Method == "POST" {
			_, e := s.db.Exec(`INSERT OR IGNORE INTO collection_games(collection_id,game_id) VALUES(?,?)`, id, b.GameID)
			if e != nil {
				fail(w, 404, "not_found", e.Error())
				return
			}
			jsonOut(w, 200, map[string]bool{"ok": true})
			return
		}
		if r.Method == "DELETE" {
			_, _ = s.db.Exec(`DELETE FROM collection_games WHERE collection_id=? AND game_id=?`, id, b.GameID)
			w.WriteHeader(204)
			return
		}
	}
	if r.Method == "DELETE" {
		_, _ = s.db.Exec(`DELETE FROM collections WHERE id=?`, id)
		w.WriteHeader(204)
		return
	}
	if r.Method == "PUT" {
		var b struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		_, e := s.db.Exec(`UPDATE collections SET name=?,description=? WHERE id=?`, b.Name, b.Description, id)
		if e != nil {
			fail(w, 400, "invalid_collection", e.Error())
			return
		}
	}
	rows, e := s.db.Query(selectGames+` JOIN collection_games cg ON cg.game_id=games.id WHERE cg.collection_id=? ORDER BY title`, id)
	if e != nil {
		fail(w, 404, "not_found", e.Error())
		return
	}
	defer rows.Close()
	a := []Game{}
	for rows.Next() {
		g, _ := scanGame(rows)
		a = append(a, g)
	}
	jsonOut(w, 200, map[string]any{"id": id, "games": a})
}

func (s *Server) launch(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		fail(w, 405, "method_not_allowed", "POST required")
		return
	}
	var b struct {
		GameID int64 `json:"game_id"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		fail(w, 400, "invalid_json", "game_id required")
		return
	}
	var g Game
	rows, e := s.db.Query(selectGames+` WHERE id=?`, b.GameID)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	if !rows.Next() {
		rows.Close()
		fail(w, 404, "game_not_found", "game not found")
		return
	}
	g, _ = scanGame(rows)
	rows.Close()
	if g.ROMPath == "" {
		fail(w, 409, "rom_missing", "game has no ROM; cannot launch")
		return
	}
	session, e := s.adapter.Launch(r.Context(), g)
	if e != nil {
		fail(w, 503, "launch_failed", e.Error())
		return
	}
	_, e = s.db.Exec(`INSERT INTO history(id,game_id,launch_at) VALUES(?,?,?)`, session.ID, g.ID, session.LaunchAt.Format(time.RFC3339Nano))
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	_, _ = s.db.Exec(`UPDATE games SET play_count=play_count+1,last_played=? WHERE id=?`, session.LaunchAt.Format(time.RFC3339Nano), g.ID)
	s.watchSession(session)
	jsonOut(w, 202, session)
}
func (s *Server) recordExit(session Session, at time.Time, code int) {
	duration := int64(at.Sub(session.LaunchAt).Seconds())
	res, e := s.db.Exec(`UPDATE history SET exit_at=?,duration=?,exit_code=? WHERE id=? AND exit_at IS NULL`, at.Format(time.RFC3339Nano), duration, code, session.ID)
	if e != nil {
		return
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		_, _ = s.db.Exec(`UPDATE games SET play_time=play_time+? WHERE id=?`, duration, session.GameID)
	}
}
func (s *Server) watchSession(session Session) {
	w, ok := s.adapter.(waitableAdapter)
	if !ok || session.cmd == nil {
		return
	}
	go func() {
		code, err := w.Wait(session)
		if err != nil {
			code = -1
		}
		s.recordExit(session, time.Now().UTC(), code)
	}()
}
func (s *Server) stop(w http.ResponseWriter, r *http.Request) {
	part := strings.TrimPrefix(r.URL.Path, "/api/launch/")
	if !strings.HasSuffix(part, "/stop") {
		fail(w, 404, "not_found", "route not found")
		return
	}
	id := strings.TrimSuffix(part, "/stop")
	var launch string
	var gameID int64
	e := s.db.QueryRow(`SELECT launch_at,game_id FROM history WHERE id=?`, id).Scan(&launch, &gameID)
	if e != nil {
		fail(w, 404, "session_not_found", "session not found")
		return
	}
	t, _ := time.Parse(time.RFC3339Nano, launch)
	now := time.Now().UTC()
	session := Session{ID: id, GameID: gameID, LaunchAt: t}
	s.recordExit(session, now, 0)
	jsonOut(w, 200, map[string]any{"id": id, "game_id": gameID, "launch_at": t, "exit_at": now, "duration": int64(now.Sub(t).Seconds())})
}
func (s *Server) history(w http.ResponseWriter, r *http.Request) {
	n, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if n < 1 || n > 500 {
		n = 100
	}
	rows, e := s.db.Query(`SELECT id,game_id,launch_at,exit_at,duration,exit_code FROM history ORDER BY launch_at DESC LIMIT ?`, n)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	defer rows.Close()
	a := []Session{}
	for rows.Next() {
		var x Session
		var la string
		var ex sql.NullString
		var code sql.NullInt64
		_ = rows.Scan(&x.ID, &x.GameID, &la, &ex, &x.Duration, &code)
		x.LaunchAt, _ = time.Parse(time.RFC3339Nano, la)
		if ex.Valid {
			t, _ := time.Parse(time.RFC3339Nano, ex.String)
			x.ExitAt = &t
		}
		if code.Valid {
			c := int(code.Int64)
			x.ExitCode = &c
		}
		a = append(a, x)
	}
	jsonOut(w, 200, a)
}

func (s *Server) cover(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/cover/")
	var title string
	if e := s.db.QueryRow(`SELECT title FROM games WHERE id=?`, id).Scan(&title); e != nil {
		http.NotFound(w, r)
		return
	}
	safe := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;").Replace(title)
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = fmt.Fprintf(w, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 440"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#171a31"/><stop offset="1" stop-color="#632b72"/></linearGradient></defs><rect width="320" height="440" fill="url(#g)"/><circle cx="160" cy="150" r="74" fill="#eea06d" opacity=".9"/><text x="160" y="300" fill="white" font-family="sans-serif" font-size="20" text-anchor="middle">%s</text></svg>`, safe)
}
func (s *Server) screenshots(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/screenshots/")
	rows, e := s.db.Query(`SELECT id,path,created_at FROM screenshots WHERE game_id=?`, id)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	defer rows.Close()
	a := []map[string]any{}
	for rows.Next() {
		var x int64
		var p, t string
		_ = rows.Scan(&x, &p, &t)
		a = append(a, map[string]any{"id": x, "path": p, "created_at": t})
	}
	jsonOut(w, 200, a)
}

func (s *Server) scanStatus(w http.ResponseWriter, r *http.Request) {
	s.scanMu.Lock()
	defer s.scanMu.Unlock()
	if s.scan == nil {
		s.scan = map[string]any{"running": false, "progress": 0, "discovered": 0, "added": 0, "updated": 0}
	}
	jsonOut(w, 200, s.scan)
}

func (s *Server) settings(w http.ResponseWriter, r *http.Request) {
	if r.Method == "PUT" {
		var v map[string]any
		if json.NewDecoder(r.Body).Decode(&v) != nil {
			fail(w, 400, "invalid_json", "expected JSON object")
			return
		}
		tx, e := s.db.Begin()
		if e != nil {
			fail(w, 500, "database_error", e.Error())
			return
		}
		for k, x := range v {
			b, _ := json.Marshal(x)
			if _, e = tx.Exec(`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, k, string(b)); e != nil {
				tx.Rollback()
				fail(w, 500, "database_error", e.Error())
				return
			}
		}
		_ = tx.Commit()
	}
	rows, e := s.db.Query(`SELECT key,value FROM settings ORDER BY key`)
	if e != nil {
		fail(w, 500, "database_error", e.Error())
		return
	}
	defer rows.Close()
	v := map[string]json.RawMessage{}
	for rows.Next() {
		var k, b string
		_ = rows.Scan(&k, &b)
		v[k] = json.RawMessage(b)
	}
	jsonOut(w, 200, v)
}
