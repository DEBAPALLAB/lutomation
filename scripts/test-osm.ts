import { geocode, queryOverpass } from "../lib/osm";

async function main() {
  console.log("--- Testing Geocode ---");
  const query = "Dibrugarh, Assam";
  const start = Date.now();
  const loc = await geocode(query);
  console.log(`Geocode result for "${query}":`, loc, `(took ${Date.now() - start}ms)`);

  if (!loc) {
    console.error("Geocoding failed!");
    return;
  }

  // Test caching by doing it again immediately
  console.log("\n--- Testing Geocode Caching ---");
  const startCache = Date.now();
  const locCached = await geocode(query);
  console.log(`Cached result:`, locCached, `(took ${Date.now() - startCache}ms)`);

  console.log("\n--- Testing Overpass Mirrors ---");
  const tags = ['["amenity"="dentist"]'];
  const startOverpass = Date.now();
  const elements = await queryOverpass(loc.lat, loc.lng, 1000, tags);
  console.log(`Found ${elements ? elements.length : "null"} elements`, `(took ${Date.now() - startOverpass}ms)`);
  if (elements && elements.length > 0) {
    console.log("First element center/details:", elements[0].tags ? elements[0].tags.name : "Unnamed", elements[0].lat, elements[0].lon);
  }
}

main().catch((err) => {
  console.error("Test error:", err);
});
