# Supabase Setup

Run `docs/supabase_schema.sql` in your Supabase SQL editor.

Give the backend these environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key-for-server-sync-only
FIRST_FTC_USERNAME=your-first-username
FIRST_FTC_AUTH_TOKEN=your-first-authorization-token
```

`SUPABASE_PUBLISHABLE_KEY` is safe for public read paths that are protected by RLS. `SUPABASE_SECRET_KEY` is not browser-safe and should only be used by backend sync jobs that upsert FIRST data.

Optional browser env, only if we later decide to query public read-only tables directly from React:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

For the first real sync, the backend needs permission to upsert into all tables in the schema. The public RLS policies in the SQL file allow anonymous reads only; writes should happen through the backend with `SUPABASE_SECRET_KEY` or through tighter authenticated RLS policies if you prefer.
