import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { tmdbImg } from "@/lib/img";
import type { MediaItem } from "@/lib/tmdb.functions";

export function PageHero({
  title,
  eyebrow,
  description,
  items = [],
  featuredWatchId,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  items?: MediaItem[];
  featuredWatchId?: number;
}) {
  const featured = items.find((item) => item.backdrop_path) ?? items[0];
  const background = featured ? tmdbImg(featured.backdrop_path, "original") : null;

  return (
    <section className="relative flex min-h-[42vh] items-end overflow-hidden rounded-3xl border border-border/50 md:min-h-[52vh]">
      {background ? (
        <img
          src={background}
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
        {eyebrow && (
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">{eyebrow}</p>
        )}
        <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">{title}</h1>
        {description && (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {description}
          </p>
        )}
        {featured && (
          featuredWatchId ? (
            <Link
              to="/watch/$type/$id"
              params={{ type: "tv", id: String(featuredWatchId) }}
              search={{ s: 1, e: 1 }}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-glow transition hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" />
              Watch {featured.title}
            </Link>
          ) : featured.media_type === "movie" ? (
            <Link
              to="/movie/$id"
              params={{ id: String(featured.id) }}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-glow transition hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" />
              Explore {featured.title}
            </Link>
          ) : (
            <Link
              to="/tv/$id"
              params={{ id: String(featured.id) }}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-glow transition hover:brightness-110"
            >
              <Play className="h-4 w-4 fill-current" />
              Explore {featured.title}
            </Link>
          )
        )}
      </div>
    </section>
  );
}
