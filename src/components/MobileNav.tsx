import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  CalendarDays,
  Clapperboard,
  Globe,
  Home,
  Layers,
  LayoutGrid,
  Radio,
  Search,
  Sparkles,
  Tags,
  Tv,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

const MENU = [
  { to: "/", label: "Home", icon: Home },
  { to: "/movies", label: "Movies", icon: Clapperboard },
  { to: "/tv-shows", label: "TV Shows", icon: Tv },
  { to: "/tv-shows", label: "Anime", icon: Sparkles, search: { genre: "16", country: "JP" } },
  { to: "/genres", label: "Genre", icon: Tags },
  { to: "/years", label: "Years", icon: CalendarDays },
  { to: "/countries", label: "Country", icon: Globe },
  { to: "/collections", label: "Collections", icon: Layers },
  { to: "/party", label: "Watch Party", icon: Users },
  { to: "/networks", label: "Networks", icon: Radio },
] as const;

export function MobileNav() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const item = "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground";
  const active = { className: "text-primary" };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
          <Home className="h-5 w-5" /> Home
        </Link>
        <button type="button" className={item} onClick={() => setSearch(true)}>
          <Search className="h-5 w-5" /> Search
        </button>
        <button type="button" className={item} onClick={() => setMenu(true)}>
          <LayoutGrid className="h-5 w-5" /> Menu
        </button>
        <Link to="/watchlist" className={item} activeProps={active}>
          <Bookmark className="h-5 w-5" /> Saved
        </Link>
        <Link to={user ? "/account" : "/login"} className={item} activeProps={active}>
          <User className="h-5 w-5" /> {user ? "Profile" : "Sign in"}
        </Link>
      </nav>

      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Browse</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 p-4">
            {MENU.map((entry) => {
              const { to, label, icon: Icon } = entry;
              const className =
                "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold";
              const content = (
                <>
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </>
              );
              return "search" in entry ? (
                <Link
                  key={label}
                  to="/tv-shows"
                  search={entry.search}
                  onClick={() => setMenu(false)}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <Link key={label} to={to} onClick={() => setMenu(false)} className={className}>
                  {content}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMenu(false)}
                className="col-span-2 rounded-xl border border-primary px-4 py-3 text-center text-sm font-semibold text-primary"
              >
                Admin panel
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={search} onOpenChange={setSearch}>
        <SheetContent side="top">
          <SheetHeader>
            <SheetTitle>Search</SheetTitle>
          </SheetHeader>
          <form
            className="p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(false);
              navigate({ to: "/search", search: { q } });
            }}
          >
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search movies & shows"
            />
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
