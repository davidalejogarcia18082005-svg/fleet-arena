import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
let db;
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  C = "33333333-3333-4333-8333-333333333333";
const fleet = [
  { id: "carrier", cells: [0, 1, 2, 3, 4] },
  { id: "battleship", cells: [10, 11, 12, 13] },
  { id: "cruiser", cells: [20, 21, 22] },
  { id: "submarine", cells: [30, 31, 32] },
  { id: "destroyer", cells: [40, 41] },
];
const clone = () => structuredClone(fleet);
async function as(user, sql, args = []) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    return tx.query(sql, args);
  });
}
async function call(user, name, args = []) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(",");
  const r = await as(
    user,
    `select public.${name}(${placeholders}) as data`,
    args.map((a) =>
      typeof a === "object" && a !== null ? JSON.stringify(a) : a,
    ),
  );
  return r.rows[0].data;
}
async function create(mode = "untimed", owner = A) {
  return call(owner, "create_game", [mode, false]);
}
async function setup(mode = "untimed") {
  const game = await create(mode);
  await call(B, "join_game", [game.game.code]);
  await call(A, "place_fleet", [game.game.id, fleet]);
  return call(B, "place_fleet", [game.game.id, fleet]);
}
async function shoot(snap, user, cell, id = randomUUID()) {
  return call(user, "fire_shot", [snap.game.id, cell, snap.game.turn_no, id]);
}
async function cleanup() {
  await db.exec("delete from public.games");
}
before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610280001_fleet_arena.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const [id, username] of [
    [A, "Ana"],
    [B, "Luis"],
    [C, "Intruso"],
  ])
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [id, JSON.stringify({ username })],
    );
});
after(async () => {
  await db.close();
});
test("authentication and server-owned state: anonymous RPC and direct writes are blocked", async () => {
  await assert.rejects(call(null, "create_game", ["untimed", false]), /sesión/);
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      await tx.query("select public.create_game($1,false)", ["untimed"]);
    }),
    /permission denied/,
  );
  await assert.rejects(
    as(
      A,
      "insert into public.games(code,mode,player1) values('FAKECODE','untimed',$1)",
      [A],
    ),
    /permission denied/,
  );
  await assert.rejects(
    as(A, "select * from private.fleets"),
    /permission denied/,
  );
});
test("host can ready before a guest arrives; only one guest is admitted", async () => {
  await cleanup();
  let s = await create();
  const id = s.game.id;
  s = await call(A, "place_fleet", [id, fleet]);
  assert.equal(s.game.ready1, true);
  assert.equal(s.game.ready2, false);
  assert.equal(s.game.status, "waiting");
  const own = await call(A, "join_game", [s.game.code]);
  assert.equal(own.game.player2, null);
  s = await call(B, "join_game", [s.game.code]);
  assert.equal(s.game.status, "placing");
  await assert.rejects(call(C, "join_game", [s.game.code]), /completa/);
  s = await call(B, "place_fleet", [id, fleet]);
  assert.equal(s.game.status, "active");
  assert.equal(s.game.turn_no, 1);
  assert.equal(s.game.clock1_ms, 300000);
});
test("fleet validation rejects overlap, shape, wrapping, length, coordinates and string numbers", async () => {
  await cleanup();
  const s = await create();
  const bad = [];
  let x = clone();
  x[1].cells = [0, 10, 20, 30];
  bad.push(x);
  x = clone();
  x[0].cells = [0, 11, 22, 33, 44];
  bad.push(x);
  x = clone();
  x[0].cells = [8, 9, 10, 11, 12];
  bad.push(x);
  x = clone();
  x[0].cells = [0, 1, 2, 3];
  bad.push(x);
  x = clone();
  x[4].cells = [99, 100];
  bad.push(x);
  x = clone();
  x[0].cells = ["0", "1", "2", "3", "4"];
  bad.push(x);
  x = clone();
  x[4].id = "cruiser";
  bad.push(x);
  x = clone();
  x[0].cells = [0, 0, 1, 2, 3];
  bad.push(x);
  for (const ships of bad)
    await assert.rejects(call(A, "place_fleet", [s.game.id, ships]));
  let accepted = await call(A, "place_fleet", [s.game.id, fleet]);
  assert.equal(accepted.own_fleet.length, 5);
  await assert.rejects(
    call(A, "place_fleet", [s.game.id, fleet]),
    /confirmada/,
  );
});
test("membership RLS hides games, shots, chat and fleet snapshots from outsiders", async () => {
  await cleanup();
  let s = await setup();
  const a = await call(A, "game_snapshot", [s.game.id]),
    b = await call(B, "game_snapshot", [s.game.id]);
  assert.equal(a.own_fleet.length, 5);
  assert.deepEqual(a.revealed_fleet, []);
  assert.deepEqual(b.revealed_fleet, []);
  await assert.rejects(call(C, "game_snapshot", [s.game.id]), /acceso/);
  await assert.rejects(
    call(C, "send_message", [s.game.id, "Espiando"]),
    /acceso/,
  );
  assert.equal(
    (await as(C, "select * from public.games where id=$1", [s.game.id])).rows
      .length,
    0,
  );
  await shoot(s, s.game.turn, 99);
  assert.equal(
    (await as(C, "select * from public.shots where game_id=$1", [s.game.id]))
      .rows.length,
    0,
  );
  const beforeMessage = await call(A, "game_snapshot", [s.game.id]);
  const afterMessage = await call(A, "send_message", [s.game.id, "Hola Luis"]);
  assert(afterMessage.game.version > beforeMessage.game.version);
  assert.equal(
    (await as(C, "select * from public.messages where game_id=$1", [s.game.id]))
      .rows.length,
    0,
  );
  assert.equal(
    (await call(B, "game_snapshot", [s.game.id])).messages[0].body,
    "Hola Luis",
  );
  await assert.rejects(
    call(A, "send_message", [s.game.id, "Muy rápido"]),
    /segundo/,
  );
});
test("turn ownership, idempotency, duplicate cells and stale turns are enforced", async () => {
  await cleanup();
  let s = await setup();
  const first = s.game.turn,
    second = first === A ? B : A;
  await assert.rejects(shoot(s, second, 99), /rival/);
  const id = randomUUID();
  const old = s;
  s = await shoot(s, first, 99, id);
  assert.equal(s.shots[0].result, "miss");
  assert.equal(s.game.turn, second);
  const retried = await call(first, "fire_shot", [
    s.game.id,
    99,
    old.game.turn_no,
    id,
  ]);
  assert.equal(retried.shots.length, 1);
  assert.equal(retried.game.turn_no, s.game.turn_no);
  s = await shoot(s, second, 98);
  await assert.rejects(shoot(s, first, 99), /Ya disparaste/);
  await assert.rejects(
    call(first, "fire_shot", [s.game.id, 97, old.game.turn_no, randomUUID()]),
    /turno cambió/,
  );
  await assert.rejects(
    as(first, "update public.games set winner=$1 where id=$2", [
      first,
      s.game.id,
    ]),
    /permission denied/,
  );
});
test("all seventeen hits produce sunk ships and exactly one durable winner", async () => {
  await cleanup();
  let s = await setup();
  const winner = s.game.turn,
    loser = winner === A ? B : A;
  const cells = fleet.flatMap((s) => s.cells);
  let misses = 99;
  for (let i = 0; i < cells.length; i++) {
    s = await shoot(s, winner, cells[i]);
    if (i === 4) assert.equal(s.shots.at(-1).result, "sunk");
    if (i < cells.length - 1) s = await shoot(s, loser, misses--);
  }
  assert.equal(s.game.status, "finished");
  assert.equal(s.game.winner, winner);
  assert.equal(s.game.finish_reason, "fleet");
  assert.equal(s.revealed_fleet.length, 5);
  assert.equal(s.shots.filter((x) => x.result === "sunk").length, 5);
  await assert.rejects(shoot(s, loser, 70), /no está activa/);
  const unchanged = await call(loser, "resign_game", [s.game.id]);
  assert.equal(unchanged.game.winner, winner);
});
test("timed mode charges only active player; elapsed server time cannot be overwritten by client", async () => {
  await cleanup();
  let s = await setup("timed");
  const actor = s.game.turn;
  await db.query(
    "update public.games set turn_started_at=clock_timestamp()-interval '3 seconds' where id=$1",
    [s.game.id],
  );
  s = await shoot(s, actor, 99);
  const a = actor === A ? s.game.clock1_ms : s.game.clock2_ms;
  const b = actor === A ? s.game.clock2_ms : s.game.clock1_ms;
  assert(a <= 297000 && a > 295000);
  assert.equal(b, 300000);
});
test("expired clock adjudication commits instead of throwing/rolling back; either member can trigger it", async () => {
  await cleanup();
  let s = await setup("timed");
  const expired = s.game.turn,
    opponent = expired === A ? B : A;
  await db.query(
    "update public.games set turn_started_at=clock_timestamp()-interval '301 seconds' where id=$1",
    [s.game.id],
  );
  s = await call(opponent, "game_snapshot", [s.game.id]);
  assert.equal(s.game.status, "finished");
  assert.equal(s.game.winner, opponent);
  assert.equal(s.game.finish_reason, "timeout");
  const stored = await call(expired, "game_snapshot", [s.game.id]);
  assert.equal(stored.game.winner, opponent);
  assert.equal(
    expired === A ? stored.game.clock1_ms : stored.game.clock2_ms,
    0,
  );
});
test("late shot cannot beat an already expired server clock", async () => {
  await cleanup();
  let s = await setup("timed");
  const expired = s.game.turn;
  await db.query(
    "update public.games set turn_started_at=clock_timestamp()-interval '301 seconds' where id=$1",
    [s.game.id],
  );
  s = await shoot(s, expired, 0);
  assert.equal(s.game.finish_reason, "timeout");
  assert.equal(s.shots.length, 0);
  assert.notEqual(s.game.winner, expired);
});
test("untimed mode survives a long absence and a resumed move", async () => {
  await cleanup();
  let s = await setup("untimed");
  await db.query(
    "update public.games set turn_started_at=clock_timestamp()-interval '365 days' where id=$1",
    [s.game.id],
  );
  s = await call(A, "game_snapshot", [s.game.id]);
  assert.equal(s.game.status, "active");
  assert.equal(s.game.clock1_ms, 300000);
  s = await shoot(s, s.game.turn, 99);
  assert.equal(s.game.status, "active");
  assert.equal(s.shots.length, 1);
});
test("public lobby excludes private rooms and returns no hidden board or player email", async () => {
  await cleanup();
  const pub = await call(A, "create_game", ["timed", true]);
  const priv = await call(A, "create_game", ["untimed", false]);
  const lobby = await call(B, "list_open_games");
  assert.equal(lobby.length, 1);
  assert.equal(lobby[0].code, pub.game.code);
  assert(!JSON.stringify(lobby).includes(priv.game.code));
  assert.deepEqual(Object.keys(lobby[0]).sort(), [
    "code",
    "created_at",
    "mode",
    "username",
  ]);
});
test("resignation awards opponent; cancelling preparation does not award a victory", async () => {
  await cleanup();
  let s = await setup();
  s = await call(A, "resign_game", [s.game.id]);
  assert.equal(s.game.winner, B);
  assert.equal(s.game.finish_reason, "resign");
  let fresh = await create();
  fresh = await call(A, "resign_game", [fresh.game.id]);
  assert.equal(fresh.game.status, "cancelled");
  assert.equal(fresh.game.winner, null);
});
test("resignation freezes elapsed time, and the game list settles expired clocks", async () => {
  await cleanup();
  let s = await setup("timed");
  const active = s.game.turn;
  await db.query(
    "update public.games set turn_started_at=clock_timestamp()-interval '10 seconds' where id=$1",
    [s.game.id],
  );
  s = await call(A, "resign_game", [s.game.id]);
  const remaining = active === A ? s.game.clock1_ms : s.game.clock2_ms;
  assert(remaining <= 290000 && remaining > 288000);
  let other = await setup("timed");
  await db.query(
    "update public.games set turn_started_at=clock_timestamp()-interval '301 seconds' where id=$1",
    [other.game.id],
  );
  const list = await call(B, "list_my_games");
  const expired = list.find((g) => g.id === other.game.id);
  assert.equal(expired.status, "finished");
  assert.equal(expired.finish_reason, "timeout");
});
