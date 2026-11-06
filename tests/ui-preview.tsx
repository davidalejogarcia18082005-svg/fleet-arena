// Solo para revisión visual local; no se incluye en dist ni sustituye una prueba online.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Room, { Placement } from "../src/Room";
import { randomFleet } from "../src/game";
import type { Snapshot, FleetShip } from "../src/types";
import "../src/styles.css";
const params = new URLSearchParams(location.search),
  inner = params.get("inner");
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const now = new Date().toISOString();
const sample: Snapshot = {
  game: {
    id: "44444444-4444-4444-8444-444444444444",
    code: "TEST1234",
    mode: "timed",
    is_public: false,
    status: "active",
    player1: A,
    player2: B,
    ready1: true,
    ready2: true,
    turn: A,
    turn_no: 5,
    clock1_ms: 270000,
    clock2_ms: 285000,
    turn_started_at: now,
    winner: null,
    finish_reason: null,
    version: 5,
    created_at: now,
    updated_at: now,
    finished_at: null,
  },
  me: A,
  player1_name: "Ana",
  player2_name: "Luis",
  own_fleet: randomFleet(),
  revealed_fleet: [],
  shots: [
    {
      id: 1,
      shooter: A,
      cell: 24,
      result: "hit",
      sunk_ship: null,
      turn_no: 1,
      created_at: now,
    },
    {
      id: 2,
      shooter: B,
      cell: 33,
      result: "miss",
      sunk_ship: null,
      turn_no: 2,
      created_at: now,
    },
    {
      id: 3,
      shooter: A,
      cell: 34,
      result: "hit",
      sunk_ship: null,
      turn_no: 3,
      created_at: now,
    },
    {
      id: 4,
      shooter: B,
      cell: 58,
      result: "miss",
      sunk_ship: null,
      turn_no: 4,
      created_at: now,
    },
  ],
  messages: [
    {
      id: 1,
      sender: A,
      username: "Ana",
      body: "¡Buena suerte!",
      created_at: now,
    },
  ],
  server_now: now,
};
function PlacementStory() {
  const [fleet, setFleet] = useState<FleetShip[]>([]);
  return (
    <div className="room-page" style={{ maxWidth: 1000 }}>
      <p style={{ color: "#eaa878", marginBottom: 20, fontSize: 12 }}>
        PRUEBA VISUAL LOCAL · Sin cuenta ni conexión online.
      </p>
      <Placement
        busy={false}
        locked={fleet.length > 0}
        fleet={fleet}
        onReady={setFleet}
      />
    </div>
  );
}
function Harness() {
  const [view, setView] = useState("mobile-lobby");
  const specs: { [k: string]: { url: string; width: string; height: number } } =
    {
      "mobile-lobby": { url: "/", width: "390px", height: 844 },
      "desktop-placing": {
        url: "?inner=placement",
        width: "100%",
        height: 900,
      },
      "mobile-placing": {
        url: "?inner=placement",
        width: "390px",
        height: 844,
      },
      "desktop-battle": { url: "?inner=battle", width: "100%", height: 1100 },
      "mobile-battle": { url: "?inner=battle", width: "390px", height: 844 },
    };
  const s = specs[view];
  return (
    <div>
      <div
        style={{
          padding: 14,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          background: "#21342c",
        }}
      >
        {Object.keys(specs).map((v) => (
          <button
            className="button secondary compact"
            key={v}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
        <span style={{ fontSize: 11, padding: 10, color: "#edb493" }}>
          Pruebas locales; datos ficticios.
        </span>
      </div>
      <iframe
        key={view}
        title="Vista de prueba"
        src={s.url.startsWith("?") ? "/tests/ui-preview.html" + s.url : s.url}
        style={{
          display: "block",
          margin: "20px auto",
          width: s.width,
          height: s.height,
          border: "1px solid #4a685a",
        }}
      />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  inner === "placement" ? (
    <PlacementStory />
  ) : inner === "battle" ? (
    <>
      <div
        style={{
          padding: "12px 25px",
          background: "#463d2d",
          color: "#edc59d",
          fontSize: 12,
        }}
      >
        PRUEBA VISUAL LOCAL · Estado ilustrativo, sin Supabase.
      </div>
      <Room
        initial={sample}
        onBack={() => (location.href = "/tests/ui-preview.html")}
        onError={console.error}
        onNotice={console.log}
      />
    </>
  ) : (
    <Harness />
  ),
);
