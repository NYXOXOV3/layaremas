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
    <section className="relative min-h-[100svh] overflow-hidden bg-background">
      {background ? (
        <img
          src={background}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-card to-background" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />

      <div className="relative flex min-h-[100svh] w-full items-end px-4 pb-20 pt-24 md:px-8">
        <div className="max-w-3xl w-full max-w-7xl mx-0">
          {eyebrow && (
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-primary">{eyebrow}</p>
          )}
          <h1 className="text-4xl font-extrabold leading-[1.05] drop-shadow-lg md:text-6xl">{title}</h1>
          {description && (
            <p className="mt-4 line-clamp-3 max-w-xl text-muted-foreground drop-shadow md:text-base">
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
      </div>
    </section>
  );
}
