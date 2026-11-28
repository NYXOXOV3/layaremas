import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Tv, RefreshCw, Users, Search, Filter, Calendar, Clock, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resilientQuery } from "@/lib/resilient-query";
import { useAuth } from "@/lib/auth";
import { publicParties } from "@/lib/party.functions";
import { getDetails } from "@/lib/tmdb.functions";
import { AdSlot } from "@/components/AdSlot";
import { LocalDateTime } from "@/components/LocalDateTime";
import { tmdbImg } from "@/lib/img";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function timeUntilEnd(date: Date): string {
  const endTime = new Date(date.getTime() + 24 * 60 * 60 * 1000); // 24 hours from creation
  const seconds = Math.floor((endTime.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return "Ended";
  if (seconds < 60) return `Ends in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Ends in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Ends in ${hours}h`;
  return "Ends soon";
}

interface PartyRoom {
  code: string;
  episode: number | null;
  max_capacity: number;
  media_type: "movie" | "tv";
  scheduled_at: string | null;
  season: number | null;
  title: string | null;
  tmdb_id: number;
  viewers: number;
  host_id?: string;
  created_at?: string;
  is_active?: boolean;
  last_active_at?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  ended_at?: string | null;
  host_email?: string | null;
  host_name?: string | null;
  host_avatar?: string | null;
}

const roomsQuery = resilientQuery({
  queryKey: ["public-parties"],
  queryFn: () => publicParties(),
  fallback: [],
  refetchInterval: 15_000
});

export const Route = createFileRoute("/party")({
  loader: ({context}) => context.queryClient.ensureQueryData(roomsQuery),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Watch Party — Layar Emas" },
      { name: "description", content: "Watch together in sync with friends and chat live." },
      { property: "og:title", content: "Watch Party — Layar Emas" },
      { property: "og:description", content: "Watch together in sync with friends and chat live." },
    ],
  }),
  component: Party,
});

function Party() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "movie" | "tv">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "scheduled" | "ended">("all");
  const { data: rooms } = useQuery(roomsQuery);
  const activeRooms = rooms ?? [];

  useEffect(() => {
    const updateTime = () => setNow(Date.now());
    updateTime();
    const interval = window.setInterval(updateTime, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  // Fetch details for each room first
  const roomDetailsQueries = useQuery({
    queryKey: ["rooms-details", activeRooms.map(r => r.tmdb_id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        activeRooms.map(async (room) => {
          try {
            const details = await getDetails({ data: { type: room.media_type, id: room.tmdb_id } });
            return { ...room, poster_path: details.poster_path, backdrop_path: details.backdrop_path, title: details.title || room.title };
          } catch {
            return room;
          }
        })
      );
      return results;
    },
    enabled: activeRooms.length > 0,
    staleTime: 5 * 60_000,
  });

  const roomsWithDetails = roomDetailsQueries.data ?? activeRooms;

  // Then filter
  const filteredRooms = useMemo(() => {
    return roomsWithDetails.filter(room => {
      const matchesSearch = !search || room.title?.toLowerCase().includes(search.toLowerCase()) || room.code.toLowerCase().includes(search.toLowerCase());
      const matchesType = mediaTypeFilter === "all" || room.media_type === mediaTypeFilter;

      const isEnded = !!room.ended_at;
      const isLive = room.is_active && !isEnded;

      let matchesStatus = true;
      if (statusFilter === "live") matchesStatus = isLive;
      else if (statusFilter === "ended") matchesStatus = isEnded;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [roomsWithDetails, search, mediaTypeFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-32 md:px-8">
      {/* Header stats */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Watch Parties</h1>
        <p className="text-muted-foreground mt-1">
          {roomsWithDetails.filter(r => r.is_active && !r.ended_at).length} live rooms •
          {" "}{roomsWithDetails.reduce((sum, r) => sum + r.viewers, 0)} total viewers •
          {" "}{roomsWithDetails.filter(r => r.ended_at).length} ended rooms
        </p>
      </div>

      {/* Quick join banner */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <h2 className="text-xl font-semibold mb-3">Join a watch party</h2>
        {user ? (
          <form className="flex gap-2 max-w-sm" onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) navigate({ to: "/party/$code", params: { code: code.trim().toUpperCase() } });
          }}>
            <Input placeholder="Enter party code" value={code} onChange={(e) => setCode(e.target.value)} className="flex-1" />
            <Button type="submit" variant="hero">Join</Button>
          </form>
        ) : (
          <Button asChild variant="hero">
            <Link to="/login">Sign in to join</Link>
          </Button>
        )}
      </div>

      <AdSlot placement="party_directory_top" />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
          <Select value={mediaTypeFilter} onValueChange={(v) => setMediaTypeFilter(v as any)}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="tv">TV Shows</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or party code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => roomDetailsQueries.refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Rooms grid */}
      {roomsWithDetails.length === 0 ? (
        <div className="py-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
          <p className="mt-4 text-muted-foreground">
            {search || mediaTypeFilter !== "all" || statusFilter !== "all"
              ? "No rooms match your filters"
              : "No public rooms are watching right now"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roomsWithDetails.map(room => {
            const isEnded = !!room.ended_at;
            const isLive = room.is_active && !isEnded;
            const isFull = room.viewers >= room.max_capacity;

            return (
              <Link key={room.code} to={`/party/${room.code}`} className="group">
                <div className="rounded-xl overflow-hidden bg-card border border-border transition-all hover:shadow-lg">
                  {/* Banner image area with badges OVERLAYING the image */}
                  <div className="relative aspect-video overflow-hidden">
                    {(room.backdrop_path || room.poster_path) ? (
                      <img
                        src={tmdbImg(room.backdrop_path || room.poster_path!, "w780")}
                        alt={room.title || "Room background"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 via-card to-background" />
                    )}

                    {/* Dark gradient overlay on image for badge readability */}
                    <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent" />

                    {/* Top badges - Movie/Episode on LEFT, LIVE/FULL on RIGHT - ON TOP OF IMAGE */}
                    <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
                      {/* Media type badge - LEFT */}
                      <Badge className="bg-background/90 backdrop-blur-sm" variant="outline">
                        {room.media_type === "movie" ? (
                          <>
                            <Film className="h-3 w-3 mr-1" /> Movie
                          </>
                        ) : (
                          <>
                            <Tv className="h-3 w-3 mr-1" /> Episode
                          </>
                        )}
                      </Badge>

                      {/* Status badge - RIGHT */}
                      {room.ended_at ? (
                        <Badge className="bg-gray-500 text-gray-500-foreground">
                          <Clock className="h-3 w-3 mr-1" /> ENDED
                        </Badge>
                      ) : isLive ? (
                        isFull ? (
                          <Badge className="bg-red-500 text-red-500-foreground">
                            <Users className="h-3 w-3 mr-1" /> FULL
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500 text-green-500-foreground">
                            <Clock className="h-3 w-3 mr-1" /> LIVE
                          </Badge>
                        )
                      ) : isScheduled ? (
                        <Badge className="bg-yellow-500 text-yellow-500-foreground">
                          <Calendar className="h-3 w-3 mr-1" /> SCHEDULED
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {/* Content area BELOW banner - not overlaying */}
                  <div className="p-4 space-y-3">
                    {/* Title */}
                    <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      {room.title || "Watch Party"}
                    </h3>

                    {/* Episode/Season for TV */}
                    {room.media_type === "tv" && room.season !== null && (
                      <p className="text-sm text-muted-foreground">
                        Season {room.season}
                        {room.episode !== null && ` • Episode ${room.episode}`}
                      </p>
                    )}

                    {/* Host info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {room.host_avatar ? (
                        <img
                          src={room.host_avatar}
                          alt={room.host_name || room.host_email || "Host"}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <Users className="w-3 h-3 text-primary" />
                        </div>
                      )}
                      <span>
                        Host by: {room.host_name || room.host_email?.split("@")[0] || "Unknown"}
                      </span>
                    </div>

                    {/* Status & capacity */}
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {room.ended_at ? (
                          <>
                            <Clock className="h-3 w-3" />
                            Ended {timeAgo(new Date(room.ended_at))}
                          </>
                        ) : isLive ? (
                          <>
                            <Users className="h-3 w-3" />
                            Started {timeAgo(new Date(room.last_active_at ?? room.created_at ?? Date.now()))}
                          </>
                        ) : isScheduled ? (
                          <>
                            <Calendar className="h-3 w-3" />
                            Starts <LocalDateTime value={room.scheduled_at!} className="text-muted-foreground" />
                          </>
                        ) : (
                          "Created"
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {room.ended_at ? (
                          <span className="text-red-400">Ended by host</span>
                        ) : isLive ? (
                          <>
                            <Clock className="h-3 w-3" />
                            {timeUntilEnd(new Date(room.created_at ?? Date.now()))}
                          </>
                        ) : isScheduled ? (
                          <>
                            <Calendar className="h-3 w-3" />
                            Ends in 24h
                          </>
                        ) : (
                          "Ended"
                        )}
                      </div>
                    </div>

                    {/* End room button (host only, live rooms) */}
                    {user && isLive && !room.ended_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-red-600 hover:text-red-700"
                        onClick={async () => {
                          const { endWatchParty } = await import("@/lib/party.functions");
                          await endWatchParty({ data: { code: room.code } });
                          rooms.refetch();
                        }}
                      >
                        <Users className="h-3 w-3 mr-1" /> End Room
                      </Button>
                    )}

                    {/* Join button - full width */}
                    <Button
                      asChild
                      variant={isFull ? "outline" : "default"}
                      size="sm"
                      disabled={isFull}
                      className="w-full"
                    >
                      {user ? (
                        <span className="flex items-center justify-center">
                          {isFull ? (
                            <>
                              <Lock className="h-3 w-3 mr-1" /> Room Full
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" /> Join Room
                            </>
                          )}
                        </span>
                      ) : (
                        <Link to="/login" className="flex items-center justify-center w-full">
                          <Users className="h-3 w-3 mr-1" /> Sign in to join
                        </Link>
                      )}
                    </Button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <AdSlot placement="party_directory_bottom" />
    </div>
  );
}