import { db } from "./db";
import { getGooglePlacesApiKey } from "./config";

export interface GeocodeResult {
  lat: number;
  lng: number;
}

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryType?: string;
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Check Geocode Cache
  try {
    const cached = await db.execute({
      sql: "SELECT * FROM geocode_cache WHERE query = ?",
      args: [normalizedQuery],
    });

    if (cached.rows.length > 0) {
      const row = cached.rows[0];
      console.log(`Geocode cache hit for: "${normalizedQuery}" -> (${row.lat}, ${row.lng})`);
      return { lat: Number(row.lat), lng: Number(row.lng) };
    }
  } catch (err) {
    console.error("Geocode cache lookup error:", err);
  }

  // 2. Perform external fetch via Google Geocoding API
  const apiKey = getGooglePlacesApiKey();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  console.log(`Calling Google Geocoding API for: "${query}"`);
  
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Google geocoding failed: ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    return null;
  }

  const lat = data.results[0].geometry.location.lat;
  const lng = data.results[0].geometry.location.lng;

  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  // 3. Update Cache permanently
  try {
    await db.execute({
      sql: "INSERT OR REPLACE INTO geocode_cache (query, lat, lng, timestamp) VALUES (?, ?, ?, ?)",
      args: [normalizedQuery, lat, lng, new Date().toISOString()],
    });
  } catch (err) {
    console.error("Failed to write geocode cache:", err);
  }

  return { lat, lng };
}

export async function queryGooglePlaces(
  lat: number,
  lng: number,
  radiusM: number,
  niche: string
): Promise<GooglePlace[] | null> {
  const apiKey = getGooglePlacesApiKey();
  const endpoint = "https://places.googleapis.com/v1/places:searchText";

  const requestBody = {
    textQuery: niche,
    locationRestriction: {
      circle: {
        center: {
          latitude: lat,
          longitude: lng
        },
        radius: radiusM
      }
    }
  };

  console.log(`Querying Google Places API (searchText) for "${niche}" at (${lat}, ${lng}) r=${radiusM}`);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.primaryType",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Google Places API error ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json();
    return data.places || [];
  } catch (err: any) {
    console.error(`Google Places request failed:`, err.message || err);
    return null;
  }
}
