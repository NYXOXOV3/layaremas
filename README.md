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

For a fresh Supabase project, apply the SQL migrations in `supabase/migrations/` in filename order. The first file creates the baseline schema; later files add features. Do not apply the baseline to a database already in use. See [installasi.md](./installasi.md) for the full setup and migration steps.

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
