import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  Crosshair,
  Flag,
  Infinity as InfinityIcon,
  LoaderCircle,
  Radio,
  RotateCw,
  Send,
  Shield,
  Shuffle,
  Timer,
  Trophy,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Board, FleetStatus, Modal } from "./components";
import {
  SHIPS,
  cellsFor,
  clockLabel,
  clockLeft,
  coordinate,
  randomFleet,
  shipName,
} from "./game";
import { rpc } from "./supabase";
import { useBattle } from "./useBattle";
import type { FleetShip, Snapshot } from "./types";
export function Placement({
  onReady,
  busy,
  locked,
  fleet,
}: {
  onReady: (ships: FleetShip[]) => void;
  busy: boolean;
  locked: boolean;
  fleet: FleetShip[];
}) {
  const [draft, setDraft] = useState<FleetShip[]>(() =>
    fleet.length ? fleet : randomFleet(),
  );
  const [selected, setSelected] = useState<string | null>(null),
    [vertical, setVertical] = useState(false),
    [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const current = SHIPS.find((s) => s.id === selected);
  const preview =
    current && hover !== null ? cellsFor(hover, current.size, vertical) : null;
  const invalid =
    !!current &&
    hover !== null &&
    (!preview ||
      preview.some((c) =>
        draft.some((s) => s.id !== selected && s.cells.includes(c)),
      ));
  const shown = locked ? fleet : draft;
  function choose(id: string) {
    if (locked || busy) return;
    setSelected(selected === id ? null : id);
    setNote(selected === id ? "Se conserva la posición del barco." : "Selecciona la casilla inicial en el tablero.");
  }
  function place(cell: number) {
    if (locked || busy) return;
    if (!current) {
      const old = draft.find((s) => s.cells.includes(cell));
      if (old) choose(old.id);
      else setNote("Primero selecciona un barco de la lista.");
      return;
    }
    const cells = cellsFor(cell, current.size, vertical);
    if (
      !cells ||
      cells.some((c) =>
        draft.some((s) => s.id !== selected && s.cells.includes(c)),
      )
    ) {
      setNote("Ese barco no cabe aquí. Cambia la posición o gíralo.");
      return;
    }
    setDraft((prev) => [
      ...prev.filter((s) => s.id !== selected),
      { id: current.id, cells },
    ]);
    setSelected(null);
    setNote("Posición actualizada.");
  }
  return (
    <div className="placement-layout">
      <div className="board-panel">
        <div className="board-caption">
          <span>
            <Shield size={15} /> TU OCÉANO
          </span>
          <span>Solo tú ves tu flota</span>
        </div>
        <Board
          label="Tu tablero de preparación"
          ships={shown.filter((s) => !selected || s.id !== selected)}
          onCell={locked || busy ? undefined : place}
          onHover={setHover}
          preview={preview ?? []}
          invalid={invalid}
        />
      </div>
      <div className="deployment-controls">
        <span className="eyebrow">DESPLIEGUE DE FLOTA</span>
        <h2>{locked ? "Todo listo, capitán." : "Cada posición cuenta."}</h2>
        <p>
          {locked
            ? "Tu flota está guardada. La batalla comenzará cuando ambos jugadores estén listos."
            : "Ya tienes una formación inicial. Puedes reorganizarla antes de confirmar."}
        </p>
        <div className="ship-picker">
          {SHIPS.map((s) => (
            <button
              key={s.id}
              className={`ship-option ${selected === s.id ? "active" : ""}`}
              disabled={locked || busy}
              onClick={() => choose(s.id)}
            >
              <span className="ship-segments">
                {Array.from({ length: s.size }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
              <span>{s.name}</span>
              <small>{s.size} casillas</small>
              {shown.some((p) => p.id === s.id) && <Check size={15} />}
            </button>
          ))}
        </div>
        {!locked && (
          <>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => {
                  setDraft(randomFleet());
                  setSelected(null);
                  setNote("Nueva formación preparada.");
                }}
                disabled={busy}
              >
                <Shuffle size={16} /> Aleatoria
              </button>
              <button
                className="button secondary"
                onClick={() => setVertical((v) => !v)}
                disabled={busy}
              >
                <RotateCw size={16} />
                {vertical ? "Vertical" : "Horizontal"}
              </button>
            </div>
            <p className="placement-note" aria-live="polite">
              {note || "Selecciona un barco para cambiar su posición."}
            </p>
            <button
              className="button primary full"
              disabled={busy || draft.length !== 5 || !!selected}
              onClick={() => onReady(draft)}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Check size={18} />
              )}{" "}
              Confirmar flota
            </button>
            <span className="fine-print">
              Una vez confirmada, la formación queda bloqueada.
            </span>
          </>
        )}
        {locked && (
          <div className="ready-banner">
            <Check size={20} /> Flota confirmada y guardada
          </div>
        )}
      </div>
    </div>
  );
}
export default function Room({
  initial,
  onBack,
  onError,
  onNotice,
}: {
  initial: Snapshot;
  onBack: () => void;
  onError: (e: unknown) => void;
  onNotice: (s: string) => void;
}) {
  const { snapshot, connection, accept, refresh } = useBattle(initial, onError);
  const { game, me } = snapshot;
  const [busy, setBusy] = useState(false),
    [chatBusy, setChatBusy] = useState(false),
    [target, setTarget] = useState<number | null>(null),
    [message, setMessage] = useState(""),
    [panel, setPanel] = useState<"log" | "chat">("log"),
    [confirmResign, setConfirmResign] = useState(false);
  const [tick, setTick] = useState(performance.now());
  const base = useRef({
    server: Date.parse(snapshot.server_now),
    mono: performance.now(),
  });
  const logEnd = useRef<HTMLDivElement>(null);
  const pendingShot = useRef<{ cell: number; turn: number; id: string } | null>(
    null,
  );
  useEffect(() => {
    base.current = {
      server: Date.parse(snapshot.server_now),
      mono: performance.now(),
    };
    setTick(performance.now());
  }, [snapshot.server_now]);
  useEffect(() => {
    const t = setInterval(() => setTick(performance.now()), 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setTarget(null);
    pendingShot.current = null;
  }, [game.turn_no]);
  const serverNow = base.current.server + tick - base.current.mono;
  useEffect(() => {
    if (game.status !== "active" || game.mode !== "timed") return;
    const left = clockLeft(game, game.turn, Date.parse(snapshot.server_now));
    const t = setTimeout(() => void refresh(true), Math.max(150, left + 150));
    return () => clearTimeout(t);
  }, [game.version, game.status, game.mode, snapshot.server_now, refresh]);
  useEffect(() => {
    const feed = logEnd.current?.parentElement;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [snapshot.shots.length, snapshot.messages.length, panel]);
  const p1 = me === game.player1,
    opponent = p1 ? game.player2 : game.player1;
  const myName = p1
    ? snapshot.player1_name
    : (snapshot.player2_name ?? "Capitán");
  const opponentName =
    (p1 ? snapshot.player2_name : snapshot.player1_name) ?? "Esperando rival";
  const myShots = snapshot.shots.filter((s) => s.shooter === me),
    theirShots = snapshot.shots.filter((s) => s.shooter !== me);
  const isMyTurn = game.turn === me,
    preparing = game.status === "waiting" || game.status === "placing",
    finished = game.status === "finished" || game.status === "cancelled";
  const won = game.winner === me;
  async function act(fn: string, args: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await rpc<Snapshot>(fn, { p_game_id: game.id, ...args });
      accept(next);
      return next;
    } catch (error) {
      onError(error);
      await refresh(true);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function fire() {
    if (target === null || busy) return;
    if (
      !pendingShot.current ||
      pendingShot.current.cell !== target ||
      pendingShot.current.turn !== game.turn_no
    )
      pendingShot.current = {
        cell: target,
        turn: game.turn_no,
        id: crypto.randomUUID(),
      };
    const next = await act("fire_shot", {
      p_cell: target,
      p_turn_no: game.turn_no,
      p_request_id: pendingShot.current.id,
    });
    if (next) setTarget(null);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || chatBusy) return;
    setChatBusy(true);
    try {
      accept(
        await rpc<Snapshot>("send_message", {
          p_game_id: game.id,
          p_body: message.trim(),
        }),
      );
      setMessage("");
    } catch (error) {
      onError(error);
    } finally {
      setChatBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}${location.pathname}?room=${game.code}`,
      );
      onNotice("Enlace de invitación copiado.");
    } catch {
      onNotice(`Comparte este código: ${game.code}`);
    }
  }
  return (
    <div className="room-page">
      <div className="room-top">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={17} /> Volver al puerto
        </button>
        <div className={`connection ${connection}`}>
          <i />
          {connection === "live"
            ? "Sincronización activa"
            : connection === "offline"
              ? "Sin conexión"
              : connection === "error"
                ? "Reconectando…"
                : "Conectando…"}
        </div>
      </div>
      <div className="room-title">
        <div>
          <span className="eyebrow">SALA DE BATALLA / {game.code}</span>
          <h1>
            {preparing
              ? "Prepara tu estrategia."
              : finished
                ? "Batalla finalizada."
                : "Cada disparo importa."}
          </h1>
        </div>
        <div className="room-actions">
          <span className="badge">
            {game.mode === "timed" ? (
              <Timer size={15} />
            ) : (
              <InfinityIcon size={15} />
            )}{" "}
            {game.mode === "timed"
              ? "Con reloj · 5 min"
              : "Por turnos · Sin reloj"}
          </span>
          <button className="button secondary compact" onClick={copy}>
            <Copy size={15} /> Invitar
          </button>
        </div>
      </div>
      <div className="duel-strip">
        <div
          className={`player-card ${isMyTurn && game.status === "active" ? "playing" : ""}`}
        >
          <div className="avatar mint">{myName.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>
              {myName} <span>TÚ</span>
            </strong>
            <small>
              {(p1 ? game.ready1 : game.ready2)
                ? "Flota desplegada"
                : "Preparando flota"}
            </small>
          </div>
          <span
            className={`player-clock ${clockLeft(game, me, serverNow) < 30000 ? "urgent" : ""}`}
          >
            {clockLabel(clockLeft(game, me, serverNow))}
          </span>
        </div>
        <span className="versus">VS</span>
        <div
          className={`player-card ${!isMyTurn && game.status === "active" ? "playing" : ""}`}
        >
          <div className="avatar coral">
            {opponent ? opponentName.slice(0, 2).toUpperCase() : "?"}
          </div>
          <div>
            <strong>{opponentName}</strong>
            <small>
              {opponent
                ? (p1 ? game.ready2 : game.ready1)
                  ? "Flota desplegada"
                  : "Preparando flota"
                : "Comparte el código de la sala"}
            </small>
          </div>
          <span
            className={`player-clock ${opponent && clockLeft(game, opponent, serverNow) < 30000 ? "urgent" : ""}`}
          >
            {opponent ? clockLabel(clockLeft(game, opponent, serverNow)) : "—"}
          </span>
        </div>
      </div>
      {connection !== "live" && (
        <div className="network-note">
          <WifiOff size={15} />{" "}
          {connection === "offline"
            ? "Estás sin conexión. Tus jugadas guardadas siguen a salvo."
            : "Estamos comprobando la sincronización. Puedes actualizar el estado."}
          <button onClick={() => void refresh()}>Actualizar</button>
        </div>
      )}
      {game.status === "waiting" && (
        <div className="invite-banner">
          <Radio size={20} />
          <div>
            <strong>Un océano. Dos capitanes.</strong>
            <span>
              Comparte el código <b>{game.code}</b> para que tu rival entre.
              Puedes preparar tu flota mientras esperas.
            </span>
          </div>
          <button className="button secondary compact" onClick={copy}>
            <Copy size={15} /> Copiar enlace
          </button>
        </div>
      )}
      {finished && (
        <div className={`result-banner ${won ? "victory" : ""}`}>
          <Trophy size={30} />
          <div>
            <h2>
              {game.status === "cancelled"
                ? "Sala cancelada"
                : won
                  ? "¡Victoria, capitán!"
                  : "Tu rival ganó esta batalla"}
            </h2>
            <p>
              {game.status === "cancelled"
                ? "Esta sala se cerró antes del combate."
                : game.finish_reason === "timeout"
                  ? "La partida terminó al agotarse el reloj."
                  : game.finish_reason === "resign"
                    ? "Uno de los jugadores se rindió."
                    : "Toda la flota rival fue hundida."}{" "}
              El resultado está guardado.
            </p>
          </div>
          <button className="button secondary" onClick={onBack}>
            Volver a jugar
          </button>
        </div>
      )}
      <div className="battle-layout">
        <section className="battle-main">
          {preparing ? (
            <Placement
              key={game.id}
              fleet={snapshot.own_fleet}
              locked={p1 ? game.ready1 : game.ready2}
              busy={busy}
              onReady={(fleet) => void act("place_fleet", { p_ships: fleet })}
            />
          ) : (
            <>
              {!finished && (
                <div className={`turn-banner ${isMyTurn ? "your-turn" : ""}`}>
                  <Crosshair size={19} />
                  <strong>
                    {isMyTurn
                      ? "Tu turno. Elige tu objetivo."
                      : "Tu rival está eligiendo su objetivo."}
                  </strong>
                  <span>TURNO {game.turn_no}</span>
                </div>
              )}
              <div className="combat-boards">
                <div className="board-panel">
                  <div className="board-caption">
                    <span>
                      <Crosshair size={15} /> OCÉANO RIVAL
                    </span>
                    <span>
                      {myShots.filter((s) => s.result !== "miss").length}/17
                      impactos
                    </span>
                  </div>
                  <Board
                    label="Océano rival: selecciona una casilla para disparar"
                    target
                    ships={snapshot.revealed_fleet}
                    shots={myShots}
                    selected={target}
                    onCell={
                      !finished && isMyTurn && !busy && connection === "live"
                        ? setTarget
                        : undefined
                    }
                  />
                  <FleetStatus
                    ships={snapshot.revealed_fleet}
                    shots={myShots}
                  />
                </div>
                <div className="board-panel">
                  <div className="board-caption">
                    <span>
                      <Shield size={15} /> TU OCÉANO
                    </span>
                    <span>
                      {17 -
                        theirShots.filter((s) => s.result !== "miss").length}
                      /17 casillas a salvo
                    </span>
                  </div>
                  <Board
                    label="Tu flota y los disparos recibidos"
                    ships={snapshot.own_fleet}
                    shots={theirShots}
                  />
                  <FleetStatus ships={snapshot.own_fleet} shots={theirShots} />
                </div>
              </div>
              {!finished && (
                <div className="fire-controls">
                  <p>
                    {target === null
                      ? "Selecciona una casilla del océano rival."
                      : `Objetivo seleccionado: ${coordinate(target)}. Confirma para disparar.`}
                  </p>
                  <button
                    className="button primary"
                    disabled={
                      target === null ||
                      busy ||
                      !isMyTurn ||
                      connection !== "live"
                    }
                    onClick={() => void fire()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Crosshair size={17} />
                    )}{" "}
                    {target === null
                      ? "Selecciona un objetivo"
                      : `Disparar a ${coordinate(target)}`}
                  </button>
                </div>
              )}
            </>
          )}
          <div className="room-bottom">
            <span>
              {game.mode === "timed"
                ? "El reloj sigue corriendo si te desconectas."
                : "Sin límite de tiempo. Puedes volver desde Mis partidas."}
            </span>
            {!finished && (
              <button
                className="text-button danger"
                onClick={() => setConfirmResign(true)}
              >
                <Flag size={14} />
                {preparing ? "Cancelar sala" : "Rendirme"}
              </button>
            )}
          </div>
        </section>
        <aside className="battle-aside">
          <div className="panel-tabs">
            <button
              className={panel === "log" ? "active" : ""}
              onClick={() => setPanel("log")}
            >
              Bitácora <span>{snapshot.shots.length}</span>
            </button>
            <button
              className={panel === "chat" ? "active" : ""}
              onClick={() => setPanel("chat")}
            >
              Chat <span>{snapshot.messages.length}</span>
            </button>
          </div>
          <div className="room-feed" aria-live="polite">
            {panel === "log" ? (
              <>
                <div className="system-entry">
                  <Radio size={16} />
                  <p>
                    Sala {game.code} creada.
                    <small>El servidor guarda cada jugada.</small>
                  </p>
                </div>
                {snapshot.shots.map((s) => (
                  <div className={`log-entry ${s.result}`} key={s.id}>
                    <span className="log-dot" />
                    <div>
                      <strong>
                        {s.shooter === me ? "Tú" : opponentName}{" "}
                        <span>→ {coordinate(s.cell)}</span>
                      </strong>
                      <p>
                        {s.result === "miss"
                          ? "Agua."
                          : s.result === "sunk"
                            ? `${shipName(s.sunk_ship)} hundido.`
                            : "Impacto confirmado."}
                      </p>
                    </div>
                    <small>#{s.turn_no}</small>
                  </div>
                ))}
                {snapshot.shots.length === 0 && (
                  <p className="feed-hint">
                    Los disparos, impactos y barcos hundidos aparecerán aquí.
                  </p>
                )}
              </>
            ) : (
              <>
                {snapshot.messages.length === 0 && (
                  <p className="feed-hint">
                    Saluda a tu rival. Los mensajes se guardan en esta sala.
                  </p>
                )}
                {snapshot.messages.map((m) => (
                  <div
                    className={`chat-message ${m.sender === me ? "mine" : ""}`}
                    key={m.id}
                  >
                    <div>
                      <strong>{m.sender === me ? "Tú" : m.username}</strong>
                      <time>
                        {new Date(m.created_at).toLocaleTimeString("es-EC", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p>{m.body}</p>
                  </div>
                ))}
              </>
            )}
            <div ref={logEnd} />
          </div>
          {panel === "chat" && (
            <form className="chat-form" onSubmit={send}>
              <input
                aria-label="Mensaje para tu rival"
                placeholder="Escribe un mensaje…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={300}
                disabled={chatBusy || connection === "offline"}
              />
              <button
                type="submit"
                className="icon-button"
                aria-label="Enviar mensaje"
                disabled={
                  !message.trim() || chatBusy || connection === "offline"
                }
              >
                {chatBusy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>
          )}
          <div className="aside-rule">
            <Shield size={15} />
            <p>Tu flota permanece oculta hasta que termina la partida.</p>
          </div>
        </aside>
      </div>
      {confirmResign && (
        <Modal
          title={
            preparing ? "¿Cancelar esta sala?" : "¿Rendirte en esta partida?"
          }
          onClose={() => setConfirmResign(false)}
        >
          <p className="modal-description">
            {preparing
              ? "La sala se cerrará para ambos jugadores. Podrás crear otra cuando quieras."
              : "Tu rival ganará y el resultado quedará guardado. Puedes volver al puerto sin rendirte si solo quieres salir de esta pantalla."}
          </p>
          <div className="button-row end">
            <button
              className="button secondary"
              onClick={() => setConfirmResign(false)}
            >
              Continuar aquí
            </button>
            <button
              className="button danger-fill"
              disabled={busy}
              onClick={() => {
                void act("resign_game");
                setConfirmResign(false);
              }}
            >
              {preparing ? "Cancelar sala" : "Confirmar rendición"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
