import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { Film, LogOut, User, Users, Shield, Clapperboard, Home, Tv, Tags, Sparkles, MoreHorizontal, Radio, CalendarDays, Globe, Layers, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: settings } = useQuery(settingsQuery);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMounted(true), []);
  const showBranding = mounted && !!settings?.logo_url;
  const logoUrl = showBranding ? (settings?.logo_url ?? undefined) : undefined;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <header
      className={`fixed inset-x-0 z-40 transition-all duration-300 ${scrolled ? "top-3" : "top-0"}`}
    >
      <div
        className={`mx-auto flex items-center gap-4 px-4 transition-all duration-300 md:px-8 ${
          scrolled
            ? "h-14 max-w-6xl rounded-full border border-border/60 bg-background/80 shadow-glow backdrop-blur-xl"
            : "h-16 max-w-7xl rounded-none border-0 bg-transparent shadow-none backdrop-blur-none"
        }`}
      >
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={settings?.site_name}
              className="h-8 w-auto max-w-40 object-contain"
            />
          ) : (
            <Film className="h-6 w-6 shrink-0 text-primary" />
          )}
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex flex-1 justify-center"
        >
          {(
            [
              ["/", "Home", Home],
              ["/movies", "Movies", Film],
              ["/tv-shows", "TV Shows", Tv],
              ["/anime", "Anime", Sparkles],
              ["/genres", "Genre", Tags],
              ["/party", "Watch Party", Users],
            ] as const
          ).map(([to, label, Icon]) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              title={label}
              className="flex items-center gap-1.5 rounded-full px-2 py-2 hover:bg-foreground/10 hover:text-foreground xl:px-2.5"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: to !== "/anime" }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">{label}</span>
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="More browsing options"
                title="More"
                className="gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground xl:px-2.5"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden xl:inline">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link to="/networks">
                  <Radio className="mr-2 h-4 w-4" /> Networks
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/years">
                  <CalendarDays className="mr-2 h-4 w-4" /> Years
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/countries">
                  <Globe className="mr-2 h-4 w-4" /> Country
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/collections">
                  <Layers className="mr-2 h-4 w-4" /> Collections
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open search"
              title="Search"
              className="hidden lg:flex"
            >
              <Search />
            </Button>
          </DialogTrigger>
          <DialogContent className="top-24 translate-y-0 sm:top-28">
            <DialogHeader>
              <DialogTitle>Search</DialogTitle>
            </DialogHeader>
            <form
              className="flex items-center gap-2 rounded-full border border-border bg-card px-3"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchOpen(false);
                navigate({ to: "/search", search: { q } });
              }}
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search movies & shows"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button type="submit" size="sm" variant="hero" className="rounded-full">
                Search
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="glass" size="sm" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline max-w-32 truncate">{user.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/account">Account</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/watchlist">Watchlist</Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Shield className="mr-2 h-4 w-4" /> Admin
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="hero" size="sm" className="rounded-full">
            <Link to="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}