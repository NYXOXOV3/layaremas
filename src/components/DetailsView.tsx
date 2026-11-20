import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  BookmarkCheck,
  Clapperboard,
  Heart,
  ListPlus,
  Play,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdSlot } from "@/components/AdSlot";
import { CreatePartyDialog } from "@/components/CreatePartyDialog";
import { MediaRow } from "@/components/MediaCard";
import { SeasonEpisodeList } from "@/components/SeasonEpisodeList";
import { tmdbImg } from "@/lib/img";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Details } from "@/lib/tmdb.functions";

export function DetailsView({ d }: { d: Details }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [trailer, setTrailer] = useState(false);
  const [season, setSeason] = useState(d.seasons[0]?.number ?? 1);
  const [episode, setEpisode] = useState(1);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [savingCollectionId, setSavingCollectionId] = useState<string | null>(null);
  const [creatingCollection, setCreatingCollection] = useState(false);

  const saved = useQuery({
    queryKey: ["watchlist-item", user?.id, d.media_type, d.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("watchlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("tmdb_id", d.id)
        .eq("media_type", d.media_type)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const favorite = useQuery({
    queryKey: ["favorite-item", user?.id, d.media_type, d.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("favorites")
        .select("tmdb_id")
        .eq("user_id", user.id)
        .eq("tmdb_id", d.id)
        .eq("media_type", d.media_type)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const collections = useQuery({
    queryKey: ["user-collections", user?.id, d.media_type, d.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { lists: [], containingTitle: [] as string[] };
      const [listsResult, itemsResult] = await Promise.all([
        supabase.from("user_collections").select("id, name").order("name"),
        supabase
          .from("user_collection_items")
          .select("collection_id")
          .eq("user_id", user.id)
          .eq("tmdb_id", d.id)
          .eq("media_type", d.media_type),
      ]);
      if (listsResult.error) throw listsResult.error;
      if (itemsResult.error) throw itemsResult.error;
      return {
        lists: listsResult.data ?? [],
        containingTitle: (itemsResult.data ?? []).map((item) => item.collection_id),
      };
    },
  });

  async function toggleSave() {
    if (!user) {
      toast.info("Sign in to save titles");
      navigate({ to: "/login" });
      return;
    }
    setSavingAction(true);
    try {
      if (saved.data) {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", user.id)
          .eq("tmdb_id", d.id)
          .eq("media_type", d.media_type);
        if (error) throw error;
        toast("Removed from watchlist");
      } else {
        const { error } = await supabase.from("watchlist").insert({
          user_id: user.id,
          tmdb_id: d.id,
          media_type: d.media_type,
          title: d.title,
          poster_path: d.poster_path,
        });
        if (error) throw error;
        toast.success("Saved to watchlist");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["watchlist-item"] }),
        qc.invalidateQueries({ queryKey: ["watchlist"] }),
      ]);
    } catch (error) {
      console.error("Could not update watchlist", error);
      toast.error("Could not update watchlist");
    } finally {
      setSavingAction(false);
    }
  }

  async function toggleFavorite() {
    if (!user) {
      toast.info("Sign in to save titles");
      navigate({ to: "/login" });
      return;
    }
    setSavingAction(true);
    try {
      if (favorite.data) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("tmdb_id", d.id)
          .eq("media_type", d.media_type);
        if (error) throw error;
        toast("Removed from favorites");
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id,
          tmdb_id: d.id,
          media_type: d.media_type,
          title: d.title,
          poster_path: d.poster_path,
        });
        if (error) throw error;
        toast.success("Added to favorites");
      }
      await qc.invalidateQueries({ queryKey: ["favorite-item", user.id] });
    } catch (error) {
      console.error("Could not update favorites", error);
      toast.error("Could not update favorites");
    } finally {
      setSavingAction(false);
    }
  }

  async function toggleCollection(collectionId: string) {
    if (!user) return;
    setSavingCollectionId(collectionId);
    try {
      const alreadyAdded = collections.data?.containingTitle.includes(collectionId) ?? false;
      if (alreadyAdded) {
        const { error } = await supabase
          .from("user_collection_items")
          .delete()
          .eq("collection_id", collectionId)
          .eq("user_id", user.id)
          .eq("tmdb_id", d.id)
          .eq("media_type", d.media_type);
        if (error) throw error;
        toast("Removed from collection");
      } else {
        const { error } = await supabase.from("user_collection_items").insert({
          collection_id: collectionId,
          user_id: user.id,
          tmdb_id: d.id,
          media_type: d.media_type,
          title: d.title,
          poster_path: d.poster_path,
        });
        if (error) throw error;
        toast.success("Added to collection");
      }
      await qc.invalidateQueries({ queryKey: ["user-collections", user.id] });
    } catch (error) {
      console.error("Could not update collection", error);
      toast.error("Could not update collection");
    } finally {
      setSavingCollectionId(null);
    }
  }

  async function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const name = newCollectionName.trim();
    if (!name) {
      toast.error("Enter a collection name");
      return;
    }
    if (name.length > 60) {
      toast.error("Collection names must be 60 characters or fewer");
      return;
    }
    setCreatingCollection(true);
    try {
      const { error } = await supabase.from("user_collections").insert({ user_id: user.id, name });
      if (error) {
        if (error.code === "23505") {
          toast.error("A collection with that name already exists");
          return;
        }
        throw error;
      }
      setNewCollectionName("");
      await qc.invalidateQueries({ queryKey: ["user-collections", user.id] });
      toast.success("Collection created");
    } catch (error) {
      console.error("Could not create collection", error);
      toast.error("Could not create collection");
    } finally {
      setCreatingCollection(false);
    }
  }

  async function shareTitle() {
    try {
      if (navigator.share) {
        await navigator.share({ title: d.title, text: d.overview, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Could not share title", error);
      toast.error("Could not share this title");
    }
  }

  const backdrop = tmdbImg(d.backdrop_path, "w1280");
  const poster = tmdbImg(d.poster_path, "w500");

  return (
    <div>
      <div className="relative min-h-[80vh] overflow-hidden">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-fade-left" />
        <div className="absolute inset-0 bg-fade-bottom" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-12 pt-28 md:flex-row md:items-end md:px-8 md:pt-40">
          {poster && (
            <img src={poster} alt={d.title} className="w-48 rounded-xl shadow-card md:w-64" />
          )}
          <div className="max-w-2xl space-y-4">
            <div className="flex flex-wrap gap-2">
              {d.genres.map((g) => (
                <Badge key={g} variant="secondary">
                  {g}
                </Badge>
              ))}
            </div>
            <h1 className="text-4xl font-bold md:text-6xl">{d.title}</h1>
            {d.tagline && <p className="font-display text-lg italic text-primary">{d.tagline}</p>}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 text-primary">
                <Star className="h-4 w-4 fill-current" /> {d.vote_average.toFixed(1)}
              </span>
              {d.date && <span>{d.date.slice(0, 4)}</span>}
              {d.runtime && <span>{d.runtime} min</span>}
            </div>
            <p className="text-muted-foreground">{d.overview}</p>

            {d.studios.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Studios & networks
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {d.studios.map((studio) => (
                    <div
                      key={`${studio.id ?? studio.name}-${studio.name}`}
                      title={studio.name}
                      className="flex h-12 min-w-20 items-center justify-center rounded-lg border border-border/60 bg-black/30 px-3"
                    >
                      {studio.logo_path ? (
                        <img
                          src={tmdbImg(studio.logo_path, "w185") ?? undefined}
                          alt={studio.name}
                          loading="lazy"
                          className="max-h-8 max-w-28 object-contain grayscale"
                        />
                      ) : (
                        <span className="text-xs font-semibold">{studio.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="hero" size="lg">
                <Link
                  to="/watch/$type/$id"
                  params={{ type: d.media_type, id: String(d.id) }}
                  search={d.media_type === "tv" ? { s: season, e: episode } : {}}
                >
                  <Play className="fill-current" /> Play
                </Link>
              </Button>
              {d.trailerKey && (
                <Button variant="glass" size="lg" onClick={() => setTrailer(true)}>
                  <Clapperboard /> Trailer
                </Button>
              )}
              <Button
                variant="glass"
                size="lg"
                onClick={toggleSave}
                disabled={savingAction || (!!user && saved.isPending)}
                aria-pressed={!!saved.data}
              >
                {saved.data ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
                {saved.data ? "In Watchlist" : "Watchlist"}
              </Button>
              <Button
                variant="glass"
                size="lg"
                onClick={toggleFavorite}
                disabled={savingAction || (!!user && favorite.isPending)}
                aria-pressed={!!favorite.data}
              >
                <Heart className={favorite.data ? "fill-current text-primary" : ""} />
                {favorite.data ? "Favorite" : "Add Favorite"}
              </Button>
              <Button
                variant="glass"
                size="lg"
                onClick={() => {
                  if (!user) {
                    toast.info("Sign in to create collections");
                    navigate({ to: "/login" });
                    return;
                  }
                  setCollectionsOpen(true);
                }}
              >
                <ListPlus /> Add to Collections
              </Button>
              <Button variant="glass" size="lg" onClick={shareTitle}>
                <Share2 /> Share
              </Button>
              {user ? (
                <CreatePartyDialog
                  type={d.media_type}
                  tmdbId={d.id}
                  title={d.title}
                  {...(d.media_type === "tv" ? { season, episode } : {})}
                  buttonSize="lg"
                />
              ) : (
                <Button variant="glass" size="lg" onClick={() => navigate({ to: "/login" })}>
                  <Users /> Start watch party
                </Button>
              )}
            </div>
            {(saved.isError || favorite.isError) && (
              <p role="alert" className="text-sm text-destructive">
                Could not load your saved title status.
              </p>
            )}
          </div>
        </div>
      </div>

      <AdSlot placement="details" />
      {d.media_type === "tv" && (
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <SeasonEpisodeList
            key={d.id}
            details={d}
            season={season}
            episode={episode}
            onSeasonChange={(nextSeason) => {
              setSeason(nextSeason);
              setEpisode(1);
            }}
            highlightCurrent={false}
          />
        </div>
      )}
      {d.cast.length > 0 && (
        <section className="mx-auto max-w-7xl space-y-3 px-4 py-8 md:px-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Cast</h2>
            <Link
              to="/cast/$type/$id"
              params={{ type: d.media_type, id: String(d.id) }}
              className="text-sm font-medium text-primary hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
            {d.cast.map((c, index) => (
              <Link
                key={`${c.id}-${index}`}
                to="/person/$id"
                params={{ id: String(c.id) }}
                className="w-24 shrink-0 text-center hover:text-primary"
              >
                <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-card">
                  {c.profile_path && (
                    <img
                      src={tmdbImg(c.profile_path, "w185") ?? undefined}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <p className="mt-2 text-xs font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.character}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="pb-12">
        <AdSlot placement="details_bottom" />
        <MediaRow title="More like this" items={d.similar} />
      </div>

      <Dialog open={trailer} onOpenChange={setTrailer}>
        <DialogContent className="max-w-4xl p-0">
          <DialogTitle className="sr-only">Trailer</DialogTitle>
          {trailer && d.trailerKey && (
            <iframe
              className="aspect-video w-full rounded-lg"
              src={`https://www.youtube.com/embed/${d.trailerKey}?autoplay=1`}
              allow="autoplay; encrypted-media; fullscreen"
              title="Trailer"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={collectionsOpen} onOpenChange={setCollectionsOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Add to Collections</DialogTitle>
          <DialogDescription>
            Create a personal collection or add this title to one you already have.
          </DialogDescription>
          <form onSubmit={createCollection} className="flex gap-2">
            <Input
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              placeholder="New collection name"
              maxLength={60}
              required
              aria-label="New collection name"
            />
            <Button
              type="submit"
              variant="hero"
              disabled={creatingCollection || !newCollectionName.trim()}
            >
              Create
            </Button>
          </form>
          {collections.isPending && (
            <p className="text-sm text-muted-foreground">Loading collections…</p>
          )}
          {collections.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not load your collections.
            </p>
          )}
          {collections.data?.lists.length === 0 &&
            !collections.isPending &&
            !collections.isError && (
              <p className="text-sm text-muted-foreground">No collections yet. Create one above.</p>
            )}
          {!!collections.data?.lists.length && (
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {collections.data.lists.map((collection) => {
                const checked = collections.data.containingTitle.includes(collection.id);
                return (
                  <label
                    key={collection.id}
                    className="flex cursor-pointer items-center gap-3 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={savingCollectionId !== null}
                      onCheckedChange={() => void toggleCollection(collection.id)}
                    />
                    <span>{collection.name}</span>
                    {savingCollectionId === collection.id && (
                      <span className="ml-auto text-xs text-muted-foreground">Saving…</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
