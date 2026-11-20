import { describe, expect, it } from "vitest";
import { DataUnavailableError, resilientQuery } from "@/lib/resilient-query";

describe("resilientQuery", () => {
  it("uses the fallback when the query resolves undefined", async () => {
    const q = resilientQuery<string[]>({
      queryKey: ["t"],
      queryFn: async () => undefined,
      fallback: [],
    });
    await expect(q.queryFn!({} as never)).resolves.toEqual([]);
  });

  it("throws DataUnavailableError when there is no fallback and data is missing", async () => {
    const q = resilientQuery<string[]>({
      queryKey: ["t"],
      queryFn: async () => null,
    });
    await expect(q.queryFn!({} as never)).rejects.toBeInstanceOf(DataUnavailableError);
  });

  it("passes through real data unchanged", async () => {
    const q = resilientQuery<string[]>({
      queryKey: ["t"],
      queryFn: async () => ["a"],
      fallback: [],
    });
    await expect(q.queryFn!({} as never)).resolves.toEqual(["a"]);
  });

  it("keeps staleTime and refetchInterval options", () => {
    const q = resilientQuery<string[]>({
      queryKey: ["t"],
      queryFn: async () => undefined,
      fallback: [],
      staleTime: 1234,
      refetchInterval: 5000,
    });
    expect(q.staleTime).toBe(1234);
    expect(q.refetchInterval).toBe(5000);
  });
});
