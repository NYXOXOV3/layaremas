// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Vite only injects VITE_* values; copy this allowlist for server-side process.env reads.
  for (const key of [
    "TMDB_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const) {
    if (process.env[key] === undefined && env[key] !== undefined) {
      process.env[key] = env[key];
    }
  }

  return {
    tanstackStart: {
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    },
    // Deploying to Vercel from our own repository: pin Nitro's Vercel preset so the
    // server output matches Vercel's runtime. Inside Lovable builds LOVABLE_NITRO_PRESET
    // still wins, so the Lovable preview/publish target is unaffected.
    ...(process.env["VERCEL"] || process.env["NITRO_PRESET"] === "vercel"
      ? { nitro: { preset: "vercel" as const } }
      : {}),
  };
});
