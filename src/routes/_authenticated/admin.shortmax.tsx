import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { EyeOff, Eye, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { listShortMaxApiKeys, saveShortMaxApiKey, deleteShortMaxApiKey } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/shortmax")({
  head: () => ({ meta: [
    { title: "ShortMax API keys — Layar Emas" },
    { name: "description", content: "Manage ShortMax (apishort) API keys for short drama listings." },
    { property: "og:title", content: "ShortMax API keys — Layar Emas" },
    { property: "og:description", content: "Manage ShortMax API keys for short drama listings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminShortMaxKeys,
});

type ShortMaxApiKey = {
  id: string;
  name: string;
  apiKey: string;
  isActive: boolean;
  requestsToday: number;
  requestDate: string;
};

function AdminShortMaxKeys() {
  const qc = useQueryClient();
  const list = useServerFn(listShortMaxApiKeys);
  const save = useServerFn(saveShortMaxApiKey);
  const remove = useServerFn(deleteShortMaxApiKey);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin-shortmax-api-keys"],
    queryFn: () => list(),
  });
  const [form, setForm] = useState<ShortMaxApiKey>({
    id: "",
    name: "",
    apiKey: "",
    isActive: true,
    requestsToday: 0,
    requestDate: new Date().toISOString().slice(0, 10),
  });
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-shortmax-api-keys"] });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({ data: { id: form.id || undefined, name: form.name, apiKey: form.apiKey, isActive: form.isActive } });
      setForm({ id: "", name: "", apiKey: "", isActive: true, requestsToday: 0, requestDate: today });
      await refresh();
      toast.success("ShortMax API key saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: ShortMaxApiKey) {
    try {
      await save({ data: { id: key.id, name: key.name, apiKey: key.apiKey, isActive: !key.isActive } });
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function removeKey(key: ShortMaxApiKey) {
    if (!confirm(`Delete ShortMax API key "${key.name}"?`)) return;
    try {
      await remove({ data: { id: key.id } });
      await refresh();
      toast.success("ShortMax API key removed");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-destructive">Could not load ShortMax API keys.</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-bold">ShortMax API keys</h1>
        <Button variant="secondary" onClick={() => setForm({ id: "", name: "", apiKey: "", isActive: true, requestsToday: 0, requestDate: today })}>
          <Plus /> New key
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Keys are used round-robin across all active keys. Each key is limited to <b>100 requests/day</b>; once
        a key reaches the daily limit the next active key is used automatically.
      </p>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{form.id ? "Edit key" : "Add key"}</h2>
          <Button type="submit" variant="hero" disabled={busy || !form.name.trim() || !form.apiKey.trim()}>
            <Save /> {busy ? "Saving…" : "Save key"}
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="shortmax-key-name">Name</Label>
          <Input id="shortmax-key-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} placeholder="e.g. ShortMax production key 1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shortmax-key">API key</Label>
          <Input
            id="shortmax-key"
            type={showSecret ? "text" : "password"}
            autoComplete="new-password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            maxLength={4096}
            placeholder="vbs_…"
            required
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecret(!showSecret)}>
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="shortmax-key-active">Active</Label>
          <Switch id="shortmax-key-active" checked={form.isActive} onCheckedChange={(isActive) => setForm({ ...form, isActive })} />
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Saved keys</h2>
        {!data.length && <p className="text-muted-foreground">No ShortMax API keys yet.</p>}
        {data.map((key) => (
          <div key={key.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{key.name}</p>
              <p className="text-xs text-muted-foreground">
                {key.requestsToday}/100 requests today · {key.requestDate} · {key.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            <Switch
              aria-label={`Activate ${key.name}`}
              checked={key.isActive}
              onCheckedChange={() => toggle(key)}
            />
            <Button size="icon" variant="ghost" aria-label={`Edit ${key.name}`} title="Edit key" onClick={() => setForm(key)}>
              <Save />
            </Button>
            <Button size="icon" variant="ghost" aria-label={`Delete ${key.name}`} title="Delete key" onClick={() => removeKey(key)}>
              <Trash2 />
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
