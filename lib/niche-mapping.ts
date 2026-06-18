export const NICHE_TAGS: Record<string, string[]> = {
  "dental clinic": ['["amenity"="dentist"]'],
  "dentist": ['["amenity"="dentist"]'],
  "restaurant": ['["amenity"="restaurant"]'],
  "gym": ['["leisure"="fitness_centre"]'],
  "salon": ['["shop"="hairdresser"]'],
  "hairdresser": ['["shop"="hairdresser"]'],
  "cafe": ['["amenity"="cafe"]'],
  "pharmacy": ['["amenity"="pharmacy"]'],
  "clinic": ['["amenity"="clinic"]'],
  "hospital": ['["amenity"="hospital"]'],
  "hotel": ['["tourism"="hotel"]'],
};

export function getNicheTags(nicheInput: string): { tags: string[]; isBestEffort: boolean } {
  const clean = nicheInput.toLowerCase().trim();

  // 1. Direct match
  if (NICHE_TAGS[clean]) {
    return { tags: NICHE_TAGS[clean], isBestEffort: false };
  }

  // 2. Case-insensitive partial match
  const matchingKey = Object.keys(NICHE_TAGS).find(
    (key) => key.includes(clean) || clean.includes(key)
  );
  if (matchingKey) {
    return { tags: NICHE_TAGS[matchingKey], isBestEffort: false };
  }

  // 3. Fallback: generic name-based query
  // Clean inputs of quotes or backslashes to prevent broken Overpass syntax
  const safeNiche = clean.replace(/["\\]/g, "");
  return {
    tags: [`["name"~"${safeNiche}",i]`],
    isBestEffort: true,
  };
}
