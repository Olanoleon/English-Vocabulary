import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import imageLibrary from "@/data/image-library.json";
import { APP_IMAGE_FALLBACK } from "@/lib/image-fallback";

export const APP_FALLBACK_UNIT_IMAGE = APP_IMAGE_FALLBACK;

interface UnsplashPhoto {
  urls?: {
    small?: string;
    regular?: string;
  };
}

interface UnitImageOptions {
  strict?: boolean;
  style?: ImageStyle;
  kind?: "area" | "section";
}

type ImageStyle = "photo_clean" | "illustration_flat" | "illustration_3d";

const UNSPLASH_STYLE_CHAIN: ImageStyle[] = [
  "illustration_3d",
  "illustration_flat",
  "photo_clean",
];

interface LibraryImageEntry {
  id: string;
  path: string;
  kind?: "area" | "section" | "any";
  title?: string;
  aliases?: string[];
  tags?: string[];
  priority?: number;
  enabled?: boolean;
}

function normalizeTitleQuery(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeForMatch(value)
    .split(" ")
    .map((v) => v.trim())
    .filter((v) => v.length > 1);
}

function resolveLocalPublicPath(imagePath: string): string {
  const normalized = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
  return path.resolve(process.cwd(), "public", normalized);
}

function pickFromLibrary(
  rawTitle: string,
  options: UnitImageOptions
): string | null {
  const entries = (imageLibrary as LibraryImageEntry[]).filter(
    (entry) => entry.enabled !== false
  );
  if (entries.length === 0) return null;

  const title = normalizeForMatch(rawTitle);
  const titleTokens = tokenize(rawTitle);

  let bestScore = -1;
  let bestPath: string | null = null;

  for (const entry of entries) {
    if (!entry.path) continue;
    if (
      options.kind &&
      entry.kind &&
      entry.kind !== "any" &&
      entry.kind !== options.kind
    ) {
      continue;
    }

    const localPath = resolveLocalPublicPath(entry.path);
    if (!fs.existsSync(localPath)) continue;

    const corpus = [
      entry.title || "",
      ...(entry.aliases || []),
      ...(entry.tags || []),
    ]
      .join(" ")
      .trim();
    if (!corpus) continue;

    const normalizedCorpus = normalizeForMatch(corpus);
    const corpusTokens = new Set(tokenize(corpus));
    const normalizedTitle = entry.title ? normalizeForMatch(entry.title) : "";
    const aliasSet = new Set(
      (entry.aliases || []).map((alias) => normalizeForMatch(alias))
    );

    let score = 0;
    let semanticHit = false;

    if (normalizedTitle && title === normalizedTitle) {
      score += 140;
      semanticHit = true;
    }
    if (aliasSet.has(title)) {
      score += 130;
      semanticHit = true;
    }
    if (normalizedTitle && title.includes(normalizedTitle)) {
      score += 80;
      semanticHit = true;
    }
    if (title.length > 1 && normalizedCorpus.includes(title)) {
      score += 60;
      semanticHit = true;
    }

    let tokenHits = 0;
    for (const token of titleTokens) {
      if (corpusTokens.has(token)) {
        tokenHits += 1;
      }
    }
    if (tokenHits > 0) {
      semanticHit = true;
    }
    score += tokenHits * 10;
    if (titleTokens.length > 0 && tokenHits === titleTokens.length) {
      score += 30;
    }

    // Reject entries that only score by priority and have no semantic overlap.
    if (!semanticHit) {
      continue;
    }

    score += entry.priority || 0;

    if (score > bestScore) {
      bestScore = score;
      bestPath = entry.path.startsWith("/") ? entry.path : `/${entry.path}`;
    }
  }

  return bestScore >= 40 ? bestPath : null;
}

function normalizeStyle(style?: string): ImageStyle {
  const raw = (style || "").trim().toLowerCase();
  if (raw === "illustration_3d") return "illustration_3d";
  if (raw === "illustration_flat") return "illustration_flat";
  if (raw === "photo_clean") return "photo_clean";
  // Legacy values like "cartoon" now map to the new default chain start.
  return "illustration_3d";
}

function getDefaultImageStyle(): ImageStyle {
  const envStyle = process.env.UNSPLASH_IMAGE_STYLE || "";
  // New default chain starts from 3D illustrations.
  return envStyle ? normalizeStyle(envStyle) : "illustration_3d";
}

function buildStyleQuery(baseQuery: string, style: ImageStyle): string {
  if (style === "illustration_3d") {
    return `${baseQuery} 3d render icon style clean background`;
  }
  if (style === "illustration_flat") {
    return `${baseQuery} flat vector illustration minimal clean`;
  }
  return `${baseQuery} clean studio photo soft light minimal background`;
}

function getUnsplashAccessKey(): string {
  const envKey = (process.env.UNSPLASH_ACCESS_KEY || "").trim();
  if (envKey) return envKey;

  const envFiles = [
    ".env.development.local",
    ".env.development",
    ".env.local",
    ".env",
  ];

  for (const filename of envFiles) {
    try {
      const envPath = path.resolve(process.cwd(), filename);
      if (!fs.existsSync(envPath)) continue;
      const parsed = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
      const value = (parsed.UNSPLASH_ACCESS_KEY || "").trim();
      if (value) return value;
    } catch {
      // Continue to next candidate file.
    }
  }

  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^UNSPLASH_ACCESS_KEY=["']?([^"'\r\n]+)["']?/m);
    if (match?.[1]) return match[1].trim();
  } catch {
    // Fallback to process.env
  }
  return "";
}

/**
 * Returns a unit illustration URL from provider or a local app fallback.
 * Uses Unsplash when UNSPLASH_ACCESS_KEY is configured.
 */
export async function getUnitImageByTitle(
  title: string,
  options: UnitImageOptions = {}
): Promise<string> {
  const strict = options.strict === true;
  const libraryMatch = pickFromLibrary(title, options);
  if (libraryMatch) {
    return libraryMatch;
  }

  const useLibraryOnly = process.env.IMAGE_LIBRARY_ONLY === "true";
  if (useLibraryOnly) {
    if (strict) {
      throw new Error(
        "No matching image found in local image library. Add one in src/data/image-library.json and public/images/library."
      );
    }
    return APP_FALLBACK_UNIT_IMAGE;
  }

  const preferredStyle = options.style || getDefaultImageStyle();
  const styleChain = [
    preferredStyle,
    ...UNSPLASH_STYLE_CHAIN.filter((style) => style !== preferredStyle),
  ];
  const accessKey = getUnsplashAccessKey();
  if (!accessKey) {
    if (strict) {
      throw new Error(
        "UNSPLASH_ACCESS_KEY is missing. Add it to .env and restart the server."
      );
    }
    return APP_FALLBACK_UNIT_IMAGE;
  }

  const query = normalizeTitleQuery(title);
  if (!query) {
    if (strict) {
      throw new Error("Unit title is empty. Cannot fetch illustration.");
    }
    return APP_FALLBACK_UNIT_IMAGE;
  }

  try {
    for (const style of styleChain) {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", buildStyleQuery(query, style));
      url.searchParams.set("per_page", "8");
      url.searchParams.set("orientation", "squarish");
      url.searchParams.set("content_filter", "high");

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          "Accept-Version": "v1",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        if (strict) {
          const errorText = await res.text();
          throw new Error(
            `Unsplash request failed (${res.status}). ${errorText.slice(0, 180)}`
          );
        }
        return APP_FALLBACK_UNIT_IMAGE;
      }

      const data = (await res.json()) as { results?: UnsplashPhoto[] };
      const candidate = (data.results || [])
        .map((item) => item.urls?.regular || item.urls?.small || "")
        .find((v) => typeof v === "string" && v.length > 0);

      if (candidate) {
        return candidate;
      }
    }

    if (strict) {
      throw new Error(
        "No illustration found for this title in Unsplash after trying illustration_3d, illustration_flat, and photo_clean."
      );
    }

    return APP_FALLBACK_UNIT_IMAGE;
  } catch (error) {
    if (strict) {
      if (error instanceof Error) throw error;
      throw new Error("Failed to fetch illustration from Unsplash.");
    }
    return APP_FALLBACK_UNIT_IMAGE;
  }
}

