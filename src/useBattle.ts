import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, rpc } from "./supabase";
import { newerSnapshot } from "./game";
import type { Snapshot, Connection } from "./types";
export function useBattle(
  initial: Snapshot,
  onError: (error: unknown) => void,
) {
  const [snapshot, setSnapshot] = useState(initial);
  const [connection, setConnection] = useState<Connection>("connecting");
  const alive = useRef(true),
    subscribed = useRef(false),
    errorRef = useRef(onError),
    id = initial.game.id;
  errorRef.current = onError;
  const accept = useCallback(
    (next: Snapshot) => {
      if (alive.current && next.game.id === id)
        setSnapshot((prev) => newerSnapshot(prev, next));
    },
    [id],
  );
  const refresh = useCallback(
    async (quiet = false) => {
      try {
        const next = await rpc<Snapshot>("game_snapshot", { p_game_id: id });
        accept(next);
        if (alive.current && subscribed.current && navigator.onLine)
          setConnection("live");
        return next;
      } catch (error) {
        if (alive.current) {
          setConnection(navigator.onLine ? "error" : "offline");
          if (!quiet) errorRef.current(error);
        }
        return null;
      }
    },
    [id, accept],
  );
  useEffect(() => {
    alive.current = true;
    if (!supabase) return;
    const channel = supabase
      .channel(`game:${id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${id}`,
        },
        () => void refresh(true),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `game_id=eq.${id}`,
        },
        () => void refresh(true),
      )
      .subscribe((status) => {
        if (!alive.current) return;
        if (status === "SUBSCRIBED") {
          subscribed.current = true;
          setConnection("live");
          void refresh(true);
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          subscribed.current = false;
          setConnection(navigator.onLine ? "error" : "offline");
        }
      });
    const onOnline = () => {
      setConnection("connecting");
      void refresh(true);
    };
    const onOffline = () => setConnection("offline");
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    // Reconciliación de seguridad; las jugadas llegan principalmente por Realtime.
    const timer = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible")
        void refresh(true);
    }, 20000);
    void refresh(true);
    return () => {
      alive.current = false;
      subscribed.current = false;
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase?.removeChannel(channel);
    };
  }, [id, refresh]);
  return { snapshot, connection, accept, refresh };
}
