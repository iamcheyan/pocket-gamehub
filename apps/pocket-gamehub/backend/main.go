package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	dbPath := os.Getenv("GAMEHUB_DB")
	if dbPath == "" {
		dbPath = "gamehub.db"
	}
	db, e := Open(dbPath)
	if e != nil {
		panic(e)
	}
	defer db.Close()
	root := os.Getenv("GAMEHUB_ROMS")
	s := &Server{db: db, version: version, adapter: &RetroArchAdapter{Binary: os.Getenv("RETROARCH"), Core: os.Getenv("RETROARCH_CORE"), Config: os.Getenv("RETROARCH_CONFIG")}, romRoot: root, scan: map[string]any{}}
	addr := os.Getenv("GAMEHUB_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	fmt.Printf("gamed %s listening on %s\n", version, addr)
	if e = http.ListenAndServe(addr, s.routes()); e != nil {
		panic(e)
	}
}
