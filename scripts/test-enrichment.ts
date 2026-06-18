import { enrichLeadEmail } from "../lib/enrichment";

async function main() {
  const testUrls = [
    "https://www.w3.org/Provider/Style/dummy.html", // generic page, shouldn't have emails
  ];

  for (const url of testUrls) {
    const res = await enrichLeadEmail(url);
    console.log(`Enrichment result for ${url}:`, res);
  }
}

main().catch(console.error);
