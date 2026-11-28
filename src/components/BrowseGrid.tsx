import { useQuery, useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/MediaCard";
import { AdSlot } from "@/components/AdSlot";
import { discover, getGenres } from "@/lib/browse.functions";
import { COUNTRIES, YEARS } from "@/lib/catalog";

export interface BrowseFilters {
  genre?: string | undefined;
  year?: number | undefined;
  country?: string | undefined;
}

export function BrowseGrid({
  type,
  title,
  filters,
  onChange,
  hideFilters = [],
  fixedFilters = {},
}: {
  type: "movie" | "tv";
  title: string;
  filters: BrowseFilters;
  onChange: (f: BrowseFilters) => void;
  hideFilters?: string[];
  fixedFilters?: Record<string, any>;
}) {
  const genres = useQuery({ queryKey: ["genres", type], queryFn: () => getGenres({ data: { type } }), staleTime: Infinity });

  const baseFilters = { ...filters, ...fixedFilters };

  const infiniteQuery = useInfiniteQuery({
    queryKey: ["discover", type, baseFilters.genre ?? "", baseFilters.year ?? 0, baseFilters.country ?? ""],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => discover({ data: { type, genre: baseFilters.genre, year: baseFilters.year, country: baseFilters.country, page: pageParam } }),
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      if (lastPage.totalPages >= nextPage) return nextPage;
      return undefined;
    },
    staleTime: 5 * 60_000,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = infiniteQuery;
  const items = data?.pages.flatMap((page) => page.results) ?? [];
  const sel = "h-9 rounded-full border border-input bg-card px-3 text-sm";
  const hideGenre = hideFilters.includes("genre");
  const hideYear = hideFilters.includes("year");
  const hideCountry = hideFilters.includes("country");
  const showFilters = !hideGenre || !hideYear || !hideCountry;

  return (
    <div className="w-full px-4 pb-16 md:px-8">
      {showFilters && (
        <div className="mt-6 flex flex-wrap gap-2">
          {!hideGenre && (
            <select className={sel} value={baseFilters.genre ?? ""} onChange={(e) => onChange({ ...baseFilters, genre: e.target.value || undefined })}>
              <option value="">All genres</option>
              {genres.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          {!hideYear && (
            <select className={sel} value={baseFilters.year ?? ""} onChange={(e) => onChange({ ...baseFilters, year: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">All years</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {!hideCountry && (
            <select className={sel} value={baseFilters.country ?? ""} onChange={(e) => onChange({ ...baseFilters, country: e.target.value || undefined })}>
              <option value="">All countries</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}
      <AdSlot placement="catalog_top" />
      {isLoading && <p className="mt-8 text-muted-foreground">Loading…</p>}
      {isError && <p className="mt-8 text-destructive">Failed to load. Please try again.</p>}
      {items.length === 0 && !isLoading && <p className="mt-8 text-muted-foreground">No titles match these filters.</p>}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
        {items.map((i) => <MediaCard key={i.id} item={i} />)}
      </div>
      {hasNextPage && (
        <div className="mt-10 flex justify-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
      <AdSlot placement="catalog_bottom" />
    </div>
  );
}
