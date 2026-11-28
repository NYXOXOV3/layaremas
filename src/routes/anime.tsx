import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BrowseGrid } from "@/components/BrowseGrid";
import { HeroCarousel } from "@/components/HeroCarousel";
import { discover } from "@/lib/browse.functions";

const browseSearch = z.object({
  year: z.coerce.number().optional(),
});

const ANIME_GENRE = "16";
const ANIME_COUNTRY = "JP";

export const Route = createFileRoute("/anime")({
  validateSearch: (x) => browseSearch.parse(x),
  loader: async ({ context, search }) => {
    const s = search || {};
    const year = s.year ? Number(s.year) : undefined;
    // Default to TV series for anime
    const type = "tv";
    const heroRes = await discover({
      data: { type, genre: ANIME_GENRE, year, country: ANIME_COUNTRY, page: 1, sort: "popularity.desc" }
    });
    return { heroItems: heroRes.results, year, type };
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Anime — Layar Emas" },
      { name: "description", content: "Japanese animation series and movies, from popular seasonal titles to long-running favorites." },
      { property: "og:title", content: "Anime — Layar Emas" },
      { property: "og:description", content: "Japanese animation series and movies." },
    ],
  }),
  component: Anime,
});

function Anime() {
  const { heroItems, type } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/anime" });

  return (
    <div className="space-y-10 pb-16">
      <HeroCarousel items={heroItems} />
      <BrowseGrid
        type={type}
        title="Anime Series"
        filters={{
          year: search.year ? Number(search.year) : undefined,
        }}
        fixedFilters={{
          genre: ANIME_GENRE,
          country: ANIME_COUNTRY,
        }}
        onChange={(f) => navigate({ search: { ...search, year: f.year, page: 1 } })}
      />
    </div>
  );
}