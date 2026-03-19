// --- Web Search (Tavily) & URL Fetching ---

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

/**
 * Search the web using Tavily API.
 * Returns a condensed summary string for AI context.
 */
export async function webSearch(query, maxResults = 3) {
  if (!TAVILY_API_KEY) {
    console.warn("[tools] TAVILY_API_KEY not set. Web search disabled.");
    return null;
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      console.error("[tools] Tavily error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const parts = [];

    if (data.answer) {
      parts.push(`[검색 요약] ${data.answer}`);
    }

    for (const r of data.results || []) {
      parts.push(`- ${r.title}: ${r.content?.slice(0, 200) || ""} (${r.url})`);
    }

    const result = parts.join("\n");
    console.log(`[tools] Web search: "${query}" → ${data.results?.length || 0} results`);
    return result;
  } catch (err) {
    console.error("[tools] Web search failed:", err.message);
    return null;
  }
}

/**
 * Fetch text content from a URL.
 * Strips HTML tags for a rough text extraction.
 */
export async function fetchUrl(url, maxLength = 3000) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DaoLabBot/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[tools] Fetch ${url}: ${res.status}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    let text = await res.text();

    // Strip HTML tags if it's HTML
    if (contentType.includes("html")) {
      text = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const result = text.slice(0, maxLength);
    console.log(`[tools] Fetched URL: ${url} (${result.length} chars)`);
    return result;
  } catch (err) {
    console.error(`[tools] Fetch failed (${url}):`, err.message);
    return null;
  }
}

/**
 * Detect URLs in a message and return them.
 */
export function extractUrls(text) {
  const urlPattern = /https?:\/\/[^\s<>)"']+/g;
  return text.match(urlPattern) || [];
}

/**
 * Check if a message seems to need web search.
 * Simple heuristic: keywords that suggest real-time info needs.
 */
export function needsSearch(text) {
  const patterns = [
    /검색해|찾아봐|찾아줘|검색 ?좀|알아봐|알아줘/,
    /최근|최신|요즘|지금|오늘|뉴스/,
    /어디서|어떻게.*하는/,
  ];
  return patterns.some((p) => p.test(text));
}
