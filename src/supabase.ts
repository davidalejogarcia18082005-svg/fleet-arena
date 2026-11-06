import { createClient } from "@supabase/supabase-js";
const CONFIG_KEY = "fleet-arena.public-connection";
export type PublicConfig = { url: string; key: string };
export function validConfig(config: PublicConfig): boolean {
  try {
    const url = new URL(config.url);
    if (
      url.protocol !== "https:" ||
      !config.key ||
      config.key.startsWith("sb_secret_") ||
      /REEMPLAZAR|TU_PROYECTO/.test(config.url + config.key)
    )
      return false;
    if (config.key.startsWith("sb_publishable_")) return config.key.length > 25;
    const jwt = JSON.parse(
      atob(config.key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return jwt.role === "anon";
  } catch {
    return false;
  }
}
export function readConfig(): PublicConfig | null {
  const env = {
    url: import.meta.env.VITE_SUPABASE_URL ?? "",
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
  if (validConfig(env)) return env;
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "null");
    return saved && validConfig(saved) ? saved : null;
  } catch {
    return null;
  }
}
export function saveConfig(config: PublicConfig) {
  if (!validConfig(config))
    throw new Error(
      "Usa una URL HTTPS y la clave publicable (sb_publishable_… o anon). Las claves secretas no se aceptan.",
    );
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
export const config = readConfig();
export const supabase = config
  ? createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export async function rpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!supabase) throw new Error("La conexión online aún no está configurada.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.code === "PGRST202" || error.code === "42P01")
      throw new Error(
        "Falta instalar el esquema de Fleet Arena en Supabase. Consulta la guía de configuración.",
      );
    throw new Error(error.message);
  }
  return data as T;
}
export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Invalid login credentials/.test(message))
    return "El correo o la contraseña no son correctos.";
  if (/Email not confirmed/.test(message))
    return "Esta cuenta necesita confirmar su correo. Para las cuentas ficticias, activa la confirmación desde Supabase.";
  if (/Failed to fetch|NetworkError|fetch failed/.test(message))
    return "No se pudo conectar. Revisa tu conexión y vuelve a intentarlo.";
  if (/User already registered/.test(message))
    return "Este correo ya tiene una cuenta. Inicia sesión.";
  if (/rate limit/.test(message))
    return "Demasiados intentos. Espera un momento antes de volver a intentar.";
  return message;
}
