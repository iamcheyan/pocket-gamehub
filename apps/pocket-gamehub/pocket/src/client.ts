// GameHub client: library, platforms and launch state over gamed.
// No emulator or ROM exists on the device image; launch stays a report.
import { createPortClient } from "./client-kit";
import type { AppConfig, Metric, Section, SettingRow } from "./model";

const sections: Section[] = [
  {
    id: "recent", title: "RECENTLY PLAYED", jp: "最近プレイ", items: [
      { id: "g1", title: "Aster Drift", subtitle: "PlayStation · 12 h 41 m", meta: "last: today", badge: "PSX", progress: 0.68, body: "A handheld racing import, launched through RetroArch.", lines: [{ label: "platform", value: "psx" }, { label: "adapter", value: "retroarch" }, { label: "rom", value: "present" }] },
      { id: "g2", title: "Low Orbit", subtitle: "GBA · 3 h 08 m", meta: "last: 2 d", badge: "GBA", progress: 0.42, body: "Puzzle platformer from the GBA set." },
      { id: "g3", title: "Pocket Tennis", subtitle: "SNES · 48 m", meta: "last: 4 d", badge: "SNES", progress: 0.15, body: "Two-player exhibition mode." },
    ],
  },
  {
    id: "platforms", title: "PLATFORMS", jp: "プラットフォーム", items: [
      { id: "p-psx", title: "PlayStation", subtitle: "38 games · RetroArch", meta: "ready", badge: "SYS", body: "Metadata and box art are indexed; the core is not bundled." },
      { id: "p-gba", title: "Game Boy Advance", subtitle: "64 games · RetroArch", meta: "ready", badge: "SYS", body: "Game Boy Advance library." },
      { id: "p-snes", title: "Super Nintendo", subtitle: "41 games · RetroArch", meta: "stub", badge: "SYS", body: "Adapter stub used by the CLI contract test." },
    ],
  },
];

const metrics: Metric[] = [
  { label: "GAMES", value: "143" },
  { label: "PLATFORMS", value: "6" },
  { label: "FAVS", value: "12" },
];

const settings: SettingRow[] = [
  { id: "view", label: "Default view", jp: "表示", value: "GRID", options: ["GRID", "LIST"] },
  { id: "scrape", label: "Metadata", jp: "メタデータ", value: "ON", options: ["ON", "OFF"] },
  { id: "confirm", label: "Confirm launch", jp: "起動確認", value: "ON", options: ["ON", "OFF"] },
];

export const APP: AppConfig = {
  title: "GAMEHUB",
  jp: "ゲーム",
  kind: "detail",
  page: "GAMEHUB",
  tabs: ["ゲーム", "詳細", "設定"],
  actions: ["LAUNCH", "FAV", "SCAN"],
  settingsTitle: "LIBRARY",
  settingsJp: "ライブラリ設定",
  deviceGap: "gamed + emulator missing.",
  sourceNote: "/api/games · /api/platforms",
};

export const client = createPortClient({
  resource: "gamehub",
  fixture: { sections, metrics, settings },
  endpoints: {
    list: "/api/games",
    get: (id) => `/api/games/${encodeURIComponent(id)}`,
    action: (name) => `/api/${name === "SCAN" ? "scan" : "launch"}`,
  },
  act(name, payload, bundle) {
    const item = bundle.sections.flatMap((section) => section.items).find((entry) => entry.id === payload?.id);
    if (!item) return { ok: false, message: "no game selected" };
    if (name === "LAUNCH") { item.state = "launching"; return { ok: true, message: `${item.title}: adapter stub (no ROM on device)` }; }
    if (name === "FAV") { item.badge = "FAV"; return { ok: true, message: `${item.title} favourited` }; }
    if (name === "SCAN") { return { ok: true, message: "scan queued · 143 games indexed" }; }
    return { ok: false, message: `${name} unavailable` };
  },
});
