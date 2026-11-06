import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../src/game.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const {
  randomFleet,
  cellsFor,
  newerSnapshot,
  clockLeft,
  clockLabel,
  coordinate,
} = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
test("random placement creates exactly 17 unique bounded contiguous cells across 200 fleets", () => {
  for (let i = 0; i < 200; i++) {
    const ships = randomFleet();
    assert.equal(ships.length, 5);
    const cells = ships.flatMap((s) => s.cells);
    assert.equal(cells.length, 17);
    assert.equal(new Set(cells).size, 17);
    assert(cells.every((c) => c >= 0 && c < 100));
    for (const s of ships) {
      const d = s.cells[1] - s.cells[0];
      assert([1, 10].includes(d));
      for (let n = 1; n < s.cells.length; n++)
        assert.equal(s.cells[n] - s.cells[n - 1], d);
      if (d === 1)
        assert.equal(
          Math.floor(s.cells[0] / 10),
          Math.floor(s.cells.at(-1) / 10),
        );
    }
  }
});
test("placement clips neither horizontal nor vertical ships at board edges", () => {
  assert.equal(cellsFor(8, 3, false), null);
  assert.equal(cellsFor(81, 3, true), null);
  assert.deepEqual(cellsFor(7, 3, false), [7, 8, 9]);
  assert.deepEqual(cellsFor(79, 3, true), [79, 89, 99]);
  assert.equal(cellsFor(-1, 2, false), null);
});
test("stale responses cannot regress game or chat state", () => {
  const current = {
    game: { id: "a", version: 8 },
    server_now: "2026-10-28T12:00:00.000Z",
    messages: [{ id: 1 }, { id: 2 }],
  };
  assert.equal(
    newerSnapshot(current, {
      ...current,
      game: { id: "a", version: 7 },
      messages: [{ id: 1 }],
    }),
    current,
  );
  assert.equal(
    newerSnapshot(current, {
      ...current,
      server_now: "2026-10-28T11:59:59.999Z",
    }),
    current,
  );
  const next = {
    ...current,
    game: { id: "a", version: 9 },
    messages: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };
  assert.equal(newerSnapshot(current, next), next);
});
test("only the current timed player clock ticks, and finished games stay frozen", () => {
  const g = {
    mode: "timed",
    status: "active",
    player1: "a",
    player2: "b",
    turn: "a",
    clock1_ms: 300000,
    clock2_ms: 250000,
    turn_started_at: "2026-10-28T12:00:00Z",
  };
  const t = Date.parse("2026-10-28T12:01:00Z");
  assert.equal(clockLeft(g, "a", t), 240000);
  assert.equal(clockLeft(g, "b", t), 250000);
  assert.equal(clockLeft({ ...g, status: "finished" }, "a", t), 300000);
  assert.equal(clockLeft({ ...g, mode: "untimed" }, "a", t), Infinity);
});
test("clock display never goes negative and coordinate labels cover all corners", () => {
  assert.equal(clockLabel(300000), "05:00");
  assert.equal(clockLabel(1), "00:01");
  assert.equal(clockLabel(-100), "00:00");
  assert.equal(clockLabel(Infinity), "Sin límite");
  assert.equal(coordinate(0), "A1");
  assert.equal(coordinate(9), "A10");
  assert.equal(coordinate(90), "J1");
  assert.equal(coordinate(99), "J10");
});
