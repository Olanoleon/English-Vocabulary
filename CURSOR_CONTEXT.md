# Cursor Context - Learner Navigation Performance

## Session Goal
Improve learner navigation responsiveness between:
- `learn` -> `learn/areas/[id]` -> `learn/sections/[id]`
- `learn/sections/[id]` <-> module pages (`intro`, `practice`, `test`)
- back navigation from modules to unit and area screens

## What Was Implemented

### 1) Section API split by view (payload reduction)
File: `src/app/api/learn/sections/[id]/route.ts`

Added `view` query modes:
- `summary`: lightweight section card data + module metadata and question counts
- `intro`: introduction module + section vocabulary
- `practice`: practice module + questions/options
- `test`: test module + questions/options
- fallback/default keeps full behavior for compatibility

Updated callers:
- `src/app/learn/sections/[id]/page.tsx` -> `?view=summary`
- `src/app/learn/sections/[id]/intro/page.tsx` -> `?view=intro`
- `src/app/learn/sections/[id]/practice/page.tsx` -> `?view=practice`
- `src/app/learn/sections/[id]/test/page.tsx` -> `?view=test`

### 2) Client-side learner cache (faster repeated navigation)
New file: `src/lib/learn-client-cache.ts`

Cache behavior:
- in-memory cache with TTL (2 minutes)
- request de-duplication to avoid duplicated concurrent requests
- caches:
  - areas list
  - sections list by `areaId`

Integrated in:
- `src/app/learn/page.tsx`
- `src/app/learn/areas/[id]/page.tsx`

Resulting UX behavior:
- first (cold) visit still pays network/API cost
- repeated back-and-forth in same session feels much faster due to cache hits

## Measured Results (latest session)

### Navigation benchmark (logged-in learner flow)
- cold navigation median: ~887ms
- warm navigation median: ~106ms

### API benchmark (authenticated, repeated calls)
- `/api/learn/areas`: ~485ms median
- `/api/learn/sections?areaId=...`: ~307ms median
- `/api/learn/sections/[id]?view=summary`: ~596ms median
- `/api/learn/sections/[id]?view=intro`: ~598ms median
- `/api/learn/sections/[id]?view=practice`: ~698ms median
- `/api/learn/sections/[id]?view=test`: ~727ms median

Compared to prior baseline (`/api/learn/sections/[id]` full payload median ~792ms), route-specific section views are faster for summary/intro and slightly faster for practice/test.

## Remaining Bottlenecks / Next Steps
- Main remaining floor is list endpoints:
  - `/api/learn/areas`
  - `/api/learn/sections?areaId=...`
- Potential next optimization:
  - reduce DB work and derived calculations in those list routes
  - add server-side short-lived caching for learner list endpoints
  - optionally add prefetch of likely next route data on card hover/tap-start

## Quick Verification Commands
- `npm run lint -- "src/app/api/learn/sections/[id]/route.ts" "src/app/learn/sections/[id]/page.tsx" "src/app/learn/sections/[id]/intro/page.tsx" "src/app/learn/sections/[id]/practice/page.tsx" "src/app/learn/sections/[id]/test/page.tsx" "src/app/learn/page.tsx" "src/app/learn/areas/[id]/page.tsx" "src/lib/learn-client-cache.ts"`
- `npm run build`

