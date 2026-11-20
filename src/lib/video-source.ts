import { z } from "zod";

const excludedHosts = ["vidsrc", "2embed", "vidfast", "nontongo"];
export function validEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !excludedHosts.some((host) => url.hostname.split(".").includes(host));
  } catch { return false; }
}

export const videoSourceSchema = z.object({
  tmdb_id: z.number().int().positive(),
  media_type: z.enum(["movie", "tv"]),
  season: z.number().int().positive().nullable(),
  episode: z.number().int().positive().nullable(),
  server_id: z.string().uuid(),
  path: z.string().trim().min(1).max(1000),
  quality: z.string().max(20),
  title: z.string().max(200).nullable(),
  source_type: z.enum(["video", "embed"]).default("video"),
}).superRefine((value, ctx) => {
  if (value.source_type === "embed" && !validEmbedUrl(value.path)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["path"], message: "Use a licensed HTTPS embed URL from your own host" });
  }
});