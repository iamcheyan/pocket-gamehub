import assert from "node:assert/strict";
import { parseLibrary, rowsFor, visibleWindow } from "./pocket/main.tsx";

const library = parseLibrary(JSON.stringify({ total: 6, sections: { games: [
  { name: "gba", count: 2, items: [{ title: "Demo", path: "/roms/demo.gba", size: 1024, kind: "rom" }, { title: "App", path: "/apps/demo.pocket", size: 2048, kind: "pocketjs" }] },
  { name: "snes", count: 1, items: [{ title: "Cart", path: "/roms/cart.sfc", size: 4096, kind: "rom" }] },
] } }));
assert.equal(rowsFor(library, "all").length, 3);
assert.equal(rowsFor(library, "gba").length, 2);
assert.equal(rowsFor(library, "snes")[0]?.path, "/roms/cart.sfc");
assert.deepEqual(visibleWindow(12, 0), { start: 0, end: 5 });
assert.deepEqual(visibleWindow(12, 11), { start: 7, end: 12 });
assert.equal(parseLibrary("not json").total, 0);
console.log("GameHub PocketJS model: 6 assertions passed");
