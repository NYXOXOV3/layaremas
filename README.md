# Layar Emas

A movie and TV catalog built with TanStack Start, React, TypeScript, and Supabase.

## Requirements

- Node.js 22 or newer
- npm
- A Supabase project

## Setup

```powershell
npm ci
Copy-Item .env.example .env
```

Set the Supabase project URL and publishable key in `.env`. Add server-only keys as needed; never commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY` with a `VITE_` prefix.

The repository contains only incremental Supabase migrations, not the original baseline schema. A new Supabase project must have the application's base tables, functions, triggers, Storage buckets, and RLS policies before applying the migrations in `supabase/migrations/`.

Configure Google OAuth and the application's allowed redirect URLs in the Supabase dashboard if you want to enable Google sign-in.

## Development

```powershell
npm run dev
```

## Build

```powershell
npm run build
npm run preview
```

The application uses server-side rendering and server functions, so deploy it to a Node.js-capable host. Vercel is selected automatically on Vercel; other hosts default to Nitro's `node-server` preset. Set `NITRO_PRESET` to choose another supported Nitro target.

See [installasi.md](./installasi.md) for local and hosting instructions, and [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) for Vercel-specific setup.
