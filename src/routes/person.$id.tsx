import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/MediaCard";
import { getPersonProfile } from "@/lib/tmdb.functions";
import { tmdbImg } from "@/lib/img";
import { z } from "zod";

const personQuery = (id: number) => queryOptions({
  queryKey: ["person", id],
  queryFn: () => getPersonProfile({ data: { id } }),
  staleTime: 300_000,
});

export const Route = createFileRoute("/person/$id")({
  loader: async ({ context, params }) => {
    const id = z.coerce.number().int().positive().parse(params.id);
    const profile = await context.queryClient.ensureQueryData(personQuery(id));
    return { id, name: profile?.name ?? "Person" };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Person"} — Layar Emas` },
      { name: "description", content: `Biography and filmography for ${loaderData?.name ?? "this cast member"}.` },
    ],
  }),
  component: PersonPage,
});

function PersonPage() {
  const { id } = Route.useLoaderData();
  const { data: person } = useSuspenseQuery(personQuery(id));
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");

  if (!person) {
    return (
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-28 md:px-8 md:pt-36">
        <p className="text-muted-foreground">Cast profile is unavailable.</p>
        <Link to="/movies" className="mt-4 inline-block text-sm text-primary hover:underline">Browse movies</Link>
      </main>
    );
  }

  const credits = person.credits.filter((credit) => filter === "all" || credit.media_type === filter);
  const profileImage = tmdbImg(person.profile_path, "w500");

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 pb-16 pt-28 md:px-8 md:pt-36">
      <Link to="/movies" className="text-sm text-primary hover:underline">Browse movies</Link>
      <section className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-card">
          {profileImage ? (
            <img src={profileImage} alt={person.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <User className="h-16 w-16" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="space-y-5">
          <div>
            <p className="text-sm text-primary">{person.known_for_department ?? "Cast"}</p>
            <h1 className="mt-1 text-4xl font-bold md:text-5xl">{person.name}</h1>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {person.birthday && (
              <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{person.birthday}</p>
            )}
            {person.place_of_birth && (
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{person.place_of_birth}</p>
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Biography</h2>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
              {person.biography || "No biography is available."}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Filmography</h2>
            <p className="mt-1 text-sm text-muted-foreground">{person.credits.length} acting credits</p>
          </div>
          <div className="flex gap-2" aria-label="Filter credits">
            {([
              ["all", "All"],
              ["movie", "Movies"],
              ["tv", "TV"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "secondary" : "ghost"}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {credits.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {credits.map((credit) => (
              <div key={`${credit.media_type}-${credit.id}`}>
                <MediaCard item={credit} />
                {credit.character && (
                  <p className="mt-1 truncate px-0.5 text-xs text-muted-foreground" title={credit.character}>
                    As {credit.character}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No acting credits are available for this filter.
          </p>
        )}
      </section>
    </main>
  );
}
