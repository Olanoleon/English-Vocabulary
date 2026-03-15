# Cursor Context - Project Quick Map

Use this file as the first read in new sessions. It is a fast map of how the app is structured, where key logic lives, and what to change for common tasks.

## Product Scope
- Mobile-first English vocabulary platform for Spanish-speaking learners.
- Two major surfaces:
  - Learner app (`/learn/...`)
  - Admin app (`/admin/...`)
- Data model built around:
  - Areas of knowledge
  - Sections (units) inside areas
  - Modules per section (`introduction`, `practice`, `test`)
  - Learner progress and attempts

## Stack Snapshot
- Next.js 16 App Router + TypeScript
- Prisma 7 + Neon Postgres
- Tailwind CSS 4
- Session auth with `iron-session`
- UI icons with `lucide-react`

## High-Signal File Map

### Core infra
- `src/lib/db.ts`
  - Prisma client singleton and Neon websocket setup.
- `src/lib/auth.ts`
  - Session helpers and auth guards.
- `src/proxy.ts`
  - Route protection / auth redirects.
- `prisma/schema.prisma`
  - Canonical data model.

### Learner APIs
- `src/app/api/learn/areas/route.ts`
  - Returns learner-visible areas.
  - Uses image URL normalization helpers.
- `src/app/api/learn/sections/route.ts`
  - Returns sections for an area (`areaId` query).
- `src/app/api/learn/sections/[id]/route.ts`
  - Returns section detail.
  - Supports `view` query mode:
    - `summary`
    - `intro`
    - `practice`
    - `test`
    - default full response
- `src/app/api/learn/progress/route.ts`
  - Writes intro/practice completion.
- `src/app/api/learn/attempts/route.ts`
  - Writes/reads test/practice attempts and scores.

### Learner pages
- `src/app/learn/page.tsx`
  - Areas list (entry screen).
  - Uses client cache for areas.
- `src/app/learn/areas/[id]/page.tsx`
  - Area detail with section cards.
  - Uses client cache for area sections + areas list.
- `src/app/learn/sections/[id]/page.tsx`
  - Unit overview cards (Intro, Practice, Unit Test).
  - Fetches section via `?view=summary`.
- `src/app/learn/sections/[id]/intro/page.tsx`
  - Introduction module page.
  - Fetches section via `?view=intro`.
- `src/app/learn/sections/[id]/practice/page.tsx`
  - Practice module page.
  - Fetches section via `?view=practice`.
- `src/app/learn/sections/[id]/test/page.tsx`
  - Test module page.
  - Fetches section via `?view=test`.
- `src/app/learn/sections/[id]/test/review/page.tsx`
  - Review last test attempt.

### Admin pages (high-touch)
- `src/app/admin/areas/[id]/page.tsx`
- `src/app/admin/sections/[id]/page.tsx`
- `src/app/admin/learners/page.tsx`
- `src/app/admin/payments/page.tsx`
- `src/app/admin/orgs/page.tsx`

### Image and fallback system
- `src/data/image-library.json`
  - Curated local image metadata and tags.
- `src/lib/unit-image.ts`
  - Unit image resolution strategy (library + Unsplash fallback chain).
- `src/lib/learn-image-url.ts`
  - Learner-side image URL normalization/remapping.
- `src/lib/image-fallback.ts`
  - Global fallback constant (`english_flags.png`).
- `public/images/library/*`
  - Library assets.

### New performance cache
- `src/lib/learn-client-cache.ts`
  - In-memory client cache with 2-minute TTL.
  - Request de-duplication for concurrent fetches.
  - Caches:
    - learner areas list
    - area sections list by `areaId`
  - Main purpose: speed up repeated learner redirections/back navigation.

## Key Functions Worth Knowing
- `loadAreasWithCache()` in `src/lib/learn-client-cache.ts`
- `loadAreaSectionsWithCache()` in `src/lib/learn-client-cache.ts`
- `normalizeLearnImageUrl()` in `src/lib/learn-image-url.ts`
- `resolveLearnAreaImageUrl()` in `src/lib/learn-image-url.ts`
- `getUnitImageByTitle()` in `src/lib/unit-image.ts`

## Current Navigation Performance Notes
- Cold learner navigation still pays API cost.
- Warm navigation (same session, back-and-forth) is much faster due to client cache hits.
- Section detail API is now split by `view` so pages fetch only required payload.

## Known Remaining Bottlenecks
- List endpoints are still the main floor:
  - `/api/learn/areas`
  - `/api/learn/sections?areaId=...`
- Future optimization candidates:
  - reduce DB work on list endpoints
  - short-lived server caching for learner list responses
  - client prefetch of likely next route data

## Environment Variables (important)
- `DATABASE_URL`
- `SESSION_SECRET`
- `UNSPLASH_ACCESS_KEY` (if Unsplash fallback is enabled)
- `IMAGE_LIBRARY_ONLY`
- `UNSPLASH_IMAGE_STYLE` (currently no cartoon fallback chain)

## Typical Verification Commands
- `npm run lint`
- `npm run build`
- `npm run dev`

## Session Handoff Rule
When finishing a substantial task, update this file with:
- what changed
- where it changed (file list)
- behavior impact
- unresolved risks / next best step

