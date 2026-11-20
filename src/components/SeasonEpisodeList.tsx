import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Play, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSeasonEpisodes, type Details } from "@/lib/tmdb.functions";
import { tmdbImg } from "@/lib/img";

export function SeasonEpisodeList({
  details,
  season,
  episode,
  onSeasonChange,
  highlightCurrent = true,
}: {
  details: Details;
  season: number;
  episode: number;
  onSeasonChange?: (season: number) => void;
  highlightCurrent?: boolean;
}) {
  const [uncontrolledSeason, setUncontrolledSeason] = useState(season);
  const selectedSeason = onSeasonChange ? season : uncontrolledSeason;
  const fetchEpisodes = useServerFn(getSeasonEpisodes);
  const query = useQuery({
    queryKey: ["watch-episodes", details.id, selectedSeason],
    queryFn: () => fetchEpisodes({ data: { id: details.id, season: selectedSeason } }),
    staleTime: 300_000,
  });
  const seasons = details.seasons.some((item) => item.number === selectedSeason)
    ? details.seasons
    : [
        { number: selectedSeason, name: `Season ${selectedSeason}`, episodes: 0 },
        ...details.seasons,
      ];

  function changeSeason(value: string) {
    const nextSeason = Number(value);
    if (onSeasonChange) onSeasonChange(nextSeason);
    else setUncontrolledSeason(nextSeason);
  }

  return (
    <section className="space-y-5 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Episodes</h2>
          <p className="mt-1 text-sm text-muted-foreground">{details.title}</p>
        </div>
        <Select value={String(selectedSeason)} onValueChange={changeSeason}>
          <SelectTrigger className="w-44" aria-label="Select season">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((item) => (
              <SelectItem key={item.number} value={String(item.number)}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {query.isPending ? (
        <p className="py-8 text-sm text-muted-foreground">Loading episodes…</p>
      ) : query.isError ? (
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">Could not load episodes.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : !query.data?.length ? (
        <p className="py-8 text-sm text-muted-foreground">No episodes available for this season.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((item) => {
            const active = highlightCurrent && selectedSeason === season && item.number === episode;
            const image = tmdbImg(item.still, "w342");
            return (
              <Button
                key={item.id}
                asChild
                variant="ghost"
                className={`h-full justify-start overflow-hidden rounded-xl border p-0 text-left whitespace-normal ${
                  active
                    ? "border-primary bg-primary/10 hover:bg-primary/15"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                <Link
                  to="/watch/$type/$id"
                  params={{ type: "tv", id: String(details.id) }}
                  search={{ s: selectedSeason, e: item.number }}
                  aria-label={`Play season ${selectedSeason} episode ${item.number}: ${item.title}`}
                  aria-current={active ? "true" : undefined}
                  className="group flex h-full w-full min-w-0 flex-col"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <Play className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 grid place-items-center bg-background/20 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Play className="h-8 w-8 fill-current drop-shadow" />
                    </div>
                    {active && (
                      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">
                        <Radio className="h-3 w-3" /> Now playing
                      </div>
                    )}
                  </div>
                  <div className="w-full min-w-0 flex-1 p-4">
                    <p className="text-xs text-muted-foreground">
                      Episode {item.number}
                      {item.runtime ? ` · ${item.runtime} min` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold">{item.title}</p>
                    {item.overview && (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {item.overview}
                      </p>
                    )}
                  </div>
                </Link>
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}
