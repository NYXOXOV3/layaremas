import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { z } from "zod";
import { getCastMembers, getDetails, type MediaType } from "@/lib/tmdb.functions";
import { tmdbImg } from "@/lib/img";
import { resilientQuery } from "@/lib/resilient-query";

const detailsQuery = (type: MediaType, id: number) => resilientQuery({
  queryKey: ["details", type, id],
  queryFn: () => getDetails({ data: { type, id } }),
  staleTime: 300_000,
});

const castQuery = (type: MediaType, id: number) => queryOptions({
  queryKey: ["cast", type, id],
  queryFn: () => getCastMembers({ data: { type, id } }),
  staleTime: 300_000,
});

export const Route = createFileRoute("/cast/$type/$id")({
  loader: async ({ context, params }) => {
    const type = z.enum(["movie", "tv"]).parse(params.type);
    const id = z.coerce.number().int().positive().parse(params.id);
    const [details] = await Promise.all([
      context.queryClient.ensureQueryData(detailsQuery(type, id)),
      context.queryClient.ensureQueryData(castQuery(type, id)),
    ]);
    return { type, id, title: details.title };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Cast of ${loaderData?.title ?? "title"} — Layar Emas` },
      { name: "description", content: `Cast details for ${loaderData?.title ?? "this title"}.` },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: CastPage,
});

function CastPage() {
  const { type, id, title } = Route.useLoaderData();
  const { data: cast } = useSuspenseQuery(castQuery(type, id));

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-28 md:px-8 md:pt-36">
      <div className="mb-8 space-y-3">
        {type === "movie" ? (
          <Link to="/movie/$id" params={{ id: String(id) }} className="text-sm text-primary hover:underline">
            Back to movie
          </Link>
        ) : (
          <Link to="/tv/$id" params={{ id: String(id) }} className="text-sm text-primary hover:underline">
            Back to TV show
          </Link>
        )}
        <h1 className="text-3xl font-bold md:text-5xl">Cast of {title}</h1>
        <p className="text-sm text-muted-foreground">{cast.length} cast members</p>
      </div>

      {cast.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {cast.map((member, index) => {
            const image = tmdbImg(member.profile_path, "w342");
            return (
              <article key={`${member.id}-${index}`} className="overflow-hidden rounded-xl border border-border bg-card">
                <Link to="/person/$id" params={{ id: String(member.id) }} className="block">
                  <div className="aspect-[2/3] overflow-hidden bg-muted">
                    {image ? (
                      <img src={image} alt={member.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <User className="h-12 w-12" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="line-clamp-2 text-sm font-semibold">{member.name}</h2>
                    {member.character && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{member.character}</p>
                    )}
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No cast information is available for this title.
        </p>
      )}
    </main>
  );
}
