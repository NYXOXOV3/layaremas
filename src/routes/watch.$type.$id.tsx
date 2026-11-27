import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { resilientQuery } from "@/lib/resilient-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  entryKey,
  parsePlayerMessage,
  readEntries,
  saveEntry,
  withResume,
} from "@/lib/continue-watching";
import { z } from "zod";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Heart,
  ListVideo,
  MessageCircle,
  Play,
  Share2,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlayback } from "@/lib/play.functions";
import { CreatePartyDialog } from "@/components/CreatePartyDialog";

import { useAuth } from "@/lib/auth";
import { SHORT_DRAMA_PROVIDER_IDS } from "@/lib/dramabox.functions";
import { AdSlot } from "@/components/AdSlot";
import { Preroll } from "@/components/Preroll";
import { adsQuery } from "@/lib/advertisements.functions";
import { adsForPlacement } from "@/lib/advertisements";
import {
  getDetails,
  getSeasonEpisodes,
  type Details,
  type SeasonEpisode,
} from "@/lib/tmdb.functions";
import { NextEpisodeButton, PrevEpisodeButton, WatchExtras } from "@/components/WatchExtras";
import {
  getShortMaxDetails,
  getShortMaxEpisode,
  type ShortMaxDetails,
  type ShortMaxEpisode,
} from "@/lib/shortmax.functions";

const watchDetailsQuery = (type: string, id: string) =>
  resilientQuery({
    queryKey: ["details", type === "tv" ? "tv" : "movie", Number(id)],
    queryFn: () => getDetails({ data: { type: type === "tv" ? "tv" : "movie", id: Number(id) } }),
    staleTime: 300_000,
  });

const shortMaxDetailsQuery = (platform: string, bookId: string) =>
  resilientQuery({
    queryKey: ["shortmax-details", platform, bookId],
    queryFn: () => getShortMaxDetails({ data: { platform, bookId } }),
    fallback: null,
    staleTime: 300_000,
  });

export const Route = createFileRoute("/watch/$type/$id")({
  validateSearch: (s) =>
    z
      .object({
        s: z.coerce.number().int().positive().optional(),
        e: z.coerce.number().int().positive().optional(),
      })
      .parse(s),
  loader: ({ context, params }) =>
    SHORT_DRAMA_PROVIDER_IDS.includes(params.type as (typeof SHORT_DRAMA_PROVIDER_IDS)[number])
      ? context.queryClient.ensureQueryData(shortMaxDetailsQuery(params.type, params.id))
      : context.queryClient.ensureQueryData(watchDetailsQuery(params.type, params.id)),
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: `Watch ${loaderData?.title ?? "movies and series"} — Layar Emas` },
      {
        name: "description",
        content: `Watch ${loaderData?.title ?? "movies and series"} on Layar Emas and explore episodes or recommended films.`,
      },
      {
        property: "og:title",
        content: `Watch ${loaderData?.title ?? "movies and series"} — Layar Emas`,
      },
      {
        property: "og:description",
        content: `Watch ${loaderData?.title ?? "movies and series"} on Layar Emas and explore episodes or recommended films.`,
      },
    ],
  }),
  component: Watch,
});

function Watch() {
  const { type, id } = Route.useParams();
  const { s, e } = Route.useSearch();
  if (SHORT_DRAMA_PROVIDER_IDS.includes(type as (typeof SHORT_DRAMA_PROVIDER_IDS)[number])) {
    return <ShortMaxShortWatch platform={type} bookId={id} episode={e ?? 1} />;
  }
  return <WatchPlayer key={`${type}/${id}/${s}/${e}`} type={type} id={id} s={s} e={e} />;
}

function ShortMaxEpisodeCard({
  bookId,
  episode,
  active,
  details,
  episodes,
  platform,
}: {
  bookId: string;
  episode: ShortMaxEpisode;
  active: boolean;
  details: ShortMaxDetails;
  episodes: ShortMaxEpisode[];
  platform: string;
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const [metadataVisible, setMetadataVisible] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fetchEpisode = useServerFn(getShortMaxEpisode);
  const query = useQuery({
    queryKey: ["shortmax-episode", bookId, episode.number],
    enabled: active && !episode.streamUrl && !episode.locked,
    queryFn: () => fetchEpisode({ data: { platform, bookId, episode: episode.number } }),
    staleTime: 300_000,
    retry: 2,
  });
  const streamUrl = episode.streamUrl ?? query.data?.streamUrl;

  useEffect(() => {
    if (!active) {
      videoRef.current?.pause();
      return;
    }
    const video = videoRef.current;
    if (video) {
      video.muted = muted;
      void video.play().catch(() => undefined);
    }
  }, [active, muted, streamUrl]);

  useEffect(() => {
    setMetadataVisible(true);
    const timer = window.setTimeout(() => setMetadataVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [episode.number]);

  async function shareEpisode() {
    const url = `${window.location.origin}/watch/${platform}/${bookId}?e=${episode.number}`;
    if (navigator.share) {
      await navigator
        .share({ title: `${details.title} - EP ${episode.number}`, url })
        .catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url);
    }
  }

  function selectEpisode(number: number) {
    setEpisodesOpen(false);
    window.history.replaceState({}, "", `/watch/${platform}/${bookId}?e=${number}`);
    document
      .getElementById(`shortmax-episode-${number}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <article
      id={`shortmax-episode-${episode.number}`}
      className="relative h-[100svh] w-full snap-start snap-always overflow-hidden bg-black"
    >
      {streamUrl && active ? (
        <video
          ref={videoRef}
          src={streamUrl}
          poster={episode.coverUrl ?? details.posterUrl ?? undefined}
          controls
          autoPlay={active}
          muted={muted}
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-contain object-center"
        />
      ) : episode.coverUrl || details.posterUrl ? (
        <img
          src={episode.coverUrl ?? details.posterUrl ?? ""}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-card to-black" />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/65 to-transparent" />
      <div
        className={`absolute left-4 right-20 top-16 z-10 text-white transition-opacity duration-700 md:left-8 ${metadataVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
          {details.provider} · Episode {episode.number}
        </p>
        <h1 className="mt-1 line-clamp-1 text-xl font-extrabold md:text-3xl">{details.title}</h1>
        {episode.title && (
          <p className="mt-1 text-xs font-semibold text-white/90 md:text-sm">{episode.title}</p>
        )}
        {details.overview && (
          <p className="mt-1 line-clamp-2 max-w-xs text-xs leading-relaxed text-white/75 md:max-w-md md:text-sm">
            {details.overview}
          </p>
        )}
      </div>
      {active && query.isLoading && !episode.streamUrl && (
        <p className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-sm text-white/80">
          Loading episode…
        </p>
      )}
      {active && !query.isLoading && !streamUrl && (
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center">
          <p className="text-sm text-red-300">
            {episode.locked
              ? "This paid episode is not available for free."
              : "This episode stream is unavailable."}
          </p>
          {!episode.locked && (
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="h-9 rounded-full border border-white/30 bg-black/45 px-4 text-xs font-bold text-white backdrop-blur-md"
            >
              Retry stream
            </button>
          )}
        </div>
      )}
      <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-4 text-white md:right-6">
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md"
          aria-label={muted ? "Turn sound on" : "Mute"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => setLiked((value) => !value)}
          className="flex flex-col items-center gap-1"
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <Heart className={`h-5 w-5 ${liked ? "fill-red-500 text-red-500" : ""}`} />
          </span>
          <span className="text-[10px] font-semibold">Like</span>
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="flex flex-col items-center gap-1"
          aria-label="Open comments"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="text-[10px] font-semibold">Comment</span>
        </button>
        <button
          type="button"
          onClick={() => setSaved((value) => !value)}
          className="flex flex-col items-center gap-1"
          aria-label={saved ? "Remove from saved" : "Save"}
          aria-pressed={saved}
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <Bookmark className={`h-5 w-5 ${saved ? "fill-primary text-primary" : ""}`} />
          </span>
          <span className="text-[10px] font-semibold">Save</span>
        </button>
        <button
          type="button"
          onClick={() => void shareEpisode()}
          className="flex flex-col items-center gap-1"
          aria-label="Share episode"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <Share2 className="h-5 w-5" />
          </span>
          <span className="text-[10px] font-semibold">Share</span>
        </button>
        <button
          type="button"
          onClick={() => setEpisodesOpen(true)}
          className="flex flex-col items-center gap-1"
          aria-label="Open episode list"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-md">
            <ListVideo className="h-5 w-5" />
          </span>
          <span className="text-[10px] font-semibold">Episodes</span>
        </button>
      </div>
      {commentsOpen && (
        <div className="absolute inset-x-0 bottom-0 z-[70] rounded-t-3xl border-t border-white/10 bg-background/95 px-5 pb-8 pt-4 text-foreground backdrop-blur-xl">
          <div className="mx-auto h-1 w-12 rounded-full bg-white/20" />
          <div className="mt-4 flex items-center justify-between">
            <h3 className="font-bold">Comments</h3>
            <button
              type="button"
              onClick={() => setCommentsOpen(false)}
              className="text-sm text-muted-foreground"
            >
              Close
            </button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">No comments yet.</p>
        </div>
      )}
      {episodesOpen && (
        <div className="absolute inset-x-0 bottom-0 z-[70] max-h-[65vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-background/95 px-5 pb-8 pt-4 text-foreground backdrop-blur-xl">
          <div className="mx-auto h-1 w-12 rounded-full bg-white/20" />
          <div className="mt-4 flex items-center justify-between">
            <h3 className="font-bold">Episode list</h3>
            <button
              type="button"
              onClick={() => setEpisodesOpen(false)}
              className="text-sm text-muted-foreground"
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {episodes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectEpisode(item.number)}
                className={`grid h-11 place-items-center rounded-lg border text-sm font-bold ${item.number === episode.number ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
              >
                {item.number}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function ShortMaxShortWatch({ platform, bookId, episode }: { platform: string; bookId: string; episode: number }) {
  const { data: details } = useSuspenseQuery(shortMaxDetailsQuery(platform, bookId));
  const episodes = details?.episodes ?? [];
  const [activeEpisode, setActiveEpisode] = useState(episode);
  const activeIndex = Math.max(
    0,
    episodes.findIndex((item) => item.number === activeEpisode),
  );
  const reelRef = useRef<HTMLDivElement>(null);
  const scrollLockRef = useRef(false);
  const scrollTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => setActiveEpisode(episode), [episode]);

  useEffect(() => {
    scrollLockRef.current = true;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`shortmax-episode-${episode}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 100);
    const unlockTimer = window.setTimeout(() => {
      scrollLockRef.current = false;
    }, 900);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(unlockTimer);
    };
  }, [episode, episodes.length]);

  useEffect(() => {
    const root = reelRef.current;
    if (!root || episodes.length === 0) return;
    const onScroll = () => {
      window.clearTimeout(scrollTimerRef.current);
      if (scrollLockRef.current) return;
      scrollTimerRef.current = window.setTimeout(() => {
        const nearest = episodes
          .map((item) => {
            const element = document.getElementById(`shortmax-episode-${item.number}`);
            return element
              ? { number: item.number, distance: Math.abs(element.getBoundingClientRect().top) }
              : null;
          })
          .filter((item): item is { number: number; distance: number } => item !== null)
          .sort((a, b) => a.distance - b.distance)[0];
        if (!nearest || nearest.number === activeEpisode) return;
        setActiveEpisode(nearest.number);
        window.history.replaceState({}, "", `/watch/${platform}/${bookId}?e=${nearest.number}`);
      }, 180);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollTimerRef.current);
    };
  }, [platform, bookId, episodes, activeEpisode]);

  const moveTo = (direction: -1 | 1) => {
    const next = episodes[activeIndex + direction];
    if (next) {
      scrollLockRef.current = true;
      setActiveEpisode(next.number);
      window.history.replaceState({}, "", `/watch/${platform}/${bookId}?e=${next.number}`);
      document
        .getElementById(`shortmax-episode-${next.number}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
      window.setTimeout(() => {
        scrollLockRef.current = false;
      }, 900);
    }
  };

  if (!details) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black px-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-bold">Short drama unavailable</h1>
          <Link
            to="/shorts"
            search={{ q: "", provider: platform as (typeof SHORT_DRAMA_PROVIDER_IDS)[number] }}
            className="mt-4 inline-block text-sm text-primary"
          >
            Back to Shorts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={reelRef}
      className="fixed inset-0 z-50 mx-auto max-w-[520px] overflow-y-auto snap-y snap-mandatory bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
          <Link
            to="/shorts"
            search={{ q: "", provider: platform as (typeof SHORT_DRAMA_PROVIDER_IDS)[number] }}
            className="absolute left-4 top-4 z-[60] grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
            aria-label="Back to shorts"
          >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      {episodes.length === 0 ? (
        <div className="grid h-[100svh] snap-start place-items-center px-6 text-center text-white">
          <p className="font-semibold">No episodes available.</p>
        </div>
      ) : (
        episodes.map((item) => (
          <ShortMaxEpisodeCard
            key={item.id}
            platform={platform}
            bookId={bookId}
            episode={item}
            active={item.number === activeEpisode}
            details={details}
            episodes={episodes}
          />
        ))
      )}
      {episodes.length > 1 && (
        <div className="fixed bottom-1/2 right-3 z-[60] flex translate-y-1/2 flex-col gap-3 md:right-[calc(50%-290px)]">
          {activeIndex > 0 && (
            <button
              type="button"
              onClick={() => moveTo(-1)}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
              aria-label="Previous episode"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          )}
          {activeIndex < episodes.length - 1 && (
            <button
              type="button"
              onClick={() => moveTo(1)}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
              aria-label="Next episode"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ShortEpisodeCard({
  details,
  season,
  episode,
  active,
}: {
  details: Details;
  season: number;
  episode: SeasonEpisode;
  active: boolean;
}) {
  const { user, loading } = useAuth();
  const fetchPlayback = useServerFn(getPlayback);
  const playback = useQuery({
    queryKey: ["short-playback", user?.id, details.id, season, episode.number],
    enabled: !loading,
    queryFn: () =>
      fetchPlayback({
        data: { type: "tv", id: details.id, s: season, e: episode.number },
      }),
  });
  const src = playback.data?.sources[0];
  const still = episode.still
    ? `https://image.tmdb.org/t/p/original${episode.still}`
    : details.backdrop_path
      ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
      : null;

  return (
    <article
      id={`short-episode-${episode.number}`}
      className="relative h-[100svh] w-full snap-start snap-always overflow-hidden bg-black"
    >
      {src?.url ? (
        src.sourceType === "embed" ? (
          <iframe
            src={src.url}
            title={`${details.title} episode ${episode.number}`}
            allow="encrypted-media; autoplay *; fullscreen *; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <video
            src={src.url}
            poster={still ?? undefined}
            controls
            autoPlay={active}
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-contain"
          />
        )
      ) : still ? (
        <img
          src={still}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-card to-black" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/45" />
      <div className="absolute inset-x-0 bottom-10 z-10 px-5 pb-[env(safe-area-inset-bottom)] md:bottom-12 md:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Short drama · Episode {episode.number}
        </p>
        <h1 className="mt-2 max-w-xl text-3xl font-extrabold leading-tight text-white md:text-5xl">
          {details.title}
        </h1>
        {episode.title && (
          <p className="mt-2 text-sm font-semibold text-white/90 md:text-base">{episode.title}</p>
        )}
        {episode.overview && (
          <p className="mt-2 line-clamp-3 max-w-lg text-sm leading-relaxed text-white/70">
            {episode.overview}
          </p>
        )}
        {(playback.isLoading || loading) && (
          <p className="mt-4 text-sm text-white/70">Loading episode…</p>
        )}
        {playback.data?.error && <p className="mt-4 text-sm text-red-300">{playback.data.error}</p>}
      </div>
      {episode.runtime ? (
        <span className="absolute right-4 top-4 z-10 rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
          {episode.runtime} min
        </span>
      ) : null}
    </article>
  );
}

function ShortWatchPlayer({
  details,
  id,
  season,
  episode,
  episodes,
  episodesLoading,
}: {
  details: Details;
  id: string;
  season: number;
  episode: number;
  episodes: SeasonEpisode[];
  episodesLoading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      document
        .getElementById(`short-episode-${episode}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [episode, episodes.length]);

  const episodeList = episodes.filter(
    (item) => typeof item.runtime !== "number" || item.runtime <= 5,
  );
  const visibleEpisodes = episodeList.length > 0 ? episodeList : episodes;
  const activeIndex = Math.max(
    0,
    visibleEpisodes.findIndex((item) => item.number === episode),
  );

  const moveTo = (direction: -1 | 1) => {
    const next = visibleEpisodes[activeIndex + direction];
    if (!next) return;
    document
      .getElementById(`short-episode-${next.number}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 mx-auto max-w-[520px] overflow-y-auto snap-y snap-mandatory bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Link
        to="/tv/$id"
        params={{ id }}
        className="absolute left-4 top-4 z-[60] grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
        aria-label="Back to series details"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      {episodesLoading && (
        <div className="grid h-[100svh] snap-start place-items-center text-sm text-white/70">
          Loading short episodes…
        </div>
      )}
      {!episodesLoading && visibleEpisodes.length === 0 && (
        <div className="grid h-[100svh] snap-start place-items-center px-6 text-center text-white">
          <div>
            <Play className="mx-auto h-8 w-8" />
            <p className="mt-3 font-semibold">No short episodes found for this season.</p>
            <Link to="/tv/$id" params={{ id }} className="mt-4 inline-block text-sm text-primary">
              Back to details
            </Link>
          </div>
        </div>
      )}
      {visibleEpisodes.map((item) => (
        <ShortEpisodeCard
          key={item.id}
          details={details}
          season={season}
          episode={item}
          active={item.number === episode}
        />
      ))}
      {visibleEpisodes.length > 1 && (
        <div className="fixed bottom-1/2 right-3 z-[60] flex translate-y-1/2 flex-col gap-3 md:right-[calc(50%-290px)]">
          {activeIndex > 0 && (
            <button
              type="button"
              onClick={() => moveTo(-1)}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
              aria-label="Previous short episode"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          )}
          {activeIndex < visibleEpisodes.length - 1 && (
            <button
              type="button"
              onClick={() => moveTo(1)}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
              aria-label="Next short episode"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function WatchPlayer({
  type,
  id,
  s,
  e,
}: {
  type: string;
  id: string;
  s: number | undefined;
  e: number | undefined;
}) {
  const { data: details } = useSuspenseQuery(watchDetailsQuery(type, id));
  const { user, loading } = useAuth();
  const fetchPlayback = useServerFn(getPlayback);
  const mediaType = type === "tv" ? "tv" : "movie";
  const fetchEpisodes = useServerFn(getSeasonEpisodes);
  const episodeQuery = useQuery({
    queryKey: ["short-watch-episodes", id, s ?? 1],
    enabled: mediaType === "tv",
    staleTime: 300_000,
    queryFn: () => fetchEpisodes({ data: { id: Number(id), season: s ?? 1 } }),
  });
  const currentEpisode = episodeQuery.data?.find((item) => item.number === (e ?? 1));
  const isShort =
    mediaType === "tv" &&
    ((details.runtime !== null && details.runtime <= 5) ||
      (currentEpisode?.runtime !== null && (currentEpisode?.runtime ?? 6) <= 5));
  const { data, isLoading, error } = useQuery({
    queryKey: ["playback", user?.id, type, id, s, e],
    enabled: !loading,
    queryFn: () => fetchPlayback({ data: { type: mediaType, id: Number(id), s, e } }),
  });
  const [idx, setIdx] = useState(0);
  const [completedAds, setCompletedAds] = useState<string[]>([]);
  const ads = useQuery(adsQuery);
  const preroll = adsForPlacement(ads.data ?? [], "preroll").find(
    (ad) => ad.id && !completedAds.includes(ad.id),
  );
  const src = data?.sources[idx] ?? data?.sources[0];
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [resumeAt, setResumeAt] = useState<number | undefined>(undefined);
  useEffect(() => {
    const saved = readEntries().find((x) => x.key === entryKey(mediaType, Number(id)));
    const same =
      saved && (mediaType === "movie" || (saved.season === (s ?? 1) && saved.episode === (e ?? 1)));
    if (same) setResumeAt(saved.currentTime);
    saveEntry({
      key: entryKey(mediaType, Number(id)),
      type: mediaType,
      id: Number(id),
      title: details.title,
      backdrop: details.backdrop_path ?? null,
      poster: details.poster_path ?? null,
      season: mediaType === "tv" ? (s ?? 1) : undefined,
      episode: mediaType === "tv" ? (e ?? 1) : undefined,
      currentTime: same ? saved.currentTime : 0,
      duration: same ? saved.duration : 0,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, id, s, e]);
  useEffect(() => {
    let last = 0;
    const onMessage = (ev: MessageEvent) => {
      if (!frameRef.current || ev.source !== frameRef.current.contentWindow) return;
      const msg = parsePlayerMessage(ev.data);
      if (!msg || !["timeupdate", "pause", "ended"].includes(msg.event)) return;
      const now = Date.now();
      if (msg.event === "timeupdate" && now - last < 5000) return;
      last = now;
      saveEntry({
        key: entryKey(mediaType, Number(id)),
        type: mediaType,
        id: Number(id),
        title: details.title,
        backdrop: details.backdrop_path ?? null,
        poster: details.poster_path ?? null,
        season: mediaType === "tv" ? (s ?? 1) : undefined,
        episode: mediaType === "tv" ? (e ?? 1) : undefined,
        currentTime: msg.event === "ended" ? msg.duration : msg.currentTime,
        duration: msg.duration,
        updatedAt: now,
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mediaType, id, s, e, details]);

  if (isShort) {
    return (
      <ShortWatchPlayer
        details={details}
        id={id}
        season={s ?? 1}
        episode={e ?? 1}
        episodes={episodeQuery.data ?? []}
        episodesLoading={episodeQuery.isLoading}
      />
    );
  }
  const back =
    mediaType === "movie" ? (
      <Link
        to="/movie/$id"
        params={{ id }}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
    ) : (
      <Link
        to="/tv/$id"
        params={{ id }}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
    );

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pb-16 pt-24 md:px-8">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">{details.title}</h1>
          {mediaType === "tv" && (
            <p className="mt-1 text-sm text-muted-foreground">
              Season {s ?? 1} · Episode {e ?? 1}
            </p>
          )}
        </div>
        {mediaType === "tv" && (
          <div className="flex items-center gap-2">
            <PrevEpisodeButton details={details} season={s ?? 1} episode={e ?? 1} />
            <NextEpisodeButton details={details} season={s ?? 1} episode={e ?? 1} />
          </div>
        )}
      </div>
      <AdSlot placement="watch_top" />
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-card shadow-card">
        {(loading || isLoading || ads.isLoading) && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading player…
          </div>
        )}
        {data?.error && !isLoading && (
          <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
            {data.error}
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
            Could not load playback. Please refresh.
          </div>
        )}
        {src && !ads.isLoading && preroll ? (
          <Preroll
            key={preroll.id}
            ad={preroll}
            onComplete={() => {
              const adId = preroll.id;
              if (adId) setCompletedAds((ids) => [...ids, adId]);
            }}
          />
        ) : src?.url && !ads.isLoading ? (
          src.sourceType === "embed" ? (
            <iframe
              ref={frameRef}
              key={src.url}
              src={withResume(src.url, resumeAt)}
              title="Licensed video player"
              allow="encrypted-media; autoplay *; fullscreen *; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full"
            />
          ) : (
            <video
              key={src.url}
              src={src.url}
              controls
              autoPlay
              className="h-full w-full bg-background"
            />
          )
        ) : null}
      </div>
      <AdSlot placement="watch_bottom" />
      {data && data.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Servers:</span>
          {data.sources.map((x, i) => (
            <Button
              key={x.id}
              size="sm"
              variant={i === idx ? "hero" : "secondary"}
              onClick={() => setIdx(i)}
            >
              {i === 0 && <Zap />} {x.server} · {x.quality}
              <span className="text-xs opacity-70">{x.ok ? `${x.latencyMs}ms` : "slow"}</span>
            </Button>
          ))}
          {user && (
            <CreatePartyDialog
              type={mediaType}
              tmdbId={Number(id)}
              title={details.title}
              season={s ?? 1}
              episode={e ?? 1}
            />
          )}
        </div>
      )}
      <WatchExtras details={details} season={s ?? 1} episode={e ?? 1} />
    </div>
  );
}
