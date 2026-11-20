import { afterEach, describe, expect, it, vi } from "vitest";
import { persistTmdbCatalog } from "./catalog-store.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("TMDB catalog persistence", () => {
  it("skips persistence when service-role access is unavailable", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      persistTmdbCatalog([{
        id: 1,
        media_type: "movie",
        title: "Test",
        overview: "",
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        date: null,
      }]),
    ).resolves.toBe(false);
  });
});
