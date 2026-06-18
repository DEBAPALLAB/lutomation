export interface EnrichmentResult {
  email: string;
  source: "mailto" | "contact_page" | "footer";
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  
  const lower = email.toLowerCase();
  // Filter out static asset false positives
  const extensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".js", ".css", ".woff2", ".woff"];
  if (extensions.some((ext) => lower.endsWith(ext))) {
    return false;
  }
  return true;
}

function resolveUrl(base: string, relative: string): string | null {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }
    return await res.text();
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function enrichLeadEmail(websiteUrl: string): Promise<EnrichmentResult | null> {
  if (!websiteUrl) return null;

  let url = websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  console.log(`Starting email enrichment for website: ${url}`);
  const html = await fetchWithTimeout(url, 8000);
  if (!html) {
    console.log(`Failed to fetch homepage for: ${url}`);
    return null;
  }

  // 1. Check for mailto: links on homepage
  const mailtoRegex = /href=["']mailto:([^"'\s?&>]+)/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = decodeURIComponent(match[1]).trim();
    if (validateEmail(email)) {
      console.log(`Found email on homepage via mailto: ${email}`);
      return { email, source: "mailto" };
    }
  }

  // 2. Look for contact page link
  const contactLinkRegex = /href=["']([^"']*(?:contact|about)[^"']*)["']/gi;
  const contactUrls: string[] = [];
  while ((match = contactLinkRegex.exec(html)) !== null) {
    const resolved = resolveUrl(url, match[1]);
    if (resolved && !contactUrls.includes(resolved)) {
      // Avoid loading scripts or documents
      const lower = resolved.toLowerCase();
      if (!lower.endsWith(".jpg") && !lower.endsWith(".png") && !lower.endsWith(".pdf")) {
        contactUrls.push(resolved);
      }
    }
  }

  if (contactUrls.length > 0) {
    // Try first contact page
    const contactUrl = contactUrls[0];
    console.log(`Fetching contact page: ${contactUrl}`);
    const contactHtml = await fetchWithTimeout(contactUrl, 8000);
    if (contactHtml) {
      const contactMailtoRegex = /href=["']mailto:([^"'\s?&>]+)/gi;
      let contactMatch;
      while ((contactMatch = contactMailtoRegex.exec(contactHtml)) !== null) {
        const email = decodeURIComponent(contactMatch[1]).trim();
        if (validateEmail(email)) {
          console.log(`Found email on contact page via mailto: ${email}`);
          return { email, source: "contact_page" };
        }
      }
    }
  }

  // 3. Fallback: regex search homepage body text
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const emails = html.match(emailRegex);
  if (emails) {
    for (const email of emails) {
      const cleanEmail = email.trim();
      if (validateEmail(cleanEmail)) {
        console.log(`Found email on homepage body text: ${cleanEmail}`);
        return { email: cleanEmail, source: "footer" };
      }
    }
  }

  console.log(`No email found for website: ${url}`);
  return null;
}
