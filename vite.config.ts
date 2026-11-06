import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key) {
    let publicKey = key.startsWith("sb_publishable_") && key.length > 25;
    try {
      publicKey ||=
        JSON.parse(
          atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        ).role === "anon";
    } catch {
      /* not a legacy anon key */
    }
    if (!publicKey || key.startsWith("sb_secret_"))
      throw new Error(
        "VITE_SUPABASE_PUBLISHABLE_KEY debe ser publicable o anon. Se ha bloqueado la compilación para evitar exponer una clave privada.",
      );
  }
  return {
    plugins: [react()],
    server: { allowedHosts: true },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            supabase: ["@supabase/supabase-js"],
          },
        },
      },
    },
  };
});
