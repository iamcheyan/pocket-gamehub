package main

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type Session struct {
	ID       string     `json:"id"`
	GameID   int64      `json:"game_id"`
	LaunchAt time.Time  `json:"launch_at"`
	ExitAt   *time.Time `json:"exit_at,omitempty"`
	Duration int64      `json:"duration"`
	ExitCode *int       `json:"exit_code,omitempty"`
	Err      string     `json:"error,omitempty"`
	cmd      *exec.Cmd
}

type EmulatorAdapter interface {
	Name() string
	Available() (bool, string)
	Launch(context.Context, Game) (Session, error)
	SaveState(context.Context, Game) error
	LoadState(context.Context, Game) error
	Screenshot(context.Context, Game) ([]byte, error)
}

type RetroArchAdapter struct{ Binary, Core, Config string }

func (a *RetroArchAdapter) Name() string { return "retroarch" }
func (a *RetroArchAdapter) Available() (bool, string) {
	b := a.Binary
	if b == "" {
		b = "retroarch"
	}
	out, err := exec.Command(b, "--version").CombinedOutput()
	if err != nil {
		return false, "not-installed"
	}
	return true, strings.TrimSpace(string(out))
}
func (a *RetroArchAdapter) Launch(ctx context.Context, g Game) (Session, error) {
	if g.ROMPath == "" {
		return Session{}, errors.New("game has no ROM path")
	}
	b := a.Binary
	if b == "" {
		b = "retroarch"
	}
	rom := strings.SplitN(g.ROMPath, "|", 2)[0]
	args := []string{}
	if a.Core != "" {
		args = append(args, "-L", a.Core)
	}
	args = append(args, rom)
	if a.Config != "" {
		args = append(args, "--appendconfig="+a.Config)
	}
	now := time.Now().UTC()
	cmd := exec.CommandContext(ctx, b, args...)
	if err := cmd.Start(); err != nil {
		return Session{}, err
	}
	return Session{ID: fmt.Sprintf("%d-%d", g.ID, now.UnixNano()), GameID: g.ID, LaunchAt: now, cmd: cmd}, nil
}
func (a *RetroArchAdapter) SaveState(context.Context, Game) error {
	return errors.New("RetroArch save state requires a running frontend command channel")
}
func (a *RetroArchAdapter) LoadState(context.Context, Game) error {
	return errors.New("RetroArch load state requires a running frontend command channel")
}
func (a *RetroArchAdapter) Screenshot(context.Context, Game) ([]byte, error) {
	return nil, errors.New("screenshot capture is unavailable")
}

type waitableAdapter interface{ Wait(Session) (int, error) }

func (a *RetroArchAdapter) Wait(s Session) (int, error) {
	if s.cmd == nil {
		return 0, errors.New("session has no process")
	}
	err := s.cmd.Wait()
	if err == nil {
		return 0, nil
	}
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		return ee.ExitCode(), nil
	}
	return -1, err
}

type StandaloneAdapter struct {
	AdapterName string
	Binary      string
	Args        func(Game) []string
}

func (a StandaloneAdapter) Name() string {
	if a.AdapterName != "" {
		return a.AdapterName
	}
	return "standalone"
}
func (a StandaloneAdapter) Available() (bool, string) {
	path, err := exec.LookPath(a.Binary)
	if err != nil {
		return false, "not-installed"
	}
	return true, path
}
func (a StandaloneAdapter) Launch(ctx context.Context, game Game) (Session, error) {
	if game.ROMPath == "" {
		return Session{}, errors.New("game has no ROM path")
	}
	args := []string{game.ROMPath}
	if a.Args != nil {
		args = a.Args(game)
	}
	cmd := exec.CommandContext(ctx, a.Binary, args...)
	started := time.Now().UTC()
	if err := cmd.Start(); err != nil {
		return Session{}, err
	}
	return Session{ID: fmt.Sprintf("%d-%d", game.ID, started.UnixNano()), GameID: game.ID, LaunchAt: started, cmd: cmd}, nil
}
func (a StandaloneAdapter) Wait(session Session) (int, error) {
	if session.cmd == nil {
		return 0, errors.New("session has no process")
	}
	err := session.cmd.Wait()
	if err == nil {
		return 0, nil
	}
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		return exit.ExitCode(), nil
	}
	return -1, err
}
func (StandaloneAdapter) SaveState(context.Context, Game) error {
	return errors.New("save state unsupported")
}
func (StandaloneAdapter) LoadState(context.Context, Game) error {
	return errors.New("load state unsupported")
}
func (StandaloneAdapter) Screenshot(context.Context, Game) ([]byte, error) {
	return nil, errors.New("screenshot capture is unavailable")
}

type PPSSPPAdapter struct{ StandaloneAdapter }

func NewPPSSPPAdapter(binary string) PPSSPPAdapter {
	return PPSSPPAdapter{StandaloneAdapter{AdapterName: "ppsspp", Binary: binary}}
}
