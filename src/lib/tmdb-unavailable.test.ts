import { afterEach, describe, expect, it, vi } from "vitest";
import { TmdbUnavailableError, isTmdbUnavailable, resolveTmdbApiKey, tmdb } from "./tmdb.functions";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TMDB unavailable degradation", () => {
  it("tmdb() signals a typed unavailable error when the API key is not configured", async () => {
    vi.stubEnv("TMDB_API_KEY", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(tmdb("/movie/popular")).rejects.toThrow(TmdbUnavailableError);
    await expect(tmdb("/movie/popular")).rejects.toThrow("TMDB key missing");
  });

  it("uses the environment key before the admin-stored key", async () => {
    const readAdminKey = vi.fn(async () => "admin-key");
    await expect(resolveTmdbApiKey(" env-key ", readAdminKey)).resolves.toBe("env-key");
    expect(readAdminKey).not.toHaveBeenCalled();
  });

  it("uses the admin-stored key when the environment key is empty", async () => {
    await expect(resolveTmdbApiKey("", async () => " admin-key ")).resolves.toBe("admin-key");
  });

  it("signals unavailable when neither key source is configured", async () => {
    await expect(resolveTmdbApiKey("", async () => null)).rejects.toThrow(TmdbUnavailableError);
  });

  it("pages can detect exactly the unavailable state, not other failures", () => {
    expect(isTmdbUnavailable(new TmdbUnavailableError("TMDB key missing"))).toBe(true);
    expect(isTmdbUnavailable(new Error("Could not load titles right now"))).toBe(false);
    expect(isTmdbUnavailable(null)).toBe(false);
  });

  it("treats a rejected TMDB key (401) as unavailable so pages render empty", async () => {
    vi.stubEnv("TMDB_API_KEY", "bad-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(tmdb("/movie/popular")).rejects.toThrow(TmdbUnavailableError);
  });
});
