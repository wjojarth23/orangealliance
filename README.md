# Orange Alliance

React/Vite FTC data app inspired by The Blue Alliance, with FTC-specific advancement visibility and Statbotics-style point-unit EPA analytics.

## Run

```bash
npm install
npm run dev
```

`npm run dev` starts both pieces needed for local work:

- Vite frontend on `http://127.0.0.1:5173`
- API backend on `http://127.0.0.1:8787`

The frontend calls `/api/*`; locally Vite proxies those requests to the backend, and on Vercel the same paths are served by Vercel Functions.

## Environment

Create `.env.local` for local development:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key-for-server-sync-only
FIRST_FTC_USERNAME=your-first-username
FIRST_FTC_AUTH_TOKEN=your-first-authorization-token
```

Only these are required for deployed read-only pages:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`SUPABASE_SECRET_KEY`, `FIRST_FTC_USERNAME`, and `FIRST_FTC_AUTH_TOKEN` are only needed for syncing data into Supabase.

## Deploy To Vercel

1. Import this repo in Vercel.
2. Use the default framework detection for Vite, or set:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add Vercel environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - optional for sync/admin jobs: `SUPABASE_SECRET_KEY`, `FIRST_FTC_USERNAME`, `FIRST_FTC_AUTH_TOKEN`
4. Deploy.

After deploy, check:

```bash
https://your-vercel-domain.vercel.app/api/health
```

It should return `"source":"supabase"` when the Supabase read variables are configured.

## Data Sync

Run this locally when you need to populate or refresh Supabase:

```bash
npm run sync
```

## Current Features

- Search teams, events, years, cities, and event codes.
- Event pages with matches, rankings, playoffs, advancement, predicted seeds, and qualification odds.
- Team pages with EPA, normalized EPA, record, events, and matches.
- EPA leaderboard and alliance sum leaderboard.
- Match-level predictions with expected scores and win probability.
- Botworthy record book for highest combined score, highest clean alliance score, and highest score with foul points.
- FIRST FTC API/backend integration plan.

## Production Backend

The FIRST FTC API key should not be placed in React. Use a backend server to store the key, sync data, compute EPA, and serve frontend-safe JSON.

Suggested tables:

- teams
- seasons
- events
- event_teams
- matches
- rankings
- advancement
- team_matches
- epa_snapshots

Suggested API:

- `GET /api/seasons`
- `GET /api/events?year=2025`
- `GET /api/events/:code`
- `GET /api/events/:code/matches`
- `GET /api/events/:code/rankings`
- `GET /api/teams/:number`
- `GET /api/epa/teams`
- `GET /api/records`

Supabase setup files:

- `docs/supabase_schema.sql`
- `docs/supabase_setup.md`
