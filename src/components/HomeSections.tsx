import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaRow } from "@/components/MediaCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { discover } from "@/lib/browse.functions";
import { readWatchHistory, type ContinueEntry } from "@/lib/continue-watching";
import { tmdbImg } from "@/lib/img";
import { getMediaRecommendations, getRecentEpisodes, type MediaItem } from "@/lib/tmdb.functions";

const ORIGINAL_NETWORKS = [
  { id: 213, name: "Netflix Originals" },
  { id: 49, name: "HBO Originals" },
  { id: 1024, name: "Prime Video Originals" },
  { id: 2739, name: "Disney+ Originals" },
  { id: 2552, name: "Apple TV+ Originals" },
  { id: 2007, name: "Tencent Video Originals" },
  { id: 866, name: "tvN Originals" },
  { id: 1330, name: "iQIYI Originals" },
  { id: 11, name: "SBS Originals" },
  { id: 97, name: "MBC Originals" },
] as const;

const CATEGORIES = [
  { key: "korea", name: "Korean Drama", country: "KR", genre: "18" },
  { key: "anime", name: "Anime", country: "JP", genre: "16" },
  { key: "china", name: "Chinese Drama", country: "CN", genre: "18" },
  { key: "japan", name: "Japanese Drama", country: "JP", genre: "18" },
  { key: "thailand", name: "Thai Drama", country: "TH", genre: "18" },
] as const;

function useClientReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export function PersonalizedRecommendations() {
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<ContinueEntry[]>([]);
  const fetchRecommendations = useServerFn(getMediaRecommendations);

  useEffect(() => {
    const loadHistory = () => setHistory(readWatchHistory());
    loadHistory();
    setReady(true);
    window.addEventListener("watch-history", loadHistory);
    window.addEventListener("storage", loadHistory);
    return () => {
      window.removeEventListener("watch-history", loadHistory);
      window.removeEventListener("storage", loadHistory);
    };
  }, []);

  const watched = history.slice(0, 3);
  const query = useQuery({
    queryKey: ["home-personalized", watched.map((item) => item.key)],
    staleTime: 10 * 60_000,
    enabled: ready && watched.length > 0,
    queryFn: async () => {
      const groups = await Promise.all(
        watched.map((item) =>
          fetchRecommendations({
            data: { type: item.type, id: item.id },
          }),
        ),
      );
      const watchedKeys = new Set(history.map((item) => `${item.type}:${item.id}`));
      const recommendations = new Map<string, MediaItem>();
      for (const group of groups) {
        for (const item of group) {
          const key = `${item.media_type}:${item.id}`;
          if (!watchedKeys.has(key) && !recommendations.has(key)) recommendations.set(key, item);
        }
      }
      return [...recommendations.values()].slice(0, 20);
    },
  });

  if (!ready) return null;
  return (
    <section id="recommendations" className="space-y-3">
      {watched.length > 0 ? (
        <>
          <h2 className="px-4 text-xl font-bold md:px-8 md:text-2xl">
            Because you watched {watched[0].title}
          </h2>
          {query.isLoading && (
            <p className="px-4 text-sm text-muted-foreground md:px-8">Finding recommendations…</p>
          )}
          {query.isError && (
            <p role="alert" className="px-4 text-sm text-destructive md:px-8">
              Could not load recommendations.
            </p>
          )}
          {query.data?.length ? <MediaRow title="" items={query.data} /> : null}
          {!query.isLoading && !query.isError && !query.data?.length && (
            <p className="px-4 text-sm text-muted-foreground md:px-8">
              No recommendations found yet.
            </p>
          )}
        </>
      ) : (
        <>
          <h2 className="px-4 text-xl font-bold md:px-8 md:text-2xl">Recommendations for you</h2>
          <p className="px-4 text-sm text-muted-foreground md:px-8">
            Watch a movie or series to get recommendations based on your viewing.
          </p>
        </>
      )}
    </section>
  );
}

export function NetworkShelf() {
  const ready = useClientReady();
  const [networkId, setNetworkId] = useState<number>(ORIGINAL_NETWORKS[0].id);
  const network =
    ORIGINAL_NETWORKS.find((option) => option.id === networkId) ?? ORIGINAL_NETWORKS[0];
  const query = useQuery({
    queryKey: ["home-original-network", network.id],
    staleTime: 10 * 60_000,
    enabled: ready,
    queryFn: async () =>
      (await discover({ data: { type: "tv", network: network.id } })).results.slice(0, 20),
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8">
        <h2 className="text-xl font-bold md:text-2xl">Studio &amp; Network</h2>
        <div className="flex items-center gap-2">
          <Select value={String(network.id)} onValueChange={(value) => setNetworkId(Number(value))}>
            <SelectTrigger aria-label="Choose an originals network" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIGINAL_NETWORKS.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="ghost" size="sm">
            <Link to="/collection/$kind/$id" params={{ kind: "network", id: String(network.id) }}>
              View all <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
      {ready && query.isLoading && (
        <p className="px-4 text-sm text-muted-foreground md:px-8">Loading titles…</p>
      )}
      {ready && query.isError && (
        <p role="alert" className="px-4 text-sm text-destructive md:px-8">
          Could not load {network.name}.
        </p>
      )}
      {query.data?.length ? <MediaRow title="" items={query.data} /> : null}
      {ready && !query.isLoading && !query.isError && !query.data?.length && (
        <p className="px-4 text-sm text-muted-foreground md:px-8">
          No titles found for {network.name}.
        </p>
      )}
    </section>
  );
}

export function DramaShelf() {
  const ready = useClientReady();
  const [categoryKey, setCategoryKey] = useState<string>(CATEGORIES[0].key);
  const category = CATEGORIES.find((option) => option.key === categoryKey) ?? CATEGORIES[0];
  const query = useQuery({
    queryKey: ["home-drama", category.key],
    staleTime: 10 * 60_000,
    enabled: ready,
    queryFn: async () => {
      if (category.key === "anime") {
        const [movies, series] = await Promise.all([
          discover({ data: { type: "movie", country: category.country, genre: category.genre } }),
          discover({ data: { type: "tv", country: category.country, genre: category.genre } }),
        ]);
        return [...movies.results, ...series.results]
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
          .slice(0, 20);
      }
      const series = await discover({
        data: { type: "tv", country: category.country, genre: category.genre },
      });
      return series.results.slice(0, 20);
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8">
        <h2 className="text-xl font-bold md:text-2xl">{category.name}</h2>
        <div className="flex items-center gap-2">
          <Select value={category.key} onValueChange={setCategoryKey}>
            <SelectTrigger aria-label="Choose a drama or anime category" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="ghost" size="sm">
            <Link to="/tv-shows" search={{ country: category.country, genre: category.genre }}>
              View all <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
      {ready && query.isLoading && (
        <p className="px-4 text-sm text-muted-foreground md:px-8">Loading titles…</p>
      )}
      {ready && query.isError && (
        <p role="alert" className="px-4 text-sm text-destructive md:px-8">
          Could not load {category.name} titles.
        </p>
      )}
      {query.data?.length ? <MediaRow title="" items={query.data} /> : null}
      {ready && !query.isLoading && !query.isError && !query.data?.length && (
        <p className="px-4 text-sm text-muted-foreground md:px-8">
          No titles found for {category.name}.
        </p>
      )}
    </section>
  );
}

export function HomeMediaShelf({
  title,
  items,
  to,
}: {
  title: string;
  items: MediaItem[];
  to: "/movies" | "/tv-shows";
}) {
  return <MediaRow title={title} items={items} titleLinkTo={to} />;
}

function SpotlightCard({ item }: { item: MediaItem }) {
  const backdrop = tmdbImg(item.backdrop_path, "w1280");
  const poster = tmdbImg(item.poster_path, "w342");
  return (
    <article className="group relative isolate min-h-64 w-[min(90vw,34rem)] shrink-0 overflow-hidden rounded-2xl border border-border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-primary/70">
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          loading="lazy"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40 transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/90 to-background/30" />
      <div className="grid h-full gap-4 p-4 sm:grid-cols-[7rem_1fr] sm:items-center sm:p-5">
        {poster && (
          <img
            src={poster}
            alt={item.title}
            loading="lazy"
            className="aspect-[2/3] w-28 rounded-lg object-cover shadow-xl"
          />
        )}
        <div className="max-w-3xl">
          <h3 className="text-xl font-extrabold md:text-2xl">{item.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-semibold text-primary-foreground">
              <Star className="h-3 w-3 fill-current" />
              {item.vote_average.toFixed(1)}
            </span>
            {item.date && (
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-1">
                {item.date.slice(0, 4)}
              </span>
            )}
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-1">
              {item.media_type === "tv" ? "Series" : "Movie"}
            </span>
            <span className="rounded-full bg-primary/20 px-2.5 py-1 font-semibold text-primary">
              Trending
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {item.overview}
          </p>
          {item.media_type === "movie" ? (
            <Button asChild variant="hero" size="sm" className="mt-3">
              <Link to="/movie/$id" params={{ id: String(item.id) }}>
                <Play className="fill-current" /> Watch now
              </Link>
            </Button>
          ) : (
            <Button asChild variant="hero" size="sm" className="mt-3">
              <Link to="/tv/$id" params={{ id: String(item.id) }}>
                <Play className="fill-current" /> Watch now
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function SpotlightShelf({ items }: { items: MediaItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => {
    const element = ref.current;
    if (element)
      element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  };
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="px-4 text-xl font-bold md:px-8 md:text-2xl">Spotlight</h2>
      <div className="group/row relative">
        <button
          type="button"
          aria-label="Scroll spotlight left"
          onClick={() => scroll(-1)}
          className="absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-center bg-gradient-to-r from-background to-transparent transition-opacity md:w-12 md:opacity-0 md:focus-visible:opacity-100 md:group-hover/row:opacity-100"
        >
          <ChevronLeft className="h-8 w-8 text-primary" />
        </button>
        <div
          ref={ref}
          className="scrollbar-none flex scroll-smooth gap-3 overflow-x-auto px-4 pb-4 md:px-8"
        >
          {items.map((item) => (
            <SpotlightCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
        <button
          type="button"
          aria-label="Scroll spotlight right"
          onClick={() => scroll(1)}
          className="absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-center bg-gradient-to-l from-background to-transparent transition-opacity md:w-12 md:opacity-0 md:focus-visible:opacity-100 md:group-hover/row:opacity-100"
        >
          <ChevronRight className="h-8 w-8 text-primary" />
        </button>
      </div>
    </section>
  );
}

export function RecentEpisodesShelf({ series }: { series: MediaItem[] }) {
  const ready = useClientReady();
  const ref = useRef<HTMLDivElement>(null);
  const ids = series.slice(0, 8).map((item) => item.id);
  const query = useQuery({
    queryKey: ["home-recent-episodes", ids],
    staleTime: 10 * 60_000,
    enabled: ready && ids.length > 0,
    queryFn: () => getRecentEpisodes({ data: { ids } }),
  });
  if (!series.length) return null;
  const scroll = (direction: number) => {
    const element = ref.current;
    if (element)
      element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <section className="space-y-3">
      <h2 className="px-4 text-xl font-bold md:px-8 md:text-2xl">Recently Added Episodes</h2>
      <div className="group/row relative">
        {query.data?.length ? (
          <button
            type="button"
            aria-label="Scroll recent episodes left"
            onClick={() => scroll(-1)}
            className="absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-center bg-gradient-to-r from-background to-transparent transition-opacity md:w-12 md:opacity-0 md:focus-visible:opacity-100 md:group-hover/row:opacity-100"
          >
            <ChevronLeft className="h-8 w-8 text-primary" />
          </button>
        ) : null}
        <div
          ref={ref}
          className="scrollbar-none flex scroll-smooth gap-3 overflow-x-auto px-4 pb-4 md:px-8"
        >
          {ready && query.isLoading && (
            <p className="text-sm text-muted-foreground">Loading episodes…</p>
          )}
          {ready && query.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not load recent episodes.
            </p>
          )}
          {(query.data ?? []).slice(0, 12).map((item) => {
            const still = tmdbImg(item.still_path, "w300");
            return (
              <Link
                key={`${item.tv_id}-${item.id}`}
                to="/watch/$type/$id"
                params={{ type: "tv", id: String(item.tv_id) }}
                search={{ s: item.season, e: item.episode }}
                className="w-64 shrink-0 overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/70 sm:w-72"
              >
                <div className="aspect-video bg-background">
                  {still ? (
                    <img src={still} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Episode still unavailable
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-3">
                  <p className="truncate font-semibold">{item.tv_title}</p>
                  <p className="truncate text-sm text-primary">
                    S{item.season} E{item.episode} · {item.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.overview}</p>
                  {item.air_date && (
                    <p className="text-xs text-muted-foreground">{item.air_date}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
        {query.data?.length ? (
          <button
            type="button"
            aria-label="Scroll recent episodes right"
            onClick={() => scroll(1)}
            className="absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-center bg-gradient-to-l from-background to-transparent transition-opacity md:w-12 md:opacity-0 md:focus-visible:opacity-100 md:group-hover/row:opacity-100"
          >
            <ChevronRight className="h-8 w-8 text-primary" />
          </button>
        ) : null}
      </div>
      {ready && !query.isLoading && !query.isError && !query.data?.length && (
        <p className="px-4 text-sm text-muted-foreground md:px-8">No recent episodes found.</p>
      )}
    </section>
  );
}
