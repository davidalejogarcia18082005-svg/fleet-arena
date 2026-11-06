import type { FleetShip, Game, Snapshot } from "./types";
export const SHIPS = [
  { id: "carrier", name: "Portaaviones", size: 5 },
  { id: "battleship", name: "Acorazado", size: 4 },
  { id: "cruiser", name: "Crucero", size: 3 },
  { id: "submarine", name: "Submarino", size: 3 },
  { id: "destroyer", name: "Destructor", size: 2 },
];
export const coordinate = (cell: number) =>
  `${"ABCDEFGHIJ"[Math.floor(cell / 10)]}${(cell % 10) + 1}`;
export const shipName = (id: string | null) =>
  SHIPS.find((s) => s.id === id)?.name ?? "Barco";
export function cellsFor(
  start: number,
  size: number,
  vertical: boolean,
): number[] | null {
  if (
    start < 0 ||
    start > 99 ||
    (vertical ? Math.floor(start / 10) + size > 10 : (start % 10) + size > 10)
  )
    return null;
  return Array.from(
    { length: size },
    (_, i) => start + i * (vertical ? 10 : 1),
  );
}
export function randomFleet(): FleetShip[] {
  const fleet: FleetShip[] = [],
    occupied = new Set<number>();
  for (const ship of SHIPS) {
    for (let tries = 0; tries < 10000; tries++) {
      const cells = cellsFor(
        Math.floor(Math.random() * 100),
        ship.size,
        Math.random() > 0.5,
      );
      if (!cells || cells.some((c) => occupied.has(c))) continue;
      cells.forEach((c) => occupied.add(c));
      fleet.push({ id: ship.id, cells });
      break;
    }
  }
  if (fleet.length !== SHIPS.length) return randomFleet();
  return fleet;
}
export function clockLeft(game: Game, player: string | null, now: number) {
  const stored = player === game.player1 ? game.clock1_ms : game.clock2_ms;
  if (game.mode !== "timed") return Infinity;
  if (game.status !== "active" || game.turn !== player || !game.turn_started_at)
    return stored;
  return Math.max(
    0,
    stored - Math.max(0, now - Date.parse(game.turn_started_at)),
  );
}
export function clockLabel(ms: number) {
  if (!Number.isFinite(ms)) return "Sin límite";
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function newerSnapshot(previous: Snapshot | null, incoming: Snapshot) {
  if (!previous || previous.game.id !== incoming.game.id) return incoming;
  if (incoming.game.version < previous.game.version) return previous;
  if (
    incoming.game.version === previous.game.version &&
    Date.parse(incoming.server_now) < Date.parse(previous.server_now)
  )
    return previous;
  return incoming;
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
