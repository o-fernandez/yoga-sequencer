# Yoga Sequencer

A local-first teaching journal for planning, refining, and teaching yoga classes. Built with Next.js (App Router), React, and Tailwind; all data lives in `localStorage`, with optional device sync through a secret link.

## What's inside

- **Library** (`app/page.tsx`) — classes, inspirations, and a self-filling cue collection, with a "Teaching ahead" strip of upcoming classes.
- **Builder** (`app/sequence/[id]/page.tsx`) — scratch pad, theme picker, peak pose, teaching log, and the section-based flow builder with breath-based timing and a sequence audit.
- **Teach mode** (`app/sequence/[id]/teach/page.tsx`) — read-only full-screen running order with wake lock, both-sides passes expanded.
- **Device sync** (`lib/sync.ts`, `app/api/sync/route.ts`) — last-write-wins merge with tombstoned deletes, backed by Upstash Redis (falls back to an in-process store in dev).
- **`lib/`** — the data layer and domain logic (pose library, sequence storage and migration, audit rules, pose matching, backups). Unit-tested with Vitest.

## Development

```bash
npm run dev    # start the dev server
npm test       # run the vitest suite
npm run lint   # eslint
```

Sync needs `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or the Vercel KV equivalents) in production; without them the `/api/sync` route returns 503 and the app stays fully usable offline-only.
