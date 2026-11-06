import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Anchor,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Gamepad2,
  History,
  Infinity as InfinityIcon,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Settings,
  Shield,
  Swords,
  Timer,
  Trophy,
  UserRound,
  Waves,
  X,
} from "lucide-react";
import { EmptyState, FleetIcon, Modal, TacticalArt } from "./components";
import { dateLabel } from "./game";
import { config, friendlyError, rpc, saveConfig, supabase } from "./supabase";
import type { Mode, MyGame, OpenGame, Snapshot } from "./types";
import Room from "./Room";
type ModalKind = "auth" | "create" | "join" | "rules" | "setup" | null;
function AuthForm({
  onClose,
  onSetup,
  onError,
}: {
  onClose: () => void;
  onSetup: () => void;
  onError: (e: unknown) => void;
}) {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [username, setUsername] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setNote("");
    try {
      const { data, error } = register
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { username }, emailRedirectTo: location.origin },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) onClose();
      else
        setNote(
          "Cuenta creada. Confirma el correo para entrar. Si es una cuenta ficticia del laboratorio, el administrador debe confirmarla en Supabase.",
        );
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!supabase)
    return (
      <>
        <div className="setup-state">
          <div className="empty-icon">
            <Anchor size={28} />
          </div>
          <h3>El puerto está en preparación</h3>
          <p>
            Las cuentas y las partidas online estarán disponibles cuando el
            administrador complete la conexión.
          </p>
        </div>
        <button className="button secondary full" onClick={onSetup}>
          <Settings size={16} /> Configurar el proyecto
        </button>
        <p className="fine-print">
          Esta pantalla no crea usuarios ni simula partidas online.
        </p>
      </>
    );
  return (
    <>
      <div className="auth-tabs">
        <button
          className={!register ? "active" : ""}
          onClick={() => {
            setRegister(false);
            setNote("");
          }}
        >
          Iniciar sesión
        </button>
        <button
          className={register ? "active" : ""}
          onClick={() => {
            setRegister(true);
            setNote("");
          }}
        >
          Crear cuenta
        </button>
      </div>
      <p className="modal-description">
        {register
          ? "Elige tu nombre de capitán y prepara tu primera flota."
          : "Tu flota y tus partidas te están esperando."}
      </p>
      <form onSubmit={submit} className="form-stack">
        {register && (
          <label>
            Nombre de capitán
            <input
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_ -]{3,24}"
              title="Entre 3 y 24 letras, números, espacios, guiones o guion bajo"
              autoComplete="nickname"
              placeholder="CapitanDavid"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
        )}
        <label>
          Correo electrónico
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="ana@prueba.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            required
            minLength={8}
            autoComplete={register ? "new-password" : "current-password"}
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {note && (
          <p className="form-note" role="status">
            {note}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <ArrowRight size={18} />
          )}{" "}
          {register ? "Crear mi cuenta" : "Entrar al puerto"}
        </button>
      </form>
      <p className="fine-print">
        <LockKeyhole size={12} /> Tu contraseña se gestiona con Supabase Auth.
      </p>
    </>
  );
}
function SetupForm({ onError }: { onError: (e: unknown) => void }) {
  const [url, setUrl] = useState(config?.url ?? ""),
    [key, setKey] = useState("");
  return (
    <>
      <p className="modal-description">
        Configuración del administrador para probar este navegador. En la
        publicación definitiva, añade las mismas variables de entorno en Vercel.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            saveConfig({ url: url.trim(), key: key.trim() });
            location.href = location.pathname;
          } catch (e) {
            onError(e);
          }
        }}
      >
        <label>
          Project URL de Supabase
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tu-proyecto.supabase.co"
          />
        </label>
        <label>
          Clave publicable
          <input
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sb_publishable_…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="form-note">
          Primero ejecuta la migración incluida en{" "}
          <code>supabase/migrations</code>. Usa la clave publicable; las claves
          secretas se rechazan.
        </p>
        <button className="button primary full">
          Guardar conexión y abrir
        </button>
      </form>
      <p className="fine-print">
        Aquí solo se guarda la configuración pública. Las cuentas, flotas y
        partidas se guardan en Supabase.
      </p>
    </>
  );
}
function Rules() {
  return (
    <div className="rules">
      <p className="modal-description">
        Un océano de 10 × 10, cinco barcos y un rival. Gana quien hunda las 17
        casillas de la flota enemiga.
      </p>
      <div className="rule-item">
        <span>01</span>
        <div>
          <h3>Despliega tu flota</h3>
          <p>
            Coloca barcos de 5, 4, 3, 3 y 2 casillas. Deben ser rectos,
            horizontales o verticales y no pueden superponerse. Pueden tocarse.
            Al confirmar, las posiciones quedan bloqueadas.
          </p>
        </div>
      </div>
      <div className="rule-item">
        <span>02</span>
        <div>
          <h3>Un disparo por turno</h3>
          <p>
            El primer jugador se elige al azar. Selecciona una casilla del
            océano rival y confirma el disparo. Los turnos se alternan tanto al
            acertar como al fallar. El resultado lo verifica el servidor.
          </p>
        </div>
      </div>
      <div className="rule-item">
        <span>03</span>
        <div>
          <h3>Elige tu ritmo</h3>
          <p>
            <strong>Con reloj:</strong> cinco minutos totales por jugador. Solo
            corre el reloj de quien tiene el turno y empieza cuando ambos están
            listos. No hay incremento. Si se agota, pierdes, incluso si te
            desconectaste.
          </p>
          <p>
            <strong>Sin reloj:</strong> no hay límite entre jugadas. Puedes
            cerrar la aplicación y continuar después desde Mis partidas.
          </p>
        </div>
      </div>
      <div className="rule-item">
        <span>04</span>
        <div>
          <h3>Juega limpio</h3>
          <p>
            Las flotas rivales permanecen ocultas hasta el final. Una sala
            admite dos jugadores; comparte el código con tu rival o publica la
            sala en el puerto. Rendirse cuenta como derrota una vez iniciado el
            combate.
          </p>
        </div>
      </div>
      <div className="legend">
        <span>
          <i className="legend-ship" /> Tu barco
        </span>
        <span>
          <i className="legend-hit" /> Impacto
        </span>
        <span>
          <i className="legend-miss" /> Agua
        </span>
      </div>
    </div>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [sessionReady, setSessionReady] = useState(!supabase),
    [username, setUsername] = useState("");
  const [page, setPage] = useState<"lobby" | "matches">("lobby"),
    [modal, setModal] = useState<ModalKind>(() =>
      new URLSearchParams(location.search).has("setup") ? "setup" : null,
    );
  const [mode, setMode] = useState<Mode>("timed"),
    [isPublic, setIsPublic] = useState(false),
    [joinCode, setJoinCode] = useState(
      () => new URLSearchParams(location.search).get("room") ?? "",
    );
  const [battle, setBattle] = useState<Snapshot | null>(null),
    [myGames, setMyGames] = useState<MyGame[]>([]),
    [openGames, setOpenGames] = useState<OpenGame[]>([]),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const userRef = useRef<string | null>(null),
    inviteHandled = useRef(false);
  userRef.current = session?.user.id ?? null;
  const notice = useCallback(
    (message: string) => setToast({ message, error: false }),
    [],
  );
  const showError = useCallback(
    (e: unknown) => setToast({ message: friendlyError(e), error: true }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.error ? 9000 : 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (alive) {
        if (error) showError(error);
        setSession(data.session);
        setSessionReady(true);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) {
        setSession(next);
        setSessionReady(true);
        if (!next) {
          setBattle(null);
          setMyGames([]);
          setOpenGames([]);
        }
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [showError]);
  const refreshLobby = useCallback(
    async (quiet = false) => {
      const uid = session?.user.id;
      if (!uid) return;
      if (!quiet) setLoading(true);
      try {
        const [mine, open] = await Promise.all([
          rpc<MyGame[]>("list_my_games"),
          rpc<OpenGame[]>("list_open_games"),
        ]);
        if (userRef.current === uid) {
          setMyGames(mine);
          setOpenGames(open);
        }
      } catch (e) {
        if (!quiet) showError(e);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [session?.user.id, showError],
  );
  useEffect(() => {
    if (!session || !supabase) return;
    const uid = session.user.id;
    const alias = session.user.user_metadata?.username;
    setUsername(typeof alias === "string" ? alias : "Capitán");
    void supabase
      .from("profiles")
      .select("username")
      .eq("id", uid)
      .single()
      .then(({ data }) => {
        if (data && userRef.current === uid) setUsername(data.username);
      });
    void refreshLobby();
    if (joinCode && !inviteHandled.current) {
      inviteHandled.current = true;
      setModal("join");
    }
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshLobby(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [session?.user.id, refreshLobby]);
  function requireAccount(next: ModalKind) {
    setModal(session ? next : "auth");
  }
  function chooseMode(next: Mode) {
    setMode(next);
    requireAccount("create");
  }
  async function perform(fn: string, args: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await rpc<Snapshot>(fn, args);
      setBattle(next);
      setModal(null);
      window.scrollTo({ top: 0, behavior: "instant" });
      void refreshLobby(true);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) showError(error);
    else {
      setBattle(null);
      setPage("lobby");
      notice("Sesión cerrada. Tus partidas siguen guardadas.");
    }
  }
  const active = myGames.filter(
      (g) => g.status !== "finished" && g.status !== "cancelled",
    ),
    finished = myGames.filter((g) => g.status === "finished");
  const wins = finished.filter((g) => g.winner === session?.user.id).length;
  const goLobby = () => {
    setBattle(null);
    setPage("lobby");
    void refreshLobby(true);
  };
  const modeLabel = (m: Mode) => (m === "timed" ? "Con reloj" : "Sin reloj");
  const filtered = history
    ? myGames.filter((g) => g.status === "finished" || g.status === "cancelled")
    : active;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            goLobby();
          }}
          aria-label="Fleet Arena, inicio"
        >
          <div className="brand-mark">
            <FleetIcon size={29} />
          </div>
          <div>
            FLEET<span>ARENA</span>
          </div>
        </a>
        <div className="sidebar-label">CENTRO DE MANDO</div>
        <nav aria-label="Navegación principal">
          <button
            className={
              page === "lobby" && !battle ? "nav-item active" : "nav-item"
            }
            onClick={goLobby}
          >
            <Compass size={19} />
            <span>El puerto</span>
            <ChevronRight size={15} />
          </button>
          <button
            className={
              page === "matches" && !battle ? "nav-item active" : "nav-item"
            }
            onClick={() => {
              if (!session) {
                setModal("auth");
                return;
              }
              setBattle(null);
              setPage("matches");
              void refreshLobby();
            }}
          >
            <Swords size={19} />
            <span>Mis partidas</span>
            {active.length > 0 && <b>{active.length}</b>}
          </button>
          <button className="nav-item" onClick={() => setModal("rules")}>
            <CircleHelp size={19} />
            <span>Cómo jugar</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="tiny-radar">
              <Radio size={19} />
            </div>
            <strong>Piensa. Apunta. Hunde.</strong>
            <p>La estrategia empieza antes del primer disparo.</p>
          </div>
          <button
            className="nav-item settings-nav"
            onClick={() => setModal("setup")}
          >
            <Settings size={17} />
            <span>Configuración</span>
          </button>
          <div className="sidebar-version">
            <span>FLEET ARENA</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>JUGAR</span>
            <ChevronRight size={13} />
            <strong>
              {battle
                ? "Sala de batalla"
                : page === "matches"
                  ? "Mis partidas"
                  : "El puerto"}
            </strong>
          </div>
          <div className="account-area">
            <span className={`service-status ${config ? "configured" : ""}`}>
              <i />
              {!config
                ? "Online por configurar"
                : session
                  ? "Sesión iniciada"
                  : "Listo para conectar"}
            </span>
            {!session ? (
              <button
                className="button secondary compact"
                onClick={() => setModal("auth")}
                disabled={!sessionReady}
              >
                {!sessionReady ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <UserRound size={15} />
                )}{" "}
                Iniciar sesión
              </button>
            ) : (
              <>
                <div className="account-name">
                  <span className="avatar small mint">
                    {username.slice(0, 2).toUpperCase()}
                  </span>
                  <strong>{username}</strong>
                </div>
                <button
                  className="icon-button logout"
                  onClick={() => void logout()}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={17} />
                </button>
              </>
            )}
          </div>
        </header>
        <main>
          {battle ? (
            <Room
              key={battle.game.id}
              initial={battle}
              onBack={goLobby}
              onError={showError}
              onNotice={notice}
            />
          ) : page === "lobby" ? (
            <div className="lobby">
              <div className="welcome-row">
                <div>
                  <span className="eyebrow">
                    TU PRÓXIMA BATALLA EMPIEZA AQUÍ
                  </span>
                  <h1>
                    Bienvenido al puerto<span>.</span>
                  </h1>
                </div>
                <span className="naval-coordinate">
                  00° 00′ N<br />
                  ESTACIÓN FLEET
                </span>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-label">
                    <i /> BATALLA NAVAL · 1 VS 1
                  </span>
                  <h2>
                    Tu flota.
                    <br />
                    Tu estrategia.
                    <br />
                    <em>Tu victoria.</em>
                  </h2>
                  <p>
                    Un océano compartido. Un rival al otro lado.
                    <br className="desktop-break" /> Despliega tus barcos y haz
                    que cada disparo cuente.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button primary"
                      onClick={() => requireAccount("create")}
                    >
                      <Plus size={18} /> Crear una sala{" "}
                      <ArrowUpRight size={17} />
                    </button>
                    <button
                      className="hero-help"
                      onClick={() => setModal("rules")}
                    >
                      Aprender a jugar <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="hero-specs">
                    <span>
                      <Shield size={14} /> 5 barcos por flota
                    </span>
                    <span>
                      <Waves size={14} /> Océano de 10 × 10
                    </span>
                  </div>
                </div>
                <TacticalArt />
              </section>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">DOS FORMAS DE ENFRENTARTE</span>
                  <h2>Elige el ritmo de tu batalla</h2>
                </div>
                <span className="section-aside">
                  Misma estrategia. Distinta presión.
                </span>
              </div>
              <div className="mode-grid">
                <button
                  className="mode-card timed"
                  onClick={() => chooseMode("timed")}
                >
                  <div className="mode-top">
                    <span className="mode-icon">
                      <Timer size={25} />
                    </span>
                    <span className="mode-tag">5 MIN / JUGADOR</span>
                    <ArrowUpRight size={22} />
                  </div>
                  <h3>Contra el reloj</h3>
                  <p>
                    Cinco minutos para pensar, apuntar y vencer.
                    <br />
                    {" "}
                    La presión también juega.
                  </p>
                  <div className="mode-footer">
                    <span>
                      <i /> ONLINE · POR TURNOS
                    </span>
                    <b>
                      Crear sala <ArrowRight size={16} />
                    </b>
                  </div>
                </button>
                <button
                  className="mode-card untimed"
                  onClick={() => chooseMode("untimed")}
                >
                  <div className="mode-top">
                    <span className="mode-icon">
                      <InfinityIcon size={27} />
                    </span>
                    <span className="mode-tag">SIN LÍMITE DE TIEMPO</span>
                    <ArrowUpRight size={22} />
                  </div>
                  <h3>A tu ritmo</h3>
                  <p>
                    Piensa tu siguiente movimiento con calma.
                    <br />
                    {" "}
                    Sal y vuelve cuando quieras.
                  </p>
                  <div className="mode-footer">
                    <span>
                      <i /> ONLINE · POR TURNOS
                    </span>
                    <b>
                      Crear sala <ArrowRight size={16} />
                    </b>
                  </div>
                </button>
              </div>
              <section className="join-strip">
                <div className="join-icon">
                  <KeyRound size={23} />
                </div>
                <div>
                  <h3>¿Tu rival ya creó una sala?</h3>
                  <p>Entra con su código de invitación y prepara tu flota.</p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!session) {
                      setModal("auth");
                      return;
                    }
                    if (joinCode.trim().length === 8)
                      void perform("join_game", { p_code: joinCode });
                    else setModal("join");
                  }}
                >
                  <input
                    aria-label="Código de la sala"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 8),
                      )
                    }
                    placeholder="CÓDIGO DE SALA"
                    maxLength={8}
                  />
                  <button className="button secondary" disabled={busy}>
                    Unirme <ArrowRight size={16} />
                  </button>
                </form>
              </section>
              <div className="lobby-bottom">
                <section className="open-rooms">
                  <div className="section-heading small">
                    <h2>
                      Salas abiertas{" "}
                      <span>{session ? openGames.length : "—"}</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() =>
                        session ? void refreshLobby() : setModal("auth")
                      }
                      disabled={loading}
                    >
                      <RefreshCw size={14} className={loading ? "spin" : ""} />{" "}
                      Actualizar
                    </button>
                  </div>
                  {!session ? (
                    <EmptyState title="Encuentra a tu próximo rival">
                      Inicia sesión para ver las salas disponibles o crear la
                      tuya.
                    </EmptyState>
                  ) : loading && openGames.length === 0 ? (
                    <div className="loading-state">
                      <LoaderCircle className="spin" size={23} /> Buscando
                      salas…
                    </div>
                  ) : openGames.length === 0 ? (
                    <EmptyState title="El océano está tranquilo">
                      Todavía no hay salas públicas. Crea una y permite que
                      otros jugadores se unan.
                    </EmptyState>
                  ) : (
                    <div className="room-list">
                      {openGames.map((r) => (
                        <div className="open-room-row" key={r.code}>
                          <span className="avatar small">
                            {r.username.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong>{r.username}</strong>
                            <small>
                              {modeLabel(r.mode)} · {r.code}
                            </small>
                          </div>
                          <button
                            className="button secondary compact"
                            disabled={busy}
                            onClick={() =>
                              void perform("join_game", { p_code: r.code })
                            }
                          >
                            Unirme <ArrowRight size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="captain-card">
                  <div className="captain-top">
                    <Trophy size={22} />
                    <span>{session ? "TU BITÁCORA" : "LA MISIÓN"}</span>
                  </div>
                  <h3>
                    {session
                      ? "Cada batalla cuenta."
                      : "La mejor arma es tu estrategia."}
                  </h3>
                  <p>
                    {session
                      ? "Tu resumen de las últimas 100 partidas."
                      : "Protege tus posiciones. Lee los movimientos del rival. Hunde su flota antes de que encuentre la tuya."}
                  </p>
                  {session ? (
                    <div className="mini-stats">
                      <div>
                        <b>{finished.length}</b>
                        <span>Jugadas</span>
                      </div>
                      <div>
                        <b>{wins}</b>
                        <span>Victorias</span>
                      </div>
                      <div>
                        <b>{active.length}</b>
                        <span>En curso</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => setModal("rules")}
                    >
                      Conoce las reglas <ArrowRight size={16} />
                    </button>
                  )}
                </section>
              </div>
              <footer className="page-footer">
                <span>
                  <FleetIcon size={16} /> FLEET ARENA
                </span>
                <p>Dos capitanes. Un solo océano.</p>
                <button onClick={() => setModal("rules")}>
                  Reglas del juego <ArrowUpRight size={13} />
                </button>
              </footer>
            </div>
          ) : (
            <div className="matches-page">
              <span className="eyebrow">TU HISTORIAL DE NAVEGACIÓN</span>
              <div className="matches-heading">
                <h1>
                  Mis partidas<span>.</span>
                </h1>
                <button
                  className="button primary"
                  onClick={() => requireAccount("create")}
                >
                  <Plus size={17} /> Nueva sala
                </button>
              </div>
              <div className="matches-tabs">
                <button
                  className={!history ? "active" : ""}
                  onClick={() => setHistory(false)}
                >
                  En curso <span>{active.length}</span>
                </button>
                <button
                  className={history ? "active" : ""}
                  onClick={() => setHistory(true)}
                >
                  Finalizadas <span>{myGames.length - active.length}</span>
                </button>
                <button
                  className="text-button"
                  onClick={() => void refreshLobby()}
                >
                  <RefreshCw size={15} className={loading ? "spin" : ""} />{" "}
                  Actualizar
                </button>
              </div>
              {filtered.length === 0 ? (
                <EmptyState
                  title={
                    history
                      ? "Tu historia está por comenzar"
                      : "No tienes partidas pendientes"
                  }
                >
                  {history
                    ? "Aquí quedarán los resultados de tus batallas."
                    : "Crea una sala o entra con el código de un amigo."}
                </EmptyState>
              ) : (
                <div className="matches-grid">
                  {filtered.map((g) => {
                    const mine = g.player1 === session?.user.id;
                    return (
                      <button
                        key={g.id}
                        className="match-card"
                        disabled={busy}
                        onClick={() =>
                          void perform("game_snapshot", { p_game_id: g.id })
                        }
                      >
                        <div className="match-card-top">
                          <span className="badge">
                            {g.mode === "timed" ? (
                              <Timer size={14} />
                            ) : (
                              <InfinityIcon size={14} />
                            )}{" "}
                            {modeLabel(g.mode)}
                          </span>
                          <span className={`match-status ${g.status}`}>
                            {g.status === "finished"
                              ? g.winner === session?.user.id
                                ? "Victoria"
                                : "Derrota"
                              : g.status === "cancelled"
                                ? "Cancelada"
                                : g.status === "waiting"
                                  ? "Esperando rival"
                                  : g.status === "placing"
                                    ? "Preparación"
                                    : g.turn === session?.user.id
                                      ? "Tu turno"
                                      : "Turno del rival"}
                          </span>
                        </div>
                        <h3>
                          {(mine ? g.player2_name : g.player1_name)
                            ? `vs. ${mine ? g.player2_name : g.player1_name}`
                            : "Sala por completar"}
                        </h3>
                        <p>
                          {dateLabel(g.updated_at)} · {g.code}
                        </p>
                        <div className="match-card-bottom">
                          <span>
                            {g.status === "finished" || g.status === "cancelled"
                              ? "Ver resultado"
                              : "Continuar partida"}
                          </span>
                          <ArrowUpRight size={19} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="fine-print">
                Se muestran las últimas 100 salas. En las partidas con reloj, el
                tiempo continúa al salir.
              </p>
            </div>
          )}
        </main>
      </div>
      {modal && (
        <Modal
          title={
            modal === "auth"
              ? "Tu lugar en la flota"
              : modal === "create"
                ? "Prepara una nueva batalla"
                : modal === "join"
                  ? "Unirte a una sala"
                  : modal === "rules"
                    ? "El manual del capitán"
                    : "Conectar Fleet Arena"
          }
          onClose={() => setModal(null)}
          wide={modal === "rules"}
        >
          {modal === "auth" ? (
            <AuthForm
              onClose={() => setModal(null)}
              onSetup={() => setModal("setup")}
              onError={showError}
            />
          ) : modal === "setup" ? (
            <SetupForm onError={showError} />
          ) : modal === "rules" ? (
            <Rules />
          ) : modal === "create" ? (
            <>
              <p className="modal-description">
                Invita a un rival y despliega tu estrategia. Ambos modos son
                online y guardan cada jugada.
              </p>
              <div className="mode-picker">
                <button
                  className={mode === "timed" ? "picked" : ""}
                  onClick={() => setMode("timed")}
                >
                  <Timer size={24} />
                  <strong>Con reloj</strong>
                  <span>5 minutos por jugador</span>
                </button>
                <button
                  className={mode === "untimed" ? "picked" : ""}
                  onClick={() => setMode("untimed")}
                >
                  <InfinityIcon size={25} />
                  <strong>Sin reloj</strong>
                  <span>Continúa cuando quieras</span>
                </button>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>
                  <strong>Mostrar en salas abiertas</strong>
                  <small>
                    {isPublic
                      ? "Cualquier jugador registrado podrá ocupar el segundo lugar."
                      : "Solo podrán entrar quienes tengan el código de invitación."}
                  </small>
                </span>
              </label>
              <button
                className="button primary full"
                disabled={busy}
                onClick={() =>
                  void perform("create_game", {
                    p_mode: mode,
                    p_public: isPublic,
                  })
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Plus size={18} />
                )}{" "}
                Crear sala
              </button>
              <p className="fine-print">
                El reloj empieza cuando ambos confirman sus flotas.
              </p>
            </>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void perform("join_game", { p_code: joinCode });
              }}
            >
              <p className="modal-description">
                Pide a tu rival el código de ocho caracteres que aparece en su
                sala.
              </p>
              <label>
                Código de invitación
                <input
                  className="code-input"
                  autoFocus
                  required
                  minLength={8}
                  maxLength={8}
                  pattern="[A-Za-z0-9]{8}"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                    )
                  }
                  placeholder="A1B2C3D4"
                />
              </label>
              <button className="button primary full" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}{" "}
                Entrar a la sala
              </button>
            </form>
          )}
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={20} /> : <Check size={20} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            onClick={() => setToast(null)}
            aria-label="Cerrar aviso"
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
