# Orange Alliance

React/Vite FTC data app inspired by The Blue Alliance, with FTC-specific advancement visibility and Statbotics-style point-unit EPA analytics.

## Run

```bash
npm install
npm run dev
```

Mock backend:

```bash
npm run server
```

Supabase-backed backend reads:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
npm run server
```

Or put those values in `.env.local`; the backend loads that file automatically.

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
