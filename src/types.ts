export type Mode = "timed" | "untimed";
export type Phase = "waiting" | "placing" | "active" | "finished" | "cancelled";
export type FleetShip = { id: string; cells: number[] };
export type Game = {
  id: string;
  code: string;
  mode: Mode;
  is_public: boolean;
  status: Phase;
  player1: string;
  player2: string | null;
  ready1: boolean;
  ready2: boolean;
  turn: string | null;
  turn_no: number;
  clock1_ms: number;
  clock2_ms: number;
  turn_started_at: string | null;
  winner: string | null;
  finish_reason: "fleet" | "timeout" | "resign" | null;
  version: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};
export type Shot = {
  id: number;
  shooter: string;
  cell: number;
  result: "hit" | "miss" | "sunk";
  sunk_ship: string | null;
  turn_no: number;
  created_at: string;
};
export type Message = {
  id: number;
  sender: string;
  body: string;
  username: string;
  created_at: string;
};
export type Snapshot = {
  game: Game;
  me: string;
  player1_name: string;
  player2_name: string | null;
  own_fleet: FleetShip[];
  revealed_fleet: FleetShip[];
  shots: Shot[];
  messages: Message[];
  server_now: string;
};
export type MyGame = Game & {
  player1_name: string;
  player2_name: string | null;
};
export type OpenGame = {
  code: string;
  mode: Mode;
  created_at: string;
  username: string;
};
export type Connection = "connecting" | "live" | "offline" | "error";
