import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Play, Search } from "lucide-react";
import {
  getShortMaxShorts,
  searchShortMaxShorts,
} from "@/lib/shortmax.functions";
import { SHORT_DRAMA_PROVIDER_IDS, SHORT_DRAMA_PROVIDER_NAMES } from "@/lib/dramabox.functions";
import { AdSlot } from "@/components/AdSlot";
import { Input } from "@/components/ui/input";

const shortSearchSchema = z.object({
  q: z.string().optional().default(""),
  provider: z.enum(SHORT_DRAMA_PROVIDER_IDS).optional().default("shortmax"),
});

export const Route = createFileRoute("/shorts")({
  validateSearch: (search) => shortSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Short Drama — Layar Emas" },
      { name: "description", content: "Drama shorts with episodes of five minutes or less." },
    ],
  }),
  component: Shorts,
});

function Shorts() {
  const { q, provider } = Route.useSearch();
  const navigate = useNavigate({ from: "/shorts" });
  const shortsQuery = useInfiniteQuery({
    queryKey: ["shorts", provider, q],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      q
        ? searchShortMaxShorts({ data: { platform: provider, q, page: pageParam } })
        : getShortMaxShorts({ data: { platform: provider, page: pageParam } }),
    getNextPageParam: (_lastPage, _allPages, lastPageParam) =>
      lastPageParam >= 20 ? undefined : lastPageParam + 1,
    staleTime: 30 * 60_000,
  });
  const data = [
    ...new Map(
      (shortsQuery.data?.pages.flatMap((page) => page) ?? []).map((item) => [item.id, item]),
    ).values(),
  ];
  const featured = data[0];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:px-8">
      <section className="relative flex min-h-[42vh] items-end overflow-hidden rounded-3xl border border-border/50 md:min-h-[52vh]">
        {featured?.posterUrl ? (
          <img
            src={featured.posterUrl}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-card to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="relative max-w-2xl px-6 pb-9 pt-28 md:px-10 md:pb-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">
            {SHORT_DRAMA_PROVIDER_NAMES[provider]} vertical stories
          </p>
          <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Short Drama</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Discover short dramas and play episodes in a vertical reel experience.
          </p>
          {featured && (
            <Link
              to="/watch/$type/$id"
              params={{ type: featured.provider, id: featured.id }}
              search={{ e: 1 }}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-glow"
            >
              <Play className="h-4 w-4 fill-current" />
              Watch {featured.title}
            </Link>
          )}
        </div>
      </section>
      <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Short drama providers">
        {SHORT_DRAMA_PROVIDER_IDS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              void navigate({ search: { q, provider: value }, replace: false });
            }}
            aria-pressed={provider === value}
            className={`h-10 rounded-full border px-5 text-sm font-bold transition ${
              provider === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {SHORT_DRAMA_PROVIDER_NAMES[value]}
          </button>
        ))}
      </div>
      <AdSlot placement="catalog_top" />
      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
            All short dramas
          </p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">
            {q ? `Search results for “${q}”` : "Watch in short style"}
          </h2>
        </div>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
          }}
          className="relative w-full max-w-xs"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            defaultValue={q}
            key={q}
            onChange={(event) => {
              const next = event.target.value;
              void navigate({
                search: next ? { q: next, provider } : { q: "", provider },
                replace: false,
              });
            }}
            placeholder="Search short dramas"
            className="pl-9"
          />
        </form>
      </div>
      {shortsQuery.isLoading && (
        <p className="mt-8 text-sm text-muted-foreground">Loading short dramas…</p>
      )}
      {shortsQuery.isError && (
        <div className="mt-8 flex items-center gap-3 text-sm text-destructive">
          <p>Could not load short dramas. Please try again.</p>
          <button
            type="button"
            onClick={() => void shortsQuery.refetch()}
            className="font-bold underline"
          >
            Retry
          </button>
        </div>
      )}
      {!shortsQuery.isLoading && !shortsQuery.isError && data.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          No shorts found. Try again later; listings are refreshed regularly.
        </p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {data.map((item) => {
          const poster = item.posterUrl;
          return (
            <Link
              key={`${item.provider}-${item.id}`}
              to="/watch/$type/$id"
              params={{ type: item.provider, id: item.id }}
              search={{ e: 1 }}
              className="group"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-card ring-primary/70 transition duration-300 group-hover:ring-2">
                {poster ? (
                  <img
                    src={poster}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="grid h-full place-items-center p-3 text-center text-sm text-muted-foreground">
                    {item.title}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground">
                  Short
                </span>
                <span className="absolute inset-0 grid place-items-center text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-primary shadow-glow">
                    <Play className="h-5 w-5 fill-current" />
                  </span>
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{item.title}</p>
              {item.episodeCount > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.episodeCount} episodes</p>
              )}
            </Link>
          );
        })}
      </div>
      {shortsQuery.hasNextPage && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => void shortsQuery.fetchNextPage()}
            disabled={shortsQuery.isFetchingNextPage}
            className="h-11 rounded-full border border-border bg-card px-6 text-sm font-bold transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {shortsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
      <AdSlot placement="catalog_bottom" />
    </div>
  );
}
