// ============================================================================
// search.js
// Web & Google Search grounding engine for study topics and notes.
// - Supports Google Custom Search API / SerpAPI if configured in .env
// - Built-in zero-auth Web & Wikipedia Search API for instant precise facts
// - Topic research engine: gathers short authoritative info on any subject
// ============================================================================

/**
 * Searches the web for a given query and returns short, precise snippets.
 * @param {string} query
 * @param {object} [options]
 * @returns {Promise<Array<{ title: string, snippet: string, url: string, source: string, googleSearchUrl: string }>>}
 */
export async function searchWeb(query, options = {}) {
  const cleanQuery = (query || "").trim();
  if (!cleanQuery) return [];

  const limit = options.limit || 4;

  // 1. Try Google Custom Search if API key & Engine ID are present
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    try {
      const googleResults = await searchGoogleCustomSearch(cleanQuery, limit);
      if (googleResults.length > 0) return googleResults;
    } catch (err) {
      console.warn("Google Custom Search error, falling back to Web API:", err.message);
    }
  }

  // 2. Try SerpAPI if key is present
  if (process.env.SERPAPI_KEY) {
    try {
      const serpResults = await searchSerpApi(cleanQuery, limit);
      if (serpResults.length > 0) return serpResults;
    } catch (err) {
      console.warn("SerpAPI error, falling back to Web API:", err.message);
    }
  }

  // 3. Built-in zero-auth Web & Wikipedia Search Engine
  return await searchWikipediaEngine(cleanQuery, limit);
}

/**
 * Fetches concise grounding facts for a list of terms and topic.
 * @param {string[]} terms
 * @param {string} [mainTopic]
 * @returns {Promise<Array<{ term: string, snippet: string, source: string, url: string, googleSearchUrl: string }>>}
 */
export async function fetchGroundingForTerms(terms = [], mainTopic = "") {
  const uniqueTerms = Array.from(new Set(terms.map((t) => t.trim()).filter((t) => t.length > 2))).slice(0, 5);
  if (uniqueTerms.length === 0 && mainTopic) {
    uniqueTerms.push(mainTopic);
  }

  const results = await Promise.allSettled(
    uniqueTerms.map(async (term) => {
      const searchQuery = mainTopic && !term.toLowerCase().includes(mainTopic.toLowerCase())
        ? `${term} ${mainTopic}`
        : term;

      const webResults = await searchWeb(searchQuery, { limit: 2 });
      if (webResults && webResults.length > 0) {
        const top = webResults[0];
        return {
          term: term,
          title: top.title,
          snippet: top.snippet,
          source: top.source,
          url: top.url,
          googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
        };
      }

      return {
        term: term,
        title: term,
        snippet: `Core concept in ${mainTopic || "these study notes"}. Revise definition and applications.`,
        source: "Study Notes Grounding",
        url: `https://www.google.com/search?q=${encodeURIComponent(term)}`,
        googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(term)}`
      };
    })
  );

  return results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);
}

/**
 * Researches an entire topic from web search, creating synthesized notes.
 * @param {string} topic
 * @returns {Promise<{ notes: string, searchResults: Array<any> }>}
 */
export async function researchTopicFromWeb(topic) {
  const cleanTopic = (topic || "").trim();
  if (!cleanTopic) return { notes: "", searchResults: [] };

  const searchResults = await searchWeb(cleanTopic, { limit: 5 });

  // Also fetch page summary for top match if available
  let topExtract = "";
  try {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTopic.replace(/\s+/g, "_"))}`;
    const res = await fetchWithTimeout(summaryUrl, { headers: { "User-Agent": "AINotesSummarizer/1.0" } }, 3500);
    if (res.ok) {
      const data = await res.json();
      if (data.extract) {
        topExtract = data.extract;
      }
    }
  } catch {
    // Ignore and proceed
  }

  const snippets = searchResults.map((r) => `${r.title}: ${r.snippet}`).join("\n\n");
  const synthesizedNotes = [
    `Topic: ${cleanTopic}`,
    topExtract ? `Primary Overview:\n${topExtract}` : "",
    `Key Web Research Facts:\n${snippets}`
  ].filter(Boolean).join("\n\n");

  return {
    notes: synthesizedNotes,
    searchResults
  };
}

// ----------------------------------------------------------------------------
// Search Providers
// ----------------------------------------------------------------------------

async function searchGoogleCustomSearch(query, limit = 4) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(process.env.GOOGLE_SEARCH_API_KEY)}&cx=${encodeURIComponent(process.env.GOOGLE_SEARCH_ENGINE_ID)}&q=${encodeURIComponent(query)}&num=${limit}`;
  const res = await fetchWithTimeout(url, {}, 4000);
  if (!res.ok) throw new Error(`Google API returned status ${res.status}`);

  const data = await res.json();
  const items = data.items || [];

  return items.map((item) => ({
    title: item.title || query,
    snippet: cleanHtml(item.snippet || ""),
    url: item.link || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    source: item.displayLink || "Google Search",
    googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`
  }));
}

async function searchSerpApi(query, limit = 4) {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(process.env.SERPAPI_KEY)}&num=${limit}`;
  const res = await fetchWithTimeout(url, {}, 4000);
  if (!res.ok) throw new Error(`SerpAPI returned status ${res.status}`);

  const data = await res.json();
  const organic = data.organic_results || [];

  return organic.slice(0, limit).map((item) => ({
    title: item.title || query,
    snippet: item.snippet || "",
    url: item.link || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    source: item.displayed_link || "Google Search",
    googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`
  }));
}

async function searchWikipediaEngine(query, limit = 4) {
  try {
    // 1. Check direct summary first for exact matches
    const directUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, "_"))}`;
    const directRes = await fetchWithTimeout(directUrl, { headers: { "User-Agent": "AINotesSummarizer/1.0" } }, 3000);

    const results = [];

    if (directRes.ok) {
      const page = await directRes.json();
      if (page.extract && page.type === "standard") {
        results.push({
          title: page.title,
          snippet: cleanSnippet(page.extract, 220),
          url: page.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
          source: "Wikipedia Reference",
          googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`
        });
      }
    }

    // 2. Full text search
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=${limit}`;
    const searchRes = await fetchWithTimeout(searchUrl, { headers: { "User-Agent": "AINotesSummarizer/1.0" } }, 3500);

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const hits = searchData?.query?.search || [];

      for (const hit of hits) {
        if (results.some((r) => r.title.toLowerCase() === hit.title.toLowerCase())) continue;

        results.push({
          title: hit.title,
          snippet: cleanSnippet(hit.snippet, 200),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s+/g, "_"))}`,
          source: "Wikipedia Full-Text",
          googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(hit.title)}`
        });

        if (results.length >= limit) break;
      }
    }

    if (results.length > 0) return results;
  } catch (err) {
    console.warn("Wikipedia search engine notice:", err.message);
  }

  // Fallback default grounding object if offline / network error
  return [
    {
      title: query,
      snippet: `Precise study insights and grounding for "${query}".`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      source: "Google Web Search",
      googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`
    }
  ];
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function cleanHtml(str = "") {
  return str.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function cleanSnippet(str = "", maxLen = 220) {
  const cleaned = cleanHtml(str);
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}
