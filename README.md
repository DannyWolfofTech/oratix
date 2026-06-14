# Oratix

A browser-based **teleprompter + camera recorder** PWA, in Romanian. Write or
paste a script, scroll it hands-free at an adjustable speed, and optionally
record yourself with the front camera while you read. Recordings can be
downloaded or shared straight to other apps. Works fully offline and installs
to the home screen.

## Tech stack

- **Vite** + **React 19** + **TypeScript** (strict)
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **Supabase** for optional auth + cloud sync (the app is fully usable without it)
- **vite-plugin-pwa** (Workbox) for offline support and update prompts
- **Vitest** + **Testing Library** for tests
- Package manager: **bun**

## Getting started

```sh
bun install
bun run dev        # http://localhost:8080
```

> The dev server binds to `::` (IPv6) by default. On hosts without IPv6, run
> `bun run dev -- --host 127.0.0.1`.

### Environment variables

Copy `.env.example` to `.env` and fill in your values:

| Variable                         | Purpose                                             |
| -------------------------------- | --------------------------------------------------- |
| `VITE_SUPABASE_URL`              | Supabase project URL                                |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | Supabase anon/publishable key (public by design)    |
| `VITE_SUPABASE_PROJECT_ID`       | Supabase project ref                                |

`.env` is gitignored. **Cloud sync is optional** — if these are unset the app
runs in local-only mode (scripts live in `localStorage`) and the sign-in entry
point is hidden.

## Scripts

| Command               | Description                                  |
| --------------------- | -------------------------------------------- |
| `bun run dev`         | Start the dev server                         |
| `bun run build`       | Production build (emits a service worker)    |
| `bun run preview`     | Preview the production build                 |
| `bun run typecheck`   | Type-check with `tsc` (app + node configs)   |
| `bun run lint`        | ESLint                                       |
| `bun run lint:fix`    | ESLint with autofix                          |
| `bun run format`      | Prettier write                               |
| `bun run test`        | Run the Vitest suite                         |
| `bun run test:watch`  | Vitest in watch mode                         |

CI (`.github/workflows/ci.yml`) runs typecheck → lint → test → build on every
push to `main` and on pull requests.

## Data model & sync

Scripts are stored locally in `localStorage` and work offline. When Supabase is
configured and a user signs in (email magic-link):

- Local/anonymous scripts are **claimed** into the account on first sign-in.
- Reads/writes are mirrored to the `scripts` table; the newer `updated_at` wins
  on conflict (see `src/lib/scriptsSync.ts`).
- Each account's offline cache is namespaced per user, so two accounts on the
  same device never see each other's scripts.

Row Level Security scopes every row to its owner (`auth.uid() = user_id`). See
`supabase/migrations/` for the schema, policies, and indexes.

## Project layout

```
src/
  components/        UI + feature components (TeleprompterView, recording, dialogs)
  components/ui/     shadcn/ui primitives
  hooks/             useScripts (data layer), useAuth, useInstallPrompt, ...
  lib/               recording.ts (MediaRecorder helpers), scriptsSync.ts
  integrations/      Supabase client + generated types
  pages/             Index, NotFound
supabase/migrations/ SQL schema, RLS policies, indexes
```

## Deployment

`bun run build` outputs a static site in `dist/` (including `sw.js` and
`manifest.webmanifest`). Host it on any static host (Vercel, Netlify, Cloudflare
Pages, etc.). Set the `VITE_SUPABASE_*` environment variables in the host if you
want cloud sync.
