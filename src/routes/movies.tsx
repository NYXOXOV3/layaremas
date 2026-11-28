import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BrowseGrid } from "@/components/BrowseGrid";
import { HeroCarousel } from "@/components/HeroCarousel";
import { discover } from "@/lib/browse.functions";

const browseSearch = z.object({
  genre: z.string().optional(),
  year: z.coerce.number().optional(),
  country: z.string().optional(),
});

export const Route = createFileRoute("/movies")({
  validateSearch: (s) => browseSearch.parse(s),
  loader: async ({ context, params, search }) => {
    const s = search || {};
    const genre = s.genre;
    const year = s.year ? Number(s.year) : undefined;
    const country = s.country;
    const heroRes = await discover({ data: { type: "movie", genre, year, country, page: 1 } });
    return { heroItems: heroRes.results, genre, year, country };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Movies — Layar Emas" },
      { name: "description", content: "Browse movies by genre, year and country." },
      { property: "og:title", content: "Movies — Layar Emas" },
      { property: "og:description", content: "Browse movies by genre, year and country." },
    ],
  }),
  component: Movies,
});

function Movies() {
  const { heroItems } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/movies" });

  return (
    <div className="space-y-10 pb-16">
      <HeroCarousel items={heroItems} />
      <BrowseGrid type="movie" title="Movies" filters={search} onChange={(f) => navigate({ search: f })} />
    </div>
  );
}
