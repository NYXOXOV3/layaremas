import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Clapperboard,
  Film,
  Globe,
  Home,
  Layers,
  LogOut,
  MoreHorizontal,
  Radio,
  Search,
  Shield,
  Sparkles,
  Tags,
  Tv,
  User,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: settings } = useQuery(settingsQuery);

  // Floating pill after scrolling down; transparent bar while at the very top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Custom branding only after hydration: the server may have site settings
  // the client cache does not have yet, which would mismatch the first render.
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
        className={`mx-auto flex items-center gap-4 px-4 transition-all duration-300 md:gap-6 md:px-8 ${
          scrolled
            ? "h-14 max-w-6xl rounded-full border border-border/60 bg-background/80 shadow-glow backdrop-blur-xl"
            : "h-16 max-w-7xl rounded-none border-0 bg-transparent shadow-none backdrop-blur-none"
        }`}
      >
        <Link to="/" className="flex items-center gap-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={settings?.site_name}
              className="h-8 w-auto max-w-40 object-contain"
            />
          ) : (
            <Film className="h-6 w-6 shrink-0 text-primary" />
          )}
          <span className="font-display text-xl font-semibold">
            {mounted ? (settings?.site_name ?? "Layar Emas") : "Layar Emas"}
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex"
        >
          {(
            [
              ["/", "Home", Home],
              ["/movies", "Movies", Film],
              ["/tv-shows", "TV Shows", Tv],
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
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">{label}</span>
            </Link>
          ))}
          <Link
            to="/tv-shows"
            search={{ genre: "16", country: "JP" }}
            aria-label="Anime"
            title="Anime"
            className="flex items-center gap-1.5 rounded-full px-2 py-2 hover:bg-foreground/10 hover:text-foreground xl:px-2.5"
            activeProps={{ className: "text-primary" }}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="hidden xl:inline">Anime</span>
          </Link>
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
        <form
          className="ml-auto hidden max-w-xs sm:flex flex-1 items-center gap-2 rounded-full border border-border bg-card/60 px-3"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/search", search: { q } });
          }}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies & shows"
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Personalized recommendations"
          title="Recommendations"
        >
          <Link to="/" hash="recommendations">
            <Sparkles />
          </Link>
        </Button>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="glass" size="sm" className="ml-auto rounded-full sm:ml-0">
                <User />
                <span className="hidden max-w-32 truncate sm:inline">{user.email}</span>
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
          <Button asChild variant="hero" size="sm" className="ml-auto rounded-full sm:ml-0">
            <Link to="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
