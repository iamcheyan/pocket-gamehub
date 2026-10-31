import { mount } from "@pocketjs/framework/solid";
import { ActionHandler, Text, View } from "@pocketjs/framework/solid/components";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { createSignal, Index } from "solid-js";

export type RomItem = { title: string; path: string; size: number; kind: string };
export type RomGroup = { name: string; count: number; items: RomItem[] };
export type RomLibrary = { generated?: number; total: number; sections: Record<string, RomGroup[]> };
export type Row = { title: string; subtitle: string; path: string; size: number; kind: string };
type Host = { __launcher?: (command: string) => string };

export function rowsFor(library: RomLibrary, system: string): Row[] {
  return (library.sections.games ?? []).filter(group => system === "all" || group.name === system)
    .flatMap(group => group.items.map(item => ({ ...item, subtitle: group.name.toUpperCase() })));
}
export function visibleWindow(count: number, selected: number, size = 5): { start: number; end: number } {
  const start = Math.max(0, Math.min(Math.max(0, count - size), selected - Math.floor(size / 2)));
  return { start, end: Math.min(count, start + size) };
}
export function parseLibrary(json: string): RomLibrary {
  try {
    const parsed = JSON.parse(json) as Partial<RomLibrary>;
    if (typeof parsed.total !== "number" || !parsed.sections || typeof parsed.sections !== "object") throw new Error();
    return { ...parsed, total: parsed.total, sections: parsed.sections } as RomLibrary;
  } catch {
    return { total: 0, sections: {} };
  }
}

const CYAN = "#3ECFFF", GREEN = "#00FF99", MUTED = "#7893A8", LINE = "#1B3345", PANEL = "#0d1b26";
const formatSize = (size: number) => size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(size / 1024))} KB`;

mount(() => {
  const host = (globalThis as typeof globalThis & { ui?: Host }).ui;
  const [library, setLibrary] = createSignal<RomLibrary>({ total: 0, sections: {} });
  const [system, setSystem] = createSignal("all");
  const [selected, setSelected] = createSignal(0);
  const [message, setMessage] = createSignal("↑↓ 选择　A 启动　B 返回");
  const [busy, setBusy] = createSignal(false);
  let previous = 0, armed = false, refresh = true;
  const systems = () => (library().sections.games ?? []).map(group => group.name);
  const currentSystem = () => system() === "all" ? "全部游戏" : system().toUpperCase();
  const items = () => rowsFor(library(), system());
  const scan = () => {
    refresh = false; setBusy(true); setMessage("正在扫描游戏…");
    const answer = host?.__launcher?.("ROMSCAN") ?? "Scan failed";
    const data = host?.__launcher?.("ROMS") ?? "";
    setLibrary(parseLibrary(data)); setSelected(0); setBusy(false);
    setMessage(/scan failed/i.test(answer) ? "扫描失败 · □ 重试" : `${parseLibrary(data).total} 个条目 · A 启动`);
  };
  const launch = (row = items()[selected()]) => {
    if (!row || row.kind === "pocketjs") { setMessage("PocketJS 应用由系统启动器打开"); return; }
    const answer = host?.__launcher?.(`ROMLAUNCH\t${row.path}`) ?? "No player configured";
    setMessage(answer);
  };
  const switchSystem = (delta: number) => {
    const choices = ["all", ...systems()];
    const index = choices.indexOf(system());
    setSystem(choices[(index + delta + choices.length) % choices.length]); setSelected(0);
  };
  const key = (buttons: number) => {
    if (!armed) { if (buttons === 0) armed = true; previous = buttons; return; }
    const pressed = buttons & ~previous; previous = buttons;
    if (pressed & BTN.UP) setSelected(index => Math.max(0, index - 1));
    else if (pressed & BTN.DOWN) setSelected(index => Math.min(Math.max(0, items().length - 1), index + 1));
    else if (pressed & BTN.LEFT) switchSystem(-1);
    else if (pressed & BTN.RIGHT) switchSystem(1);
    else if (pressed & BTN.CIRCLE) launch();
    else if (pressed & BTN.SQUARE) refresh = true;
    else if (pressed & BTN.CROSS) host?.__launcher?.("LAUNCH\tdisk");
  };
  onTextEvent((event: TextEvent) => {
    if (event.kind !== "key" || !event.pressed) return;
    if (event.key === "ArrowUp") setSelected(index => Math.max(0, index - 1));
    else if (event.key === "ArrowDown") setSelected(index => Math.min(Math.max(0, items().length - 1), index + 1));
    else if (event.key === "ArrowLeft") switchSystem(-1);
    else if (event.key === "ArrowRight") switchSystem(1);
    else if (event.key === "Escape") host?.__launcher?.("LAUNCH\tdisk");
    else if (event.key === "Enter") launch();
    return true;
  });
  onFrame(key);
  if (refresh) scan();

  const window = () => visibleWindow(items().length, selected());
  const shown = () => items().slice(window().start, window().end);
  const count = () => items().length;
  return (
    <View class="w-[360px] h-[240px] bg-[#0c131a] relative flex-col justify-between overflow-hidden">
      <View class="w-[360px] h-[22px] flex-col justify-between" style={{ bgColor: "#06111b" }}>
        <View class="w-[360px] h-[21px] flex-row items-center justify-between px-2">
          <View class="flex-row items-center gap-2">
            <Text class="text-xs font-bold tracking-wide" style={{ textColor: GREEN }}>GAMEHUB</Text>
            <Text class="text-xs" style={{ textColor: MUTED }}> / {currentSystem()}</Text>
          </View>
          <Text class="text-xs" style={{ textColor: GREEN }}>GBA · PJOS</Text>
        </View>
        <View class="w-[360px] h-[1px]" style={{ bgColor: LINE }} />
      </View>
      <View class="w-[360px] h-[198px] flex-col px-3 py-2">
        <View class="w-[336px] h-[17px] flex-row items-center justify-between mb-1">
          <Text class="text-xs font-bold" style={{ textColor: CYAN }}>{system() === "all" ? "游戏库" : currentSystem()}</Text>
          <Text class="text-xs" style={{ textColor: MUTED }}>{count()} / {library().total}</Text>
        </View>
        <View class="w-[336px] h-[145px] flex-col overflow-hidden">
          {shown().length ? <Index each={shown()}>
            {(row, index) => {
              const rowIndex = () => window().start + index;
              const active = () => rowIndex() === selected();
              return <ActionHandler button={BTN.CIRCLE} onPress={() => launch(row())}>
                <View class={active() ? "w-[336px] h-[27px] flex-row items-center justify-between px-2 rounded-sm bg-[#1e3042] border border-[#38bdf8]" : "w-[336px] h-[27px] flex-row items-center justify-between px-2 rounded-sm border border-transparent"}>
                  <View class="flex-row items-center gap-2">
                    <Text class="text-xs font-bold" style={{ textColor: active() ? GREEN : MUTED }}>{active() ? "▶" : "·"}</Text>
                    <Text class={active() ? "text-xs font-bold text-white" : "text-xs text-slate-300"}>{row().title}</Text>
                  </View>
                  <Text class="text-xs font-mono" style={{ textColor: MUTED }}>{row().subtitle} · {formatSize(row().size)}</Text>
                </View>
              </ActionHandler>;
            }}
          </Index> : <View class="w-[336px] h-[120px] flex-col items-center justify-center rounded-sm border border-[#1b3345]" style={{ bgColor: PANEL }}>
            <Text class="text-sm font-bold" style={{ textColor: "#D8E8FF" }}>{busy() ? "扫描中…" : "未找到游戏"}</Text>
            <Text class="text-xs mt-1" style={{ textColor: MUTED }}>将 GBA ROM 放入 /storage/content/games/gba</Text>
          </View>}
        </View>
        <View class="w-[336px] h-[21px] flex-row items-center justify-between mt-1">
          <Text class="text-xs" style={{ textColor: MUTED }}>{message()}</Text>
          <Text class="text-xs" style={{ textColor: CYAN }}>{count() ? `${selected() + 1}/${count()}` : "□ 扫描"}</Text>
        </View>
      </View>
      <View class="w-[360px] h-[20px] flex-col justify-between" style={{ bgColor: "#06111B" }}>
        <View class="w-[360px] h-[1px]" style={{ bgColor: LINE }} />
        <View class="w-[360px] h-[19px] flex-row items-center justify-between px-2">
          <Text class="text-xs font-bold" style={{ textColor: CYAN }}>LIBRARY</Text>
          <Text class="text-xs font-mono" style={{ textColor: MUTED }}>←→ 系统　↑↓ 选择　A 启动　B 返回</Text>
        </View>
      </View>
    </View>
  );
});
