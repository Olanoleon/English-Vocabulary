type CacheEntry<T> = {
  data: T;
  updatedAt: number;
};

const DEFAULT_TTL_MS = 2 * 60 * 1000;

let areasCache: CacheEntry<unknown> | null = null;
const sectionsCacheByArea = new Map<string, CacheEntry<unknown>>();

let areasInFlight: Promise<unknown> | null = null;
const sectionsInFlightByArea = new Map<string, Promise<unknown>>();

function isFresh(updatedAt: number, ttlMs: number) {
  return Date.now() - updatedAt <= ttlMs;
}

export function getCachedAreas<T>(ttlMs = DEFAULT_TTL_MS): T | null {
  if (!areasCache) return null;
  if (!isFresh(areasCache.updatedAt, ttlMs)) return null;
  return areasCache.data as T;
}

export function setCachedAreas<T>(data: T) {
  areasCache = { data, updatedAt: Date.now() };
}

export async function loadAreasWithCache<T>(
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCachedAreas<T>(ttlMs);
  if (cached) return cached;

  if (!areasInFlight) {
    areasInFlight = fetcher()
      .then((data) => {
        setCachedAreas(data);
        return data;
      })
      .finally(() => {
        areasInFlight = null;
      });
  }
  return (await areasInFlight) as T;
}

export function getCachedAreaSections<T>(
  areaId: string,
  ttlMs = DEFAULT_TTL_MS
): T | null {
  const entry = sectionsCacheByArea.get(areaId);
  if (!entry) return null;
  if (!isFresh(entry.updatedAt, ttlMs)) return null;
  return entry.data as T;
}

export function setCachedAreaSections<T>(areaId: string, data: T) {
  sectionsCacheByArea.set(areaId, { data, updatedAt: Date.now() });
}

export async function loadAreaSectionsWithCache<T>(
  areaId: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCachedAreaSections<T>(areaId, ttlMs);
  if (cached) return cached;

  const inFlight = sectionsInFlightByArea.get(areaId);
  if (inFlight) return (await inFlight) as T;

  const nextPromise = fetcher()
    .then((data) => {
      setCachedAreaSections(areaId, data);
      return data;
    })
    .finally(() => {
      sectionsInFlightByArea.delete(areaId);
    });

  sectionsInFlightByArea.set(areaId, nextPromise);
  return (await nextPromise) as T;
}
