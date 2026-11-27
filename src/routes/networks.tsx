import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, Search } from "lucide-react";
import { AdSlot } from "@/components/AdSlot";
import { Input } from "@/components/ui/input";
import { NETWORKS } from "@/lib/catalog";
import { PageHero } from "@/components/PageHero";

export const Route = createFileRoute("/networks")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "TV Networks — Layar Emas" },
      { name: "description", content: "Browse TV networks and discover their movies and series." },
      { property: "og:title", content: "TV Networks — Layar Emas" },
      {
        property: "og:description",
        content: "Browse TV networks and discover their movies and series.",
      },
    ],
  }),
  component: NetworksPage,
});

function NetworksPage() {
  const [search, setSearch] = useState("");
  const filtered = NETWORKS.filter((network) =>
    `${network.name} ${network.country}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:px-8">
      <PageHero title="TV Networks" eyebrow="Discover" description="Browse major networks and open a collection to see its associated TV shows and movies." />
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
            <Radio className="h-4 w-4" /> Discover
          </p>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">TV Networks</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Browse a curated directory of major networks. Open a network to see its TV shows and
            movies associated with its production company when TMDB provides a match.
          </p>
        </div>
        <label className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search networks"
            aria-label="Search networks"
            className="pl-9"
          />
        </label>
      </div>
      <AdSlot placement="collection_top" />
      {filtered.length ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((network) => (
            <Link
              key={network.id}
              to="/collection/$kind/$id"
              params={{ kind: "network", id: String(network.id) }}
              className="group flex min-h-32 flex-col justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary hover:bg-accent/70"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Radio className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold group-hover:text-primary">
                  {network.name}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{network.country}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">No networks match your search.</p>
      )}
      <AdSlot placement="collection_bottom" />
    </div>
  );
}
