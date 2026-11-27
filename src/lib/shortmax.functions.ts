import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const APISHORT_HOST = "https://apishort.com";
const DEFAULT_KEY_HEADER = "Authorization";
const DEFAULT_KEY_PREFIX = "Bearer";
const DAILY_LIMIT = 100;

export interface ShortMaxItem {
  id: string;
  provider: string;
  title: string;
  overview: string;
  posterUrl: string | null;
  episodeCount: number;
  tags: string[];
  status: string;
  playCount: number | string;
}

export interface ShortMaxEpisode {
  id: string;
  number: number;
  title: string;
  coverUrl: string | null;
  duration: number;
  locked: boolean;
  streamUrl: string | null;
}

export interface ShortMaxDetails extends ShortMaxItem {
  episodes: ShortMaxEpisode[];
  recommends: ShortMaxItem[];
}

interface ShortMaxApiKeyRow {
  id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  requests_today: number;
  request_date: string;
}

interface KeyUsage {
  key: string;
  headerName: string;
  headerValue: string;
  requestsToday: number;
  requestDate: string;
}

let keyRotation: KeyUsage[] | undefined;
let keyRotationLoaded = 0;
let rotationIndex = 0;

function shortmaxBaseUrl() {
  const configured = process.env["APISHORT_BASE_URL"]?.trim();
  const base = configured || APISHORT_HOST;
  const url = new URL(base);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APISHORT_BASE_URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

function keyHeaderName() {
  return (process.env["SHORT_MAX_API_KEY_HEADER"]?.trim() || DEFAULT_KEY_HEADER).toLowerCase();
}

function keyHeaderValue(apiKey: string) {
  const prefix = process.env["SHORT_MAX_API_KEY_PREFIX"]?.trim() || DEFAULT_KEY_PREFIX;
  return prefix ? `${prefix} ${apiKey}` : apiKey;
}

/** Baca key dari env fallback (comma-separated) kalau supabase tidak tersedia. */
function envFallbackKeys(): KeyUsage[] {
  const raw = process.env["SHORT_MAX_API_KEYS"]?.trim();
  if (!raw) return [];
  const today = new Date().toISOString().slice(0, 10);
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((key) => ({
      key,
      headerName: keyHeaderName(),
      headerValue: keyHeaderValue(key),
      requestsToday: 0,
      requestDate: today,
    }));
}

async function loadShortMaxKeys(): Promise<KeyUsage[]> {
  const now = Date.now();
  if (keyRotation && now - keyRotationLoaded < 5 * 60_000) return keyRotation;

  let keys: KeyUsage[] = [];

  // Coba baca dari tabel database via service role
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("shortmax_api_keys")
      .select("id, api_key, is_active, requests_today, request_date")
      .eq("is_active", true);

    const rows = (data ?? []) as ShortMaxApiKeyRow[];
    const today = new Date().toISOString().slice(0, 10);

    keys = rows
      .filter((row) => {
        if (row.request_date !== today) return true;
        return row.requests_today < DAILY_LIMIT;
      })
      .map((row) => ({
        key: row.api_key,
        headerName: keyHeaderName(),
        headerValue: keyHeaderValue(row.api_key),
        requestsToday: row.request_date === today ? row.requests_today : 0,
        requestDate: row.request_date === today ? row.request_date : today,
      }));
  } catch {
    // Supabase tidak tersedia, gunakan env fallback
  }

  // Fallback ke environment variable SHORT_MAX_API_KEYS
  if (keys.length === 0) {
    keys = envFallbackKeys();
  }

  keyRotation = keys;
  keyRotationLoaded = now;
  rotationIndex = 0;
  return keys;
}

function selectKey(keys: KeyUsage[]): KeyUsage | undefined {
  if (keys.length === 0) return undefined;
  const start = rotationIndex % keys.length;
  for (let offset = 0; offset < keys.length; offset++) {
    const candidate = keys[(start + offset) % keys.length]!;
    if (candidate.requestsToday < DAILY_LIMIT) {
      rotationIndex = (start + offset + 1) % keys.length;
      return candidate;
    }
  }
  return undefined;
}

function markKeyUsed(key: KeyUsage) {
  key.requestsToday += 1;
}

async function persistKeyUsage(apiKey: string, requestsToday: number) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("shortmax_api_keys")
      .update({ requests_today: requestsToday, request_date: today })
      .eq("api_key", apiKey);
  } catch {
    // Ignor kalau supabase tidak tersedia
  }
}

async function shortmaxFetch(platform: string, path: string): Promise<unknown> {
  const keys = await loadShortMaxKeys();
  if (keys.length === 0) {
    throw new Error(
      "No ShortMax API key configured. Set SHORT_MAX_API_KEYS env or insert via SQL Editor.",
    );
  }

  let lastError: unknown = null;

  // Coba semua key yang tersedia
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const selected = selectKey(keys);
    if (!selected) break;

    const headers: Record<string, string> = {
      accept: "application/json",
      [selected.headerName]: selected.headerValue,
    };

    const url = `${shortmaxBaseUrl()}/v1/${platform}/${path.replace(/^\//, "")}`;

    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        lastError = new Error(`ShortMax API request failed with status ${response.status}`);
        markKeyUsed(selected);
        await persistKeyUsage(selected.key, selected.requestsToday);
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          continue; // coba key berikutnya
        }
        throw lastError;
      }

      markKeyUsed(selected);
      await persistKeyUsage(selected.key, selected.requestsToday);
      return response.json() as Promise<unknown>;
    } catch (err) {
      lastError = err;
      markKeyUsed(selected);
      await persistKeyUsage(selected.key, selected.requestsToday);
      continue;
    }
  }

  throw lastError ?? new Error("All ShortMax API keys exhausted");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return entry ? [entry] : [];
    const name = stringValue((asRecord(entry) as Record<string, unknown>)["name"]);
    return name ? [name] : [];
  });
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getField(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function normalizeShortMaxItem(value: unknown, provider: string): ShortMaxItem | null {
  const item = asRecord(value);
  const id = String(
    getField(item, "bookId") ??
      getField(item, "originalBookId") ??
      getField(item, "book_id") ??
      getField(item, "dramaId") ??
      getField(item, "id") ??
      "",
  ).trim();
  if (!id) return null;
  const tags = stringList(
    getField(item, "labels") ?? getField(item, "tags") ?? getField(item, "typeTwoList"),
  );
  const views =
    getField(item, "viewCountDisplay") ??
    getField(item, "viewCount") ??
    getField(item, "clickNum") ??
    getField(item, "playCount");
  return {
    id,
    provider,
    title:
      stringValue(getField(item, "bookName")) ||
      stringValue(getField(item, "book_name")) ||
      stringValue(getField(item, "title")) ||
      "Untitled short drama",
    overview:
      stringValue(getField(item, "introduction")) ||
      stringValue(getField(item, "description")) ||
      stringValue(getField(item, "synopsis")) ||
      "",
    posterUrl:
      stringValue(getField(item, "coverWap")) ||
      stringValue(getField(item, "coverCutWap")) ||
      stringValue(getField(item, "cover")) ||
      stringValue(getField(item, "coverUrl")) ||
      stringValue(getField(item, "posterUrl")) ||
      stringValue(getField(item, "poster")) ||
      stringValue(getField(item, "thumbUrl")) ||
      stringValue(getField(item, "thumb")) ||
      null,
    episodeCount: numberValue(
      getField(item, "totalChapterNum") ??
        getField(item, "chapterCount") ??
        getField(item, "episodeCount"),
    ),
    tags,
    status:
      stringValue(getField(item, "lastChapterName")) ||
      stringValue(getField(item, "lastUpdateTimeDisplay")) ||
      stringValue(getField(item, "updateStatus")) ||
      stringValue(getField(item, "status")) ||
      "ongoing",
    playCount: typeof views === "string" ? views : numberValue(views),
  };
}

function normalizeShortMaxEpisodes(value: unknown): ShortMaxEpisode[] {
  if (!Array.isArray(value)) return [];
  const rawEpisodes = value.map(asRecord);
  const hasZeroIndex = rawEpisodes.some(
    (episode) => numberValue(getField(episode, "index"), -1) === 0,
  );
  return rawEpisodes
    .flatMap((episode, offset): ShortMaxEpisode[] => {
      const sourceIndex = numberValue(getField(episode, "index"), -1);
      const number = sourceIndex < 0 ? offset + 1 : sourceIndex + (hasZeroIndex ? 1 : 0);
      if (number < 1) return [];
      const id = String(getField(episode, "id") ?? "").trim() || String(number);
      return [
        {
          id,
          number,
          title:
            stringValue(getField(episode, "name")) ||
            stringValue(getField(episode, "chapterName")) ||
            `Episode ${number}`,
          coverUrl:
            stringValue(getField(episode, "cover")) ||
            stringValue(getField(episode, "coverUrl")) ||
            stringValue(getField(episode, "thumbUrl")) ||
            null,
          duration: numberValue(getField(episode, "duration")),
          locked:
            getField(episode, "unlock") === false ||
            getField(episode, "is_locked") === true ||
            getField(episode, "locked") === true,
          streamUrl: safeHttpUrl(
            getField(episode, "mp4") ??
              getField(episode, "playUrl") ??
              getField(episode, "play_url") ??
              getField(episode, "streamUrl") ??
              getField(episode, "videoUrl") ??
              // ShortMax alleps nests HLS URLs under video.video_720/480/1080
              (() => {
                const video = asRecord(getField(episode, "video"));
                return (
                  stringValue(getField(video, "video_720")) ||
                  stringValue(getField(video, "video_480")) ||
                  stringValue(getField(video, "video_1080")) ||
                  ""
                );
              })(),
          ),
        },
      ];
    })
    .sort((a, b) => a.number - b.number);
}

export const getShortMaxShorts = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        platform: z.string().min(1).max(60).default("shortmax"),
        page: z.number().int().positive().max(20).default(1),
        listType: z.enum(["popular", "new", "hot"]).default("new"),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ShortMaxItem[]> => {
    try {
      const endpoint = data.listType === "popular" ? "popular" : data.listType === "hot" ? "hot" : "new";
      const payload = await shortmaxFetch(
        data.platform,
        `/api/v1/${endpoint}?lang=id&page=${data.page}`,
      );
      const root = asRecord(payload);
      const dataRecord = asRecord(getField(root, "data"));
      const items = Array.isArray(getField(dataRecord, "books"))
        ? (getField(dataRecord, "books") as unknown[])
        : [];
      // Fallback: coba langsung di root.data jika books tidak ada
      const sourceItems = items.length > 0 ? items : Array.isArray(dataRecord) ? dataRecord : [];
      return sourceItems
        .map((entry) => normalizeShortMaxItem(entry, data.platform))
        .filter((item): item is ShortMaxItem => item !== null);
    } catch (err) {
      console.error("[ShortMax] getShortMaxShorts error:", err);
      return [];
    }
  });

export const searchShortMaxShorts = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        platform: z.string().min(1).max(60).default("shortmax"),
        q: z.string().trim().min(1).max(120),
        page: z.number().int().positive().max(20).default(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ShortMaxItem[]> => {
    try {
      const payload = await shortmaxFetch(
        data.platform,
        `/api/v1/search?lang=id&q=${encodeURIComponent(data.q)}&page=${data.page}`,
      );
      if (!Array.isArray(payload)) return [];
      return payload
        .map((entry) => normalizeShortMaxItem(entry, data.platform))
        .filter((item): item is ShortMaxItem => item !== null);
    } catch (err) {
      console.error("[ShortMax] searchShortMaxShorts error:", err);
      return [];
    }
  });

export const getShortMaxDetails = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        platform: z.string().min(1).max(60).default("shortmax"),
        bookId: z.string().trim().min(1).max(64),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ShortMaxDetails | null> => {
    try {
      const payload = await shortmaxFetch(
        data.platform,
        `/api/v1/detail/${encodeURIComponent(data.bookId)}?lang=id`,
      );
      const root = asRecord(payload);
      const dataRecord = asRecord(getField(root, "data"));
      const book = asRecord(
        getField(dataRecord, "book_info") ??
          getField(dataRecord, "book") ??
          getField(dataRecord, "detail") ??
          dataRecord,
      );
      const item = normalizeShortMaxItem(book, data.platform);
      if (!item) return null;

      // ShortMax: detail endpoint has no episodes; fetch them via /alleps/{code}
      const code = stringValue(getField(book, "code")) || item.id;
      let allepsEpisodes: ShortMaxEpisode[] = [];
      try {
        const allepsPayload = await shortmaxFetch(
          data.platform,
          `/api/v1/alleps/${encodeURIComponent(code)}?lang=id`,
        );
        const allepsRoot = asRecord(allepsPayload);
        const allepsData = asRecord(getField(allepsRoot, "data"));
        const rawEpisodes = Array.isArray(getField(allepsData, "episodes"))
          ? (getField(allepsData, "episodes") as unknown[])
          : [];
        allepsEpisodes = normalizeShortMaxEpisodes(rawEpisodes);
      } catch {
        // Alleps may fail (rate limit / expired); fall back to detail data if present.
      }

      const videos = Array.isArray(getField(dataRecord, "video_list"))
        ? (getField(dataRecord, "video_list") as unknown[])
        : [];
      const episodes =
        allepsEpisodes.length > 0
          ? allepsEpisodes
          : normalizeShortMaxEpisodes(videos);
      const recommendations = Array.isArray(getField(dataRecord, "recommends"))
        ? (getField(dataRecord, "recommends") as unknown[])
        : [];

      const viewCount = getField(book, "viewCount");
      return {
        ...item,
        overview: stringValue(getField(book, "introduction")) || item.overview,
        posterUrl: stringValue(getField(book, "cover")) || item.posterUrl,
        episodeCount: numberValue(getField(book, "chapterCount"), episodes.length),
        tags: stringList(getField(book, "labels") ?? getField(book, "tags")),
        status: stringValue(getField(book, "lastUpdateTimeDisplay")) || item.status,
        playCount: typeof viewCount === "string" ? viewCount : numberValue(viewCount),
        episodes,
        recommends: recommendations
          .map((entry) => normalizeShortMaxItem(entry, data.platform))
          .filter((entry): entry is ShortMaxItem => entry !== null),
      };
    } catch (err) {
      console.error("[ShortMax] getShortMaxDetails error:", err);
      return null;
    }
  });

export const getShortMaxEpisode = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        platform: z.string().min(1).max(60).default("shortmax"),
        bookId: z.string().trim().min(1).max(64),
        episode: z.number().int().positive(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ streamUrl: string | null }> => {
    try {
      const detail = await getShortMaxDetails({
        data: { platform: data.platform, bookId: data.bookId },
      });
      if (!detail) return { streamUrl: null };
      const episode = detail.episodes.find((entry) => entry.number === data.episode);
      if (!episode) return { streamUrl: null };
      return { streamUrl: episode.streamUrl ?? null };
    } catch (err) {
      console.error("[ShortMax] getShortMaxEpisode error:", err);
      return { streamUrl: null };
    }
  });

/** Standalone fetch of ShortMax episode list with HLS stream URLs from /alleps/{code}. */
export const getShortMaxAlleps = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        platform: z.string().min(1).max(60).default("shortmax"),
        code: z.string().trim().min(1).max(64),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ShortMaxEpisode[]> => {
    try {
      const payload = await shortmaxFetch(
        data.platform,
        `/api/v1/alleps/${encodeURIComponent(data.code)}?lang=id`,
      );
      const root = asRecord(payload);
      const dataRecord = asRecord(getField(root, "data"));
      const rawEpisodes = Array.isArray(getField(dataRecord, "episodes"))
        ? (getField(dataRecord, "episodes") as unknown[])
        : [];
      return normalizeShortMaxEpisodes(rawEpisodes);
    } catch (err) {
      console.error("[ShortMax] getShortMaxAlleps error:", err);
      return [];
    }
  });