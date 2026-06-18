import { geocode, queryOverpass } from "../lib/osm";

async function main() {
  console.log("Searching New York to verify phone and website mapping...");
  const coords = await geocode("New York City");
  if (!coords) {
    console.error("Geocoding failed for NYC");
    return;
  }
  console.log(`NYC coordinates:`, coords);

  const tags = ['["amenity"="dentist"]'];
  // Sweep a small 1000m radius in Manhattan
  const elements = await queryOverpass(coords.lat, coords.lng, 2000, tags);
  
  if (!elements || elements.length === 0) {
    console.log("No elements found in this radius");
    return;
  }

  console.log(`Found ${elements.length} dentists. Sample data parsing check:`);
  
  let checkedCount = 0;
  for (const el of elements) {
    const name = el.tags?.name;
    const phone = el.tags?.phone || el.tags?.["contact:phone"] || "—";
    const website = el.tags?.website || el.tags?.["contact:website"] || el.tags?.url || "—";
    const email = el.tags?.email || el.tags?.["contact:email"] || "—";

    console.log(`- ${name}`);
    console.log(`  Phone: ${phone}`);
    console.log(`  Website: ${website}`);
    console.log(`  Email: ${email}`);
    
    checkedCount++;
    if (checkedCount >= 5) break;
  }
}

main().catch(console.error);
