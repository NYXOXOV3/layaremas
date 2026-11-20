import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaRow } from "@/components/MediaCard";
import { AdSlot } from "@/components/AdSlot";
import { getMovieRecommendations, getSeasonEpisodes, type Details } from "@/lib/tmdb.functions";
import { SeasonEpisodeList } from "@/components/SeasonEpisodeList";

export function WatchExtras({ details, season, episode }: { details: Details; season: number; episode: number }) {
  return details.media_type === "tv"
    ? <><AdSlot placement="watch_episodes" /><SeasonEpisodeList details={details} season={season} episode={episode} /></>
    : <><AdSlot placement="watch_recommendations" /><MovieRecommendations details={details} /></>;
}

/** Resolves the next episode coordinates: next episode in the season, or episode 1 of the next season. */
export function useNextEpisode(details: Details, season: number, episode: number) {
  const fetchEpisodes = useServerFn(getSeasonEpisodes);
  const query = useQuery({
    queryKey: ["watch-episodes", details.id, season],
    queryFn: () => fetchEpisodes({ data: { id: details.id, season } }),
    staleTime: 300_000,
  });
  if (details.media_type !== "tv") return { next: null, isPending: query.isPending };
  const episodes = query.data ?? [];
  if (episodes.some((item) => item.number === episode + 1)) return { next: { season, episode: episode + 1 }, isPending: query.isPending };
  const nextSeason = details.seasons.find((item) => item.number === season + 1);
  if (nextSeason && query.data) return { next: { season: season + 1, episode: 1 }, isPending: false };
  return { next: null, isPending: query.isPending };
}

/** Resolves the previous episode coordinates: previous episode in the season, or the last episode of the previous season. */
export function usePrevEpisode(details: Details, season: number, episode: number) {
  const fetchEpisodes = useServerFn(getSeasonEpisodes);
  const prevSeason = season - 1;
  const needsPrevSeason = episode === 1 && details.seasons.some((item) => item.number === prevSeason);
  const query = useQuery({
    queryKey: ["watch-episodes", details.id, prevSeason],
    queryFn: () => fetchEpisodes({ data: { id: details.id, season: prevSeason } }),
    staleTime: 300_000,
    enabled: details.media_type === "tv" && needsPrevSeason,
  });
  if (details.media_type !== "tv") return { prev: null, isPending: false };
  if (episode > 1) return { prev: { season, episode: episode - 1 }, isPending: false };
  if (!needsPrevSeason) return { prev: null, isPending: false };
  if (query.isPending) return { prev: null, isPending: true };
  const lastEp = query.data?.length ? query.data[query.data.length - 1] : undefined;
  const last = lastEp ? lastEp.number : null;
  return { prev: last ? { season: prevSeason, episode: last } : null, isPending: false };
}

export function PrevEpisodeButton({ details, season, episode }: { details: Details; season: number; episode: number }) {
  const { prev, isPending } = usePrevEpisode(details, season, episode);
  if (details.media_type !== "tv") return null;
  if (isPending) return <Button size="sm" variant="secondary" disabled><SkipBack /> Previous…</Button>;
  if (!prev) return null;
  return <Button size="sm" variant="secondary" asChild>
    <Link to="/watch/$type/$id" params={{ type: "tv", id: String(details.id) }} search={{ s: prev.season, e: prev.episode }} aria-label={`Previous episode: season ${prev.season} episode ${prev.episode}`}>
      <SkipBack /> Previous episode
    </Link>
  </Button>;
}

export function NextEpisodeButton({ details, season, episode }: { details: Details; season: number; episode: number }) {
  const { next, isPending } = useNextEpisode(details, season, episode);
  if (details.media_type !== "tv") return null;
  if (isPending) return <Button size="sm" variant="secondary" disabled><SkipForward /> Next episode…</Button>;
  if (!next) return null;
  return <Button size="sm" variant="hero" asChild>
    <Link to="/watch/$type/$id" params={{ type: "tv", id: String(details.id) }} search={{ s: next.season, e: next.episode }} aria-label={`Next episode: season ${next.season} episode ${next.episode}`}>
      <SkipForward /> Next episode
    </Link>
  </Button>;
}

function MovieRecommendations({ details }: { details: Details }) {
  const fetchRecommendations = useServerFn(getMovieRecommendations);
  const query = useQuery({
    queryKey: ["watch-recommendations", details.id],
    queryFn: () => fetchRecommendations({ data: { id: details.id } }),
    staleTime: 300_000,
  });
  const items = query.data?.length ? query.data : details.similar.filter((item) => item.id !== details.id);
  return <div className="pt-6">
    {query.isPending && !items.length ? <p className="text-sm text-muted-foreground">Loading recommendations…</p>
      : items.length ? <div className="-mx-4 md:-mx-8"><MediaRow title="Recommended movies" items={items} /></div>
      : <section className="space-y-3"><h2 className="text-2xl font-semibold">Recommended movies</h2>
        <p className="text-sm text-muted-foreground">No recommendations available for this movie.</p>
        {query.isError && <Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>}
      </section>}
  </div>;
}
