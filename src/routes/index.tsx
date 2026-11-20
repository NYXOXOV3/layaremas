import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HomeAdGroup } from "@/components/AdSlot";
import { MediaRow } from "@/components/MediaCard";
import { ContinueWatching } from "@/components/ContinueWatching";
import { HeroCarousel } from "@/components/HeroCarousel";
import { DramaShelf, HomeMediaShelf, NetworkShelf, PersonalizedRecommendations, RecentEpisodesShelf, SpotlightShelf } from "@/components/HomeSections";
import { getHome } from "@/lib/tmdb.functions";
import { resilientQuery } from "@/lib/resilient-query";
import { tmdbImg } from "@/lib/img";
import { settingsQuery } from "@/lib/settings.functions";

const EMPTY_HOME = {
  trending: [],
  movies: [],
  tv: [],
  top: [],
  indo: [],
  trendingIndonesia: [],
  recentMovies: [],
  recentSeries: [],
};

const homeQuery = resilientQuery({
  queryKey: ["home"],
  queryFn: () => getHome(),
  fallback: EMPTY_HOME,
  staleTime: 10 * 60_000,
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const [home, settings] = await Promise.all([
      context.queryClient.ensureQueryData(homeQuery),
      context.queryClient.ensureQueryData(settingsQuery).catch(() => null),
    ]);
    return {
      og: settings?.bg_image_url ?? tmdbImg(home.trending[0]?.backdrop_path, "original") ?? null,
      name: settings?.site_name ?? "Layar Emas",
      desc: settings?.description ?? "Trending movies, TV shows and Indonesian films. Save your watchlist and stream licensed titles.",
    };
  },
  head: ({ loaderData }) => {
    const title = `${loaderData?.name ?? "Layar Emas"} — Discover & stream movies and TV`;
    const desc = loaderData?.desc ?? "Trending movies, TV shows and Indonesian films.";
    const og = loaderData?.og?.startsWith("https://") ? loaderData.og : null;
    return {
      meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(og ? [{ property: "og:image", content: og }, { name: "twitter:image", content: og }] : []),
      ],
    };
  },
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(homeQuery);
  const [trendingFilter, setTrendingFilter] = useState<"all" | "movie" | "tv">("all");
  const [indonesiaFilter, setIndonesiaFilter] = useState<"all" | "movie" | "tv">("all");
  const trendingItems = data.trending.filter((item) => trendingFilter === "all" || item.media_type === trendingFilter);
  const indonesiaItems = data.trendingIndonesia.filter((item) => indonesiaFilter === "all" || item.media_type === indonesiaFilter);

  return (
    <div className="space-y-10 pb-16">
      <HeroCarousel items={data.trending} />
      <ContinueWatching />
      <PersonalizedRecommendations />
      <HomeAdGroup index={0} />
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8">
          <h2 className="text-xl font-bold md:text-2xl">Trending Now</h2>
          <div className="flex gap-2" role="group" aria-label="Filter trending titles">
            {([
              ["all", "All"],
              ["movie", "Movies"],
              ["tv", "TV Shows"],
            ] as const).map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={trendingFilter === value ? "hero" : "secondary"} aria-pressed={trendingFilter === value} onClick={() => setTrendingFilter(value)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        <MediaRow title="" items={trendingItems} ranked />
      </section>
      <HomeAdGroup index={1} />
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8">
          <h2 className="text-xl font-bold md:text-2xl">Trending in Indonesia</h2>
          <div className="flex gap-2" role="group" aria-label="Filter Indonesia trending titles">
            {([
              ["all", "All"],
              ["movie", "Movies"],
              ["tv", "TV Shows"],
            ] as const).map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={indonesiaFilter === value ? "hero" : "secondary"} aria-pressed={indonesiaFilter === value} onClick={() => setIndonesiaFilter(value)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        <MediaRow title="" items={indonesiaItems} ranked />
      </section>
      <HomeAdGroup index={2} />
      <NetworkShelf />
      <HomeAdGroup index={3} />
      <DramaShelf />
      <HomeAdGroup index={4} />
      <HomeMediaShelf title="Recently Added Movies" items={data.recentMovies} to="/movies" />
      <HomeMediaShelf title="Recently Added Series" items={data.recentSeries} to="/tv-shows" />
      <HomeAdGroup index={5} />
      <SpotlightShelf items={data.trending.slice(0, 10)} />
      <RecentEpisodesShelf series={data.recentSeries} />
    </div>
  );
}
