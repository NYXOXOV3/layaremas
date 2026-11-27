import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface ShortDramaItem {
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

export interface ShortDramaEpisode {
  id: string;
  number: number;
  title: string;
  coverUrl: string | null;
  duration: number;
  locked: boolean;
  streamUrl: string | null;
}

export interface ShortDramaDetails extends ShortDramaItem {
  episodes: ShortDramaEpisode[];
  recommends: ShortDramaItem[];
}

export const SHORT_DRAMA_PROVIDER_IDS = [
  "dramawave",
  "shortmax",
  "blinkdrama",
  "vibeshort",
  "storyreel",
  "dramarush",
  "dramabox",
  "netshort",
  "flextv",
  "flickreels",
  "reelshort",
  "stardusttv",
  "dramabite",
  "starshort",
  "microdrama",
  "melolo",
  "shortwave",
  "cubetv",
  "pinedrama",
  "raptdrama",
  "goodshort",
  "joyreels",
  "vigloo",
] as const;

export type ShortDramaProvider = (typeof SHORT_DRAMA_PROVIDER_IDS)[number];

export const SHORT_DRAMA_PROVIDER_NAMES: Record<ShortDramaProvider, string> = {
  dramawave: "DramaWave",
  shortmax: "ShortMax",
  blinkdrama: "BlinkDrama",
  vibeshort: "VibeShort",
  storyreel: "StoryReel",
  dramarush: "DramaRush",
  dramabox: "DramaBox",
  netshort: "NetShort",
  flextv: "FlexTV",
  flickreels: "FlickReels",
  reelshort: "ReelShort",
  stardusttv: "StardustTV",
  dramabite: "DramaBite",
  starshort: "StarShort",
  microdrama: "MicroDrama",
  melolo: "Melolo",
  shortwave: "ShortWave",
  cubetv: "CubeTV",
  pinedrama: "PineDrama",
  raptdrama: "RaptDrama",
  goodshort: "GoodShort",
  joyreels: "JoyReels",
  vigloo: "Vigloo",
};

const PROVIDER_BASE_URLS: Partial<Record<ShortDramaProvider, string>> = {
  dramawave: "https://apishort.com/v1/dramawave",
  shortmax: "https://apishort.com/v1/shortmax",
  dramabox: "https://apishort.com/v1/dramabox",
  netshort: "https://apishort.com/v1/netshort",
  flextv: "https://apishort.com/v1/flextv",
  flickreels: "https://apishort.com/v1/flickreels",
  reelshort: "https://apishort.com/v1/reelshort",
  dramabite: "https://apishort.com/v1/dramabite",
  melolo: "https://apishort.com/v1/melolo",
  shortwave: "https://apishort.com/v1/shortwave",
  raptdrama: "https://apishort.com/v1/raptdrama",
  goodshort: "https://apishort.com/v1/goodshort",
};

function providerBaseUrl(provider: ShortDramaProvider): string {
  const envKey = `SHORT_DRAMA_BASE_URL_${provider.toUpperCase()}`;
  const configured = process.env[envKey]?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const fallback = PROVIDER_BASE_URLS[provider];
  if (fallback) return fallback;
  return `https://apishort.com/v1/${provider}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback = 0): number {
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
    const rec = asRecord(entry);
    const name = stringValue(rec["name"]);
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

const DAILY_LIMIT = 100;

interface KeyUsage {
  key: string;
  headerName: string;
  headerValue: string;
  requestsToday: number;
  requestDate: string;
}

let keyRotations: Partial<Record<ShortDramaProvider, KeyUsage[]>> = {};
let keyRotationLoaded: Partial<Record<ShortDramaProvider, number>> = {};
let rotationIndexes: Partial<Record<ShortDramaProvider, number>> = {};

function keyHeaderName(provider: ShortDramaProvider): string {
  return (
    process.env[`SHORT_DRAMA_KEY_HEADER_${provider.toUpperCase()}`]?.trim() ||
    process.env["SHORT_DRAMA_KEY_HEADER"]?.trim() ||
    "Authorization"
  ).toLowerCase();
}

function keyHeaderValue(provider: ShortDramaProvider, apiKey: string): string {
  const prefix =
    process.env[`SHORT_DRAMA_KEY_PREFIX_${provider.toUpperCase()}`]?.trim() ||
    process.env["SHORT_DRAMA_KEY_PREFIX"]?.trim() ||
    "Bearer";
  return prefix ? `${prefix} ${apiKey}` : apiKey;
}

function envFallbackKeys(provider: ShortDramaProvider): KeyUsage[] {
  const raw =
    process.env[`SHORT_DRAMA_API_KEYS_${provider.toUpperCase()}`]?.trim() ||
    process.env["SHORT_DRAMA_API_KEYS"]?.trim();
  if (!raw) return [];
  const today = new Date().toISOString().slice(0, 10);
  const hn = keyHeaderName(provider);
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((key) => ({
      key,
      headerName: hn,
      headerValue: keyHeaderValue(provider, key),
      requestsToday: 0,
      requestDate: today,
    }));
}

async function loadKeys(provider: ShortDramaProvider): Promise<KeyUsage[]> {
  const now = Date.now();
  const loaded = keyRotationLoaded[provider] ?? 0;
  if (keyRotations[provider] && now - loaded < 5 * 60_000) return keyRotations[provider]!;

  let keys: KeyUsage[] = [];

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = `short_drama_api_keys_${provider}`;
    const { data } = await (supabaseAdmin as any)
      .from(table)
      .select("api_key, is_active, requests_today, request_date")
      .eq("is_active", true);
    const rows = (data ?? []) as Array<{ api_key: string; is_active: boolean; requests_today: number; request_date: string }>;
    const today = new Date().toISOString().slice(0, 10);
    const hn = keyHeaderName(provider);
    keys = rows
      .filter((row) => row.request_date !== today || row.requests_today < DAILY_LIMIT)
      .map((row) => ({
        key: row.api_key,
        headerName: hn,
        headerValue: keyHeaderValue(provider, row.api_key),
        requestsToday: row.request_date === today ? row.requests_today : 0,
        requestDate: row.request_date === today ? row.request_date : today,
      }));
  } catch {
    // Supabase tidak tersedia atau tabel belum ada
  }

  if (keys.length === 0) {
    keys = envFallbackKeys(provider);
  }

  keyRotations[provider] = keys;
  keyRotationLoaded[provider] = now;
  rotationIndexes[provider] = 0;
  return keys;
}

function selectKey(provider: ShortDramaProvider, keys: KeyUsage[]): KeyUsage | undefined {
  if (keys.length === 0) return undefined;
  const start = ((rotationIndexes[provider] ?? 0) % keys.length + keys.length) % keys.length;
  for (let offset = 0; offset < keys.length; offset++) {
    const candidate = keys[(start + offset) % keys.length]!;
    if (candidate.requestsToday < DAILY_LIMIT) {
      rotationIndexes[provider] = (start + offset + 1) % keys.length;
      return candidate;
    }
  }
  return undefined;
}

function markKeyUsed(key: KeyUsage) {
  key.requestsToday += 1;
}

async function persistKeyUsage(provider: ShortDramaProvider, apiKey: string, requestsToday: number) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = `short_drama_api_keys_${provider}`;
    const today = new Date().toISOString().slice(0, 10);
    await (supabaseAdmin as any)
      .from(table)
      .update({ requests_today: requestsToday, request_date: today })
      .eq("api_key", apiKey);
  } catch {
    // Ignor
  }
}

async function providerFetch(
  provider: ShortDramaProvider,
  path: string,
  extraHeaders: Record<string, string> = {},
): Promise<unknown> {
  const keys = await loadKeys(provider);
  if (keys.length === 0) {
    throw new Error(
      `No API key configured for ${provider}. Set SHORT_DRAMA_API_KEYS_${provider.toUpperCase()} env.`,
    );
  }

  const base = providerBaseUrl(provider);
  const url = `${base}/${path.replace(/^\/+/, "")}`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const selected = selectKey(provider, keys);
    if (!selected) break;

    const headers: Record<string, string> = {
      accept: "application/json",
      ...extraHeaders,
      [selected.headerName]: selected.headerValue,
    };

    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        lastError = new Error(`${provider} API request failed with status ${response.status}`);
        markKeyUsed(selected);
        await persistKeyUsage(provider, selected.key, selected.requestsToday);
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          continue;
        }
        throw lastError;
      }

      markKeyUsed(selected);
      await persistKeyUsage(provider, selected.key, selected.requestsToday);
      return response.json();
    } catch (err) {
      lastError = err;
      if (selected) {
        markKeyUsed(selected);
        await persistKeyUsage(provider, selected.key, selected.requestsToday);
      }
      continue;
    }
  }

  throw lastError ?? new Error(`All ${provider} API keys exhausted`);
}