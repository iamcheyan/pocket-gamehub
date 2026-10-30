package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (s *Server) scanStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		fail(w, 405, "method_not_allowed", "POST required")
		return
	}
	var b struct {
		Path   string `json:"path"`
		Cancel bool   `json:"cancel"`
	}
	_ = json.NewDecoder(r.Body).Decode(&b)
	s.scanMu.Lock()
	if b.Cancel {
		if s.scanCancel != nil {
			s.scanCancel()
		}
		s.scanMu.Unlock()
		jsonOut(w, 202, map[string]bool{"cancelling": true})
		return
	}
	if s.scan != nil && s.scan["running"] == true {
		s.scanMu.Unlock()
		fail(w, 409, "scan_running", "a scan is already running")
		return
	}
	root := b.Path
	if root == "" {
		root = s.romRoot
	}
	if root == "" {
		root = "ROMS"
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.scanCancel = cancel
	s.scan = map[string]any{"running": true, "progress": 0, "discovered": 0, "added": 0, "updated": 0, "unchanged": 0, "error": ""}
	s.scanMu.Unlock()
	go s.doScan(ctx, root)
	jsonOut(w, 202, map[string]any{"status": "started", "path": root})
}

func inferPlatform(root, path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".gb":
		return "GB"
	case ".gbc":
		return "GBC"
	case ".gba":
		return "GBA"
	case ".nes":
		return "NES"
	case ".sfc", ".smc":
		return "SNES"
	case ".chd", ".cue", ".bin":
		if rel, err := filepath.Rel(root, path); err == nil {
			parts := strings.Split(filepath.Clean(rel), string(filepath.Separator))
			for _, part := range parts {
				switch strings.ToUpper(part) {
				case "PS1", "PSX":
					return "PS1"
				case "PS2":
					return "PS2"
				}
			}
		}
		return "PS1"
	case ".iso":
		if strings.Contains(strings.ToLower(path), "psp") {
			return "PSP"
		}
		return "PS1"
	case ".nds":
		return "NDS"
	default:
		return "Unknown"
	}
}

func (s *Server) doScan(ctx context.Context, root string) {
	defer func() { s.scanMu.Lock(); s.scan["running"] = false; s.scanMu.Unlock() }()
	files := []string{}
	walkErr := filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() {
			ext := strings.ToLower(filepath.Ext(p))
			if strings.Contains("|.gb|.gbc|.gba|.nes|.sfc|.smc|.chd|.cue|.iso|.nds|.bin|", "|"+ext+"|") || (ext == ".pbp" || ext == ".cso") && strings.Contains(strings.ToLower(p), "psp") {
				files = append(files, p)
			}
		}
		return nil
	})
	if walkErr != nil {
		s.scanMu.Lock()
		s.scan["error"] = walkErr.Error()
		s.scanMu.Unlock()
		return
	}
	cueBins := map[string]string{}
	for _, p := range files {
		if strings.EqualFold(filepath.Ext(p), ".cue") {
			bin := strings.TrimSuffix(p, filepath.Ext(p)) + ".bin"
			if _, err := os.Stat(bin); err == nil {
				cueBins[bin] = p
			}
		}
	}
	total, added, updated, unchanged, processed := len(files), 0, 0, 0, 0
	for _, p := range files {
		select {
		case <-ctx.Done():
			s.scanMu.Lock()
			s.scan["cancelled"] = true
			s.scanMu.Unlock()
			return
		default:
		}
		processed++
		if strings.EqualFold(filepath.Ext(p), ".bin") && cueBins[p] != "" {
			s.updateScan(processed, total, added, updated, unchanged)
			continue
		}
		platform := inferPlatform(root, p)
		st, err := os.Stat(p)
		if err != nil {
			continue
		}
		title := strings.TrimSuffix(filepath.Base(p), filepath.Ext(p))
		mtime, size := st.ModTime().UnixNano(), st.Size()
		if strings.EqualFold(filepath.Ext(p), ".cue") {
			bin := strings.TrimSuffix(p, filepath.Ext(p)) + ".bin"
			if bs, e := os.Stat(bin); e == nil {
				if bs.ModTime().UnixNano() > mtime {
					mtime = bs.ModTime().UnixNano()
				}
				size += bs.Size()
			}
		}
		var oldMtime, oldSize int64
		err = s.db.QueryRow(`SELECT mtime,size FROM games WHERE rom_path=?`, p).Scan(&oldMtime, &oldSize)
		if errors.Is(err, sql.ErrNoRows) {
			if _, e := s.db.Exec(`INSERT INTO games(title,platform,rom_path,metadata_status,mtime,size) VALUES(?,?,?,'mock',?,?)`, title, platform, p, mtime, size); e == nil {
				added++
			}
		} else if err == nil && (oldMtime != mtime || oldSize != size) {
			if _, e := s.db.Exec(`UPDATE games SET title=?,platform=?,mtime=?,size=? WHERE rom_path=?`, title, platform, mtime, size, p); e == nil {
				updated++
			}
		} else if err == nil {
			unchanged++
		}
		s.updateScan(processed, total, added, updated, unchanged)
	}
	// Incremental sync also removes catalogue rows whose ROM no longer exists.
	// Only paths under this scan root participate, so scanning one library does
	// not delete games discovered elsewhere.
	pruneStale := 0
	rows, err := s.db.Query(`SELECT id, rom_path FROM games WHERE rom_path IS NOT NULL AND rom_path <> ''`)
	if err == nil {
		type stale struct {
			id   int64
			path string
		}
		var candidates []stale
		for rows.Next() {
			var item stale
			if rows.Scan(&item.id, &item.path) == nil && withinRoot(root, item.path) {
				candidates = append(candidates, item)
			}
		}
		rows.Close()
		for _, item := range candidates {
			if _, statErr := os.Stat(item.path); errors.Is(statErr, os.ErrNotExist) {
				if _, delErr := s.db.Exec(`DELETE FROM games WHERE id=?`, item.id); delErr == nil {
					pruneStale++
				}
			}
		}
	}
	s.scanMu.Lock()
	s.scan["removed"] = pruneStale
	s.scanMu.Unlock()
}

// withinRoot reports whether path sits inside root, guarding the prune step
// against deleting games that belong to a different configured library.
func withinRoot(root, path string) bool {
	absRoot, errRoot := filepath.Abs(root)
	absPath, errPath := filepath.Abs(path)
	if errRoot != nil || errPath != nil {
		return false
	}
	rel, err := filepath.Rel(absRoot, absPath)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
func (s *Server) updateScan(processed, total, added, updated, unchanged int) {
	s.scanMu.Lock()
	defer s.scanMu.Unlock()
	s.scan["progress"] = float64(processed) / float64(max(1, total))
	s.scan["discovered"] = processed
	s.scan["added"] = added
	s.scan["updated"] = updated
	s.scan["unchanged"] = unchanged
}
