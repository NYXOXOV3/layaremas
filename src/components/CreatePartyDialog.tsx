import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Globe, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createParty } from "@/lib/party.functions";
import { createPartySchema } from "@/lib/party-invite";

export function CreatePartyDialog({
  type,
  tmdbId,
  title,
  season,
  episode,
  buttonSize = "sm",
}: {
  type: "movie" | "tv";
  tmdbId: number;
  title: string;
  season?: number;
  episode?: number;
  buttonSize?: "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [pin, setPin] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(10);
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createParty);
  const navigate = useNavigate();
  const minScheduledAt = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000 + 60_000)
    .toISOString()
    .slice(0, 16);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    if (scheduledDate && Number.isNaN(scheduledDate.getTime())) {
      toast.error("Choose a valid start time");
      return;
    }
    const parsed = createPartySchema.safeParse({
      type,
      tmdbId,
      title,
      season,
      episode,
      visibility,
      pin,
      maxCapacity,
      scheduledAt: scheduledDate?.toISOString() ?? null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check room details");
      return;
    }
    setBusy(true);
    try {
      const room = await create({ data: parsed.data });
      setOpen(false);
      setPin("");
      setScheduledAt("");
      setMaxCapacity(10);
      await navigate({ to: "/party/$code", params: { code: room.code } });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={buttonSize} variant="glass">
          <Users /> Start watch party
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Start Watch Party</DialogTitle>
        <form onSubmit={submit} className="space-y-5">
          <p className="font-display text-xl">{title}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={visibility === "public" ? "hero" : "secondary"}
              aria-pressed={visibility === "public"}
              onClick={() => setVisibility("public")}
            >
              <Globe /> Public
            </Button>
            <Button
              type="button"
              variant={visibility === "private" ? "hero" : "secondary"}
              aria-pressed={visibility === "private"}
              onClick={() => setVisibility("private")}
            >
              <Lock /> Private
            </Button>
          </div>
          {visibility === "private" && (
            <div className="space-y-2">
              <Label htmlFor="party-pin">Room PIN</Label>
              <Input
                id="party-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                minLength={4}
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="party-scheduled-at">Schedule start (optional)</Label>
            <Input
              id="party-scheduled-at"
              type="datetime-local"
              min={minScheduledAt}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to start now. Participants can enter a scheduled room early and wait. Time
              uses your local timezone.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-max-capacity">Maximum room capacity</Label>
            <Input
              id="party-max-capacity"
              type="number"
              min={2}
              max={50}
              step={1}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(Number(e.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground">
              2–50 active participants, including you as the host. Default: 10.
            </p>
          </div>
          <Button type="submit" variant="hero" disabled={busy}>
            <Users />
            {busy ? "Creating…" : "Create room"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
