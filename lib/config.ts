export const MAX_CELLS_PER_SEARCH = 10;

export function getGooglePlacesApiKey(): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: GOOGLE_PLACES_API_KEY");
  }
  return apiKey;
}
