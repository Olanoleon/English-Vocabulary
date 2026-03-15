import { APP_IMAGE_FALLBACK } from "@/lib/image-fallback";

const LEGACY_IMAGE_PATH_MAP: Record<string, string> = {
  "/images/library/humanbody_face.png": "/images/library/humanbody_femaleface.png",
  "/icons/app-fallback.svg": APP_IMAGE_FALLBACK,
  "/file.svg": APP_IMAGE_FALLBACK,
};

const HUMAN_AVATAR_PATHS = [
  "/images/library/humanbody_femaleface.png",
  "/images/library/humanbody_male.png",
  "/images/library/humanbody_face.png",
];

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i;

function looksLikeImagePath(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("/") ||
    IMAGE_EXT_RE.test(normalized)
  );
}

export function normalizeLearnImageUrl(value: string | null | undefined): string {
  if (!value) return APP_IMAGE_FALLBACK;

  const trimmed = value.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  if (LEGACY_IMAGE_PATH_MAP[withLeadingSlash]) {
    return LEGACY_IMAGE_PATH_MAP[withLeadingSlash];
  }

  if (!looksLikeImagePath(trimmed)) {
    return APP_IMAGE_FALLBACK;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/public/")) {
    return trimmed.replace(/^\/public/, "");
  }

  if (trimmed.startsWith("public/")) {
    return `/${trimmed.replace(/^public\//, "")}`;
  }

  return withLeadingSlash;
}

export function resolveLearnAreaImageUrl(
  areaName: string | null | undefined,
  imageUrl: string | null | undefined
): string {
  const resolved = normalizeLearnImageUrl(imageUrl);
  const normalizedName = String(areaName || "").toLowerCase();
  const isLocalLibraryPath = resolved.startsWith("/images/library/");
  const staleHumanAvatar = HUMAN_AVATAR_PATHS.some((path) => resolved.includes(path));

  const isComputerEngineeringArea =
    normalizedName.includes("computer engineering") ||
    normalizedName.includes("computer science") ||
    normalizedName.includes("software engineering") ||
    normalizedName.includes("programming") ||
    normalizedName.includes("ingenieria en computacion") ||
    normalizedName.includes("ingenieria de computacion") ||
    normalizedName.includes("ciencias de la computacion");

  if (isComputerEngineeringArea && !isLocalLibraryPath) {
    return "/images/library/software.png";
  }

  if (!staleHumanAvatar) return resolved;

  if (
    normalizedName.includes("human body") ||
    normalizedName.includes("cuerpo humano")
  ) {
    return "/images/library/humanbody_torso.png";
  }

  if (
    normalizedName.includes("transport") ||
    normalizedName.includes("transporte")
  ) {
    return "/images/library/transport_car.png";
  }

  return resolved;
}
