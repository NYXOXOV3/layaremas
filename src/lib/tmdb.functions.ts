import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MediaType = "movie" | "tv";
export interface MediaItem {
  id: number;
  media_type: MediaType;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity?: number;
  date: string | null;
}

export interface RecentEpisode {
  id: number;
  tv_id: number;
  tv_title: string;
  title: string;
  overview: string;
  still_path: string | null;
  season: number;
  episode: number;
  air_date: string | null;
  vote_average: number;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface PersonCredit extends MediaItem {
  character: string;
}

export interface PersonProfile {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string | null;
  credits: PersonCredit[];
}

/** Thrown when TMDB cannot be reached because the API key is not configured.
 *  Pages degrade to empty sections instead of crashing. */
export class TmdbUnavailableError extends Error {}
export function isTmdbUnavailable(e: unknown): boolean {
  return e instanceof TmdbUnavailableError;
}

let adminTmdbKeyRead: Promise<string | null> | undefined;

async function loadAdminTmdbApiKey(): Promise<string | null> {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceRoleKey) return null;
  if (!supabaseUrl) throw new Error("SUPABASE_URL is required to load the admin TMDB key");

  if (!adminTmdbKeyRead) {
    adminTmdbKeyRead = (async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("tmdb_api_settings")
        .select("api_key")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error("Could not load the admin TMDB API key");
      return data?.api_key ?? null;
    })();
  }

  const pending = adminTmdbKeyRead;
  try {
    return await pending;
  } finally {
    if (adminTmdbKeyRead === pending) adminTmdbKeyRead = undefined;
  }
}

export function invalidateTmdbApiKeyLookup() {
  adminTmdbKeyRead = undefined;
}

export async function resolveTmdbApiKey(
  environmentKey: string | undefined,
  readAdminKey: () => Promise<string | null> = loadAdminTmdbApiKey,
): Promise<string> {
  const envKey = environmentKey?.trim();
  if (envKey) return envKey;

  const adminKey = (await readAdminKey())?.trim();
  if (adminKey) return adminKey;

  throw new TmdbUnavailableError("TMDB key missing");
}

export async function tmdb(path: string, params: Record<string, string> = {}) {
  const key = await resolveTmdbApiKey(process.env["TMDB_API_KEY"]);
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  const headers: Record<string, string> = { accept: "application/json" };
  if (key.startsWith("eyJ")) headers["Authorization"] = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    console.error("TMDB error", res.status, path);
    // A rejected key (401/403) is a configuration state: degrade like a missing key.
    if (res.status === 401 || res.status === 403)
      throw new TmdbUnavailableError("TMDB key rejected");
    throw new Error("Could not load titles right now");
  }
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function norm(r: any, fallback?: MediaType): MediaItem | null {
  const media_type = (r.media_type ?? fallback) as MediaType;
  if (media_type !== "movie" && media_type !== "tv") return null;
  return {
    id: r.id,
    media_type,
    title: r.title ?? r.name ?? "Untitled",
    overview: r.overview ?? "",
    poster_path: r.poster_path ?? null,
    backdrop_path: r.backdrop_path ?? null,
    vote_average: r.vote_average ?? 0,
    popularity: r.popularity ?? 0,
    date: r.release_date ?? r.first_air_date ?? null,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const list = (results: any[], t?: MediaType) =>
  results.map((r) => norm(r, t)).filter(Boolean) as MediaItem[];

const recentEpisodeShowsSchema = z.array(
  z.object({
    id: z.number().int(),
    name: z.string().nullish(),
    last_episode_to_air: z
      .object({
        id: z.number().int(),
        name: z.string().nullish(),
        overview: z.string().nullish(),
        still_path: z.string().nullish(),
        season_number: z.number().int(),
        episode_number: z.number().int(),
        air_date: z.string().nullish(),
        vote_average: z.number().nullish(),
      })
      .nullish(),
  }),
);

function recentEpisodes(results: unknown[]): RecentEpisode[] {
  return recentEpisodeShowsSchema
    .parse(results)
    .flatMap((show) => {
      const episode = show.last_episode_to_air;
      if (!episode) return [];
      return [
        {
          id: episode.id,
          tv_id: show.id,
          tv_title: show.name ?? "Untitled",
          title: episode.name ?? "Untitled episode",
          overview: episode.overview ?? "",
          still_path: episode.still_path ?? null,
          season: episode.season_number,
          episode: episode.episode_number,
          air_date: episode.air_date ?? null,
          vote_average: episode.vote_average ?? 0,
        },
      ];
    })
    .sort((a, b) => (b.air_date ?? "").localeCompare(a.air_date ?? ""));
}

async function loadRecentEpisodes(ids: number[]): Promise<RecentEpisode[]> {
  const details = await Promise.all(ids.slice(0, 8).map((id) => tmdb(`/tv/${id}`)));
  return recentEpisodes(details);
}

export const getRecentEpisodes = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ ids: z.array(z.number().int().positive()).max(8) }).parse(d))
  .handler(async ({ data }): Promise<RecentEpisode[]> => {
    try {
      return await loadRecentEpisodes(data.ids);
    } catch (error) {
      if (!isTmdbUnavailable(error)) throw error;
      return [];
    }
  });

export const getHome = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [trending, movies, tv, top, indo, indoMovies, indoTv, recentMovies, recentSeries] =
      await Promise.all([
        tmdb("/trending/all/week"),
        tmdb("/movie/popular"),
        tmdb("/tv/popular"),
        tmdb("/movie/top_rated"),
        tmdb("/discover/movie", { with_original_language: "id", sort_by: "popularity.desc" }),
        tmdb("/discover/movie", { with_origin_country: "ID", sort_by: "popularity.desc" }),
        tmdb("/discover/tv", { with_origin_country: "ID", sort_by: "popularity.desc" }),
        tmdb("/movie/now_playing", { region: "ID" }),
        tmdb("/tv/on_the_air"),
      ]);
    const trendingIndonesia = [
      ...list(indoMovies.results, "movie"),
      ...list(indoTv.results, "tv"),
    ].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const recentSeriesItems = list(recentSeries.results ?? [], "tv");
    const persistedItems = [
      ...list(trending.results ?? []),
      ...list(movies.results ?? [], "movie"),
      ...list(tv.results ?? [], "tv"),
      ...list(top.results ?? [], "movie"),
      ...list(indo.results ?? [], "movie"),
      ...trendingIndonesia,
      ...list(recentMovies.results ?? [], "movie"),
      ...recentSeriesItems,
    ];
    const { persistTmdbCatalog } = await import("./catalog-store.server");
    await persistTmdbCatalog(persistedItems);
    return {
      trending: list(trending.results ?? []),
      movies: list(movies.results ?? [], "movie"),
      tv: list(tv.results ?? [], "tv"),
      top: list(top.results ?? [], "movie"),
      indo: list(indo.results ?? [], "movie"),
      trendingIndonesia,
      recentMovies: list(recentMovies.results ?? [], "movie"),
      recentSeries: recentSeriesItems,
    };
  } catch (e) {
    if (!isTmdbUnavailable(e)) throw e;
    console.error("TMDB home data unavailable", e instanceof Error ? e.message : "unknown error");
    return {
      trending: [] as MediaItem[],
      movies: [] as MediaItem[],
      tv: [] as MediaItem[],
      top: [] as MediaItem[],
      indo: [] as MediaItem[],
      trendingIndonesia: [] as MediaItem[],
      recentMovies: [] as MediaItem[],
      recentSeries: [] as MediaItem[],
    };
  }
});

export const searchMedia = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().max(120) }).parse(d))
  .handler(async ({ data }) => {
    if (!data.q.trim()) return [] as MediaItem[];
    try {
      const r = await tmdb("/search/multi", { query: data.q, include_adult: "false" });
      const items = list(r.results);
      const { persistTmdbCatalog } = await import("./catalog-store.server");
      await persistTmdbCatalog(items);
      return items;
    } catch (e) {
      if (!isTmdbUnavailable(e)) throw e;
      return [] as MediaItem[];
    }
  });

export const getDetails = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ type: z.enum(["movie", "tv"]), id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const { readCatalogDetails, persistTmdbCatalog } = await import("./catalog-store.server");
    const cached = await readCatalogDetails(data.type, data.id);
    const r =
      cached ??
      (await tmdb(`/${data.type}/${data.id}`, { append_to_response: "videos,credits,similar" }));
    const base = norm(r, data.type);
    if (!base) throw new Error("Title not found");
    if (!cached) await persistTmdbCatalog([base], { type: data.type, id: data.id, raw: r });
    const videos = z
      .array(
        z.object({
          site: z.string().nullish(),
          type: z.string().nullish(),
          key: z.string().nullish(),
        }),
      )
      .catch([])
      .parse(r.videos?.results ?? []);
    const trailer = videos.find((video) => video.site === "YouTube" && video.type === "Trailer");
    const studioSchema = z
      .array(
        z.object({
          id: z.number().int().nullish(),
          name: z.string(),
          logo_path: z.string().nullish(),
        }),
      )
      .catch([]);
    const studios = [
      ...studioSchema.parse(r.production_companies ?? []),
      ...(data.type === "tv" ? studioSchema.parse(r.networks ?? []) : []),
    ];
    return {
      ...base,
      tagline: (r.tagline as string) ?? "",
      runtime: (r.runtime ?? r.episode_run_time?.[0] ?? null) as number | null,
      genres: ((r.genres ?? []) as { name: string }[]).map((g) => g.name),
      studios: [
        ...new Map(
          studios.map((studio) => [
            studio.id ?? studio.name,
            {
              id: studio.id ?? null,
              name: studio.name,
              logo_path: studio.logo_path ?? null,
            },
          ]),
        ).values(),
      ],
      trailerKey: trailer?.key ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cast: ((r.credits?.cast ?? []) as any[]).slice(0, 10).map((c) => ({
        id: c.id as number,
        name: c.name as string,
        character: (c.character ?? "") as string,
        profile_path: (c.profile_path ?? null) as string | null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seasons: ((r.seasons ?? []) as any[])
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          number: s.season_number as number,
          name: s.name as string,
          episodes: s.episode_count as number,
        })),
      similar: list(r.similar?.results ?? [], data.type).slice(0, 12),
    };
  });

export type Details = Awaited<ReturnType<typeof getDetails>>;

export const getCastMembers = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        type: z.enum(["movie", "tv"]),
        id: z.number().int().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<CastMember[]> => {
    try {
      const response = await tmdb(`/${data.type}/${data.id}/credits`);
      return z
        .array(
          z.object({
            id: z.number().int(),
            name: z.string(),
            character: z.string().nullish(),
            profile_path: z.string().nullish(),
          }),
        )
        .parse(response.cast ?? [])
        .map((member) => ({
          id: member.id,
          name: member.name,
          character: member.character ?? "",
          profile_path: member.profile_path ?? null,
        }));
    } catch (error) {
      if (!isTmdbUnavailable(error)) throw error;
      return [];
    }
  });

export const getPersonProfile = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<PersonProfile | null> => {
    try {
      const response = await tmdb(`/person/${data.id}`, { append_to_response: "combined_credits" });
      const person = z
        .object({
          id: z.number().int(),
          name: z.string(),
          biography: z.string().nullish(),
          birthday: z.string().nullish(),
          place_of_birth: z.string().nullish(),
          profile_path: z.string().nullish(),
          known_for_department: z.string().nullish(),
          combined_credits: z
            .object({
              cast: z
                .array(
                  z.object({
                    id: z.number().int().positive(),
                    media_type: z.enum(["movie", "tv"]),
                    title: z.string().nullish(),
                    name: z.string().nullish(),
                    overview: z.string().nullish(),
                    poster_path: z.string().nullish(),
                    backdrop_path: z.string().nullish(),
                    vote_average: z.number().nullish(),
                    release_date: z.string().nullish(),
                    first_air_date: z.string().nullish(),
                    character: z.string().nullish(),
                  }),
                )
                .nullish(),
            })
            .nullish(),
        })
        .parse(response);
      const credits = (person.combined_credits?.cast ?? []).map((credit) => ({
        id: credit.id,
        media_type: credit.media_type,
        title: credit.title ?? credit.name ?? "Untitled",
        overview: credit.overview ?? "",
        poster_path: credit.poster_path ?? null,
        backdrop_path: credit.backdrop_path ?? null,
        vote_average: credit.vote_average ?? 0,
        date: credit.release_date ?? credit.first_air_date ?? null,
        character: credit.character ?? "",
      }));

      return {
        id: person.id,
        name: person.name,
        biography: person.biography ?? "",
        birthday: person.birthday ?? null,
        place_of_birth: person.place_of_birth ?? null,
        profile_path: person.profile_path ?? null,
        known_for_department: person.known_for_department ?? null,
        credits: [
          ...new Map(
            credits.map((credit) => [`${credit.media_type}:${credit.id}`, credit]),
          ).values(),
        ],
      };
    } catch (error) {
      if (!isTmdbUnavailable(error)) throw error;
      return null;
    }
  });

export interface SeasonEpisode {
  id: number;
  number: number;
  title: string;
  overview: string;
  still: string | null;
  runtime: number | null;
  airDate: string | null;
}

export const getSeasonEpisodes = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ id: z.number().int().positive(), season: z.number().int().nonnegative() }).parse(d),
  )
  .handler(async ({ data }): Promise<SeasonEpisode[]> => {
    let r: Awaited<ReturnType<typeof tmdb>>;
    try {
      r = await tmdb(`/tv/${data.id}/season/${data.season}`);
    } catch (e) {
      if (!isTmdbUnavailable(e)) throw e;
      return [];
    }
    const episodes = z
      .array(
        z.object({
          id: z.number(),
          episode_number: z.number().int(),
          name: z.string(),
          overview: z.string().nullish(),
          still_path: z.string().nullish(),
          runtime: z.number().nullish(),
          air_date: z.string().nullish(),
        }),
      )
      .parse(r.episodes ?? []);
    return episodes.map((episode) => ({
      id: episode.id,
      number: episode.episode_number,
      title: episode.name,
      overview: episode.overview ?? "",
      still: episode.still_path ?? null,
      runtime: episode.runtime ?? null,
      airDate: episode.air_date ?? null,
    }));
  });

async function getRecommendations(type: MediaType, id: number) {
  try {
    const r = await tmdb(`/${type}/${id}/recommendations`);
    const items = list(r.results ?? [], type).filter((item) => item.id !== id);
    const { persistTmdbCatalog } = await import("./catalog-store.server");
    await persistTmdbCatalog(items);
    return items;
  } catch (error) {
    if (!isTmdbUnavailable(error)) throw error;
    return [] as MediaItem[];
  }
}

export const getMovieRecommendations = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => getRecommendations("movie", data.id));

export const getMediaRecommendations = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        type: z.enum(["movie", "tv"]),
        id: z.number().int().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => getRecommendations(data.type, data.id));

// Lightweight preview for hover cards: details + trailer in one call.
export const getHoverPreview = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ type: z.enum(["movie", "tv"]), id: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const details = await getDetails({ data });
    return {
      overview: details.overview,
      tagline: details.tagline,
      genres: details.genres.slice(0, 3),
      runtime: details.runtime,
      vote: details.vote_average,
      year: (details.date ?? "").slice(0, 4),
      trailerKey: details.trailerKey,
      backdrop: details.backdrop_path,
    };
  });

export type HoverPreviewData = Awaited<ReturnType<typeof getHoverPreview>>;

/** Just the YouTube trailer key for a title; used by the hero carousel to
 *  autoplay trailers. Returns null when no trailer or TMDB is unavailable. */
export const getTrailerKey = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ type: z.enum(["movie", "tv"]), id: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }): Promise<string | null> => {
    try {
      const r = await tmdb(`/${data.type}/${data.id}/videos`, { language: "en-US" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = (r.results ?? []) as any[];
      const video =
        results.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
        results.find((v) => v.site === "YouTube" && v.type === "Teaser");
      return (video?.key as string) ?? null;
    } catch (e) {
      if (!isTmdbUnavailable(e)) throw e;
      return null;
    }
  });
