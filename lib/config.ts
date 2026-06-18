export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

export const MAX_CELLS_PER_SEARCH = 10;
export const NOMINATIM_MIN_SPACING_MS = 1100; // 1.1s gap
export const CACHE_FRESHNESS_DAYS = 30;

export function getUserAgent(): string {
  const contactEmail = process.env.CONTACT_EMAIL;
  if (!contactEmail) {
    throw new Error("Missing environment variable: CONTACT_EMAIL");
  }
  return `DentalLeadFinder/1.0 (internal tool; contact: ${contactEmail})`;
}
