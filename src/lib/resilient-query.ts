import { queryOptions } from "@tanstack/react-query";

/** Thrown when a server function resolves with no data after a retry.
 *  Route error boundaries show a retryable message instead of a blank page. */
export class DataUnavailableError extends Error {}

/**
 * Wraps a server-function-backed query so a transport glitch (dev reload,
 * dropped response) cannot crash with "data is undefined":
 * - the query is retried once on failure,
 * - an undefined/null result uses `fallback` when one is provided,
 * - otherwise it throws DataUnavailableError for the error boundary.
 */
export function resilientQuery<T>(opts: {
  queryKey: unknown[];
  queryFn: () => Promise<T | undefined | null>;
  fallback?: T;
  staleTime?: number;
  refetchInterval?: number;
}) {
  return queryOptions({
    queryKey: opts.queryKey,
    queryFn: async () => {
      const data = await opts.queryFn();
      if (data !== undefined && data !== null) return data;
      if (opts.fallback !== undefined) return opts.fallback;
      throw new DataUnavailableError("Could not load this page. Please try again.");
    },
    retry: 1,
    ...(opts.staleTime !== undefined ? { staleTime: opts.staleTime } : {}),
    ...(opts.refetchInterval !== undefined ? { refetchInterval: opts.refetchInterval } : {}),
  });
}
