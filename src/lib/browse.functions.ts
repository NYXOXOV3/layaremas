import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { NETWORKS } from "@/lib/catalog";
import type { MediaItem, MediaType } from "@/lib/tmdb.functions";
import { isTmdbUnavailable, tmdb } from "@/lib/tmdb.functions";

interface TmdbResult {
  id: number;
  media_type?: MediaType;
  title?: string | null;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number | null;
  popularity?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
}

const norm = (r: TmdbResult, t: MediaType): MediaItem => ({
  id: r.id,
  media_type: t,
  title: r.title ?? r.name ?? "Untitled",
  overview: r.overview ?? "",
  poster_path: r.poster_path ?? null,
  backdrop_path: r.backdrop_path ?? null,
  vote_average: r.vote_average ?? 0,
  popularity: r.popularity ?? 0,
  date: r.release_date ?? r.first_air_date ?? null,
});

export const discover = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        type: z.enum(["movie", "tv"]),
        genre: z.string().optional(),
        year: z.number().int().optional(),
        country: z.string().max(3).optional(),
        company: z.number().int().positive().optional(),
        network: z.number().int().positive().optional(),
        sort: z.string().optional(),
        page: z.number().int().min(1).max(500).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const p: Record<string, string> = {
      sort_by: data.sort ?? "popularity.desc",
      page: String(data.page),
      include_adult: "false",
    };
    if (data.genre) p["with_genres"] = data.genre;
    if (data.year)
      p[data.type === "movie" ? "primary_release_year" : "first_air_date_year"] = String(data.year);
    if (data.country) p["with_origin_country"] = data.country;
    if (data.company) p["with_companies"] = String(data.company);
    if (data.network) p["with_networks"] = String(data.network);
    try {
      const r = await tmdb(`/discover/${data.type}`, p);
      const results = (r.results ?? []) as TmdbResult[];
      const normalized = results.map((item) => norm(item, data.type));
      const { persistTmdbCatalog } = await import("./catalog-store.server");
      await persistTmdbCatalog(normalized);
      return {
        results: normalized,
        totalPages: Math.min(r.total_pages ?? 1, 500),
      };
    } catch (e) {
      if (!isTmdbUnavailable(e)) throw e;
      return { results: [] as MediaItem[], totalPages: 0 };
    }
  });

export const getGenres = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ type: z.enum(["movie", "tv"]) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const r = await tmdb(`/genre/${data.type}/list`);
      return r.genres as { id: number; name: string }[];
    } catch (e) {
      if (!isTmdbUnavailable(e)) throw e;
      return [] as { id: number; name: string }[];
    }
  });

export const getCollection = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["collection", "company", "network"]),
        id: z.number().int().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      if (data.kind === "collection") {
        const r = await tmdb(`/collection/${data.id}`);
        const parts = ((r.parts ?? []) as TmdbResult[])
          .map((item) => norm(item, "movie"))
          .sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9"));
        const { persistTmdbCatalog } = await import("./catalog-store.server");
        await persistTmdbCatalog(parts);
        return {
          name: r.name as string,
          overview: (r.overview ?? "") as string,
          backdrop_path: r.backdrop_path as string | null,
          items: parts,
        };
      }
      if (data.kind === "network") {
        const companyId = NETWORKS.find((item) => item.id === data.id)?.companyId;
        const emptyPage = { results: [] as TmdbResult[] };
        const [network, tvPageOne, tvPageTwo, moviePageOne, moviePageTwo] = await Promise.all([
          tmdb(`/network/${data.id}`),
          tmdb("/discover/tv", { with_networks: String(data.id), sort_by: "popularity.desc" }),
          tmdb("/discover/tv", {
            with_networks: String(data.id),
            sort_by: "popularity.desc",
            page: "2",
          }),
          companyId
            ? tmdb("/discover/movie", {
                with_companies: String(companyId),
                sort_by: "popularity.desc",
              })
            : Promise.resolve(emptyPage),
          companyId
            ? tmdb("/discover/movie", {
                with_companies: String(companyId),
                sort_by: "popularity.desc",
                page: "2",
              })
            : Promise.resolve(emptyPage),
        ]);
        const tvResults = [
          ...((tvPageOne.results ?? []) as TmdbResult[]),
          ...((tvPageTwo.results ?? []) as TmdbResult[]),
        ];
        const movieResults = [
          ...((moviePageOne.results ?? []) as TmdbResult[]),
          ...((moviePageTwo.results ?? []) as TmdbResult[]),
        ];
        const items = [
          ...tvResults.map((item) => norm(item, "tv")),
          ...movieResults.map((item) => norm(item, "movie")),
        ].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        const { persistTmdbCatalog } = await import("./catalog-store.server");
        await persistTmdbCatalog(items);
        return {
          name: network.name as string,
          overview: "",
          backdrop_path: (tvPageOne.results?.[0]?.backdrop_path ??
            moviePageOne.results?.[0]?.backdrop_path ??
            null) as string | null,
          items,
        };
      }
      const [c, m1, m2, t1, t2] = await Promise.all([
        tmdb(`/company/${data.id}`),
        tmdb(`/discover/movie`, { with_companies: String(data.id), sort_by: "popularity.desc" }),
        tmdb(`/discover/movie`, {
          with_companies: String(data.id),
          sort_by: "popularity.desc",
          page: "2",
        }),
        tmdb(`/discover/tv`, { with_companies: String(data.id), sort_by: "popularity.desc" }),
        tmdb(`/discover/tv`, {
          with_companies: String(data.id),
          sort_by: "popularity.desc",
          page: "2",
        }),
      ]);
      const items = [
        ...[...m1.results, ...m2.results].map((x: Parameters<typeof norm>[0]) => norm(x, "movie")),
        ...[...t1.results, ...t2.results].map((x: Parameters<typeof norm>[0]) => norm(x, "tv")),
      ];
      const { persistTmdbCatalog } = await import("./catalog-store.server");
      await persistTmdbCatalog(items);
      return {
        name: c.name as string,
        overview: (c.description ?? "") as string,
        backdrop_path: (m1.results?.[0]?.backdrop_path ??
          t1.results?.[0]?.backdrop_path ??
          null) as string | null,
        items,
      };
    } catch (e) {
      if (!isTmdbUnavailable(e)) throw e;
      return {
        name: "",
        overview: "",
        backdrop_path: null as string | null,
        items: [] as MediaItem[],
      };
    }
  });
