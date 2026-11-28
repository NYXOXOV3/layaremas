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

export const Route = createFileRoute("/tv-shows")({
  validateSearch: (x) => browseSearch.parse(x),
  loader: async ({ context, search }) => {
    const s = search || {};
    const genre = s.genre;
    const year = s.year ? Number(s.year) : undefined;
    const country = s.country;
    const isAnime = genre === "16" && country === "JP";
    const heroRes = await discover({ data: { type: "tv", genre, year, country, page: 1 } });
    return { heroItems: heroRes.results, isAnime, genre, year, country };
  },
  head: ({ loaderData }) => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: loaderData?.isAnime ? "Anime — Layar Emas" : "TV Shows — Layar Emas" },
      { name: "description", content: "Browse TV series by genre, year and country, including K-drama and Indonesian series." },
      { property: "og:title", content: loaderData?.isAnime ? "Anime — Layar Emas" : "TV Shows — Layar Emas" },
      { property: "og:description", content: "Browse TV series by genre, year and country." },
    ],
  }),
  component: TvShows,
});

function TvShows() {
  const { heroItems, isAnime } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tv-shows" });

  return (
    <div className="space-y-10 pb-16">
      <HeroCarousel items={heroItems} />
      <BrowseGrid type="tv" title={isAnime ? "Anime" : "TV Shows"} filters={search} onChange={(f) => navigate({ search: f })} />
    </div>
  );
}
