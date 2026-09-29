import { defineTool } from "eve/tools";
import { z } from "zod";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export default defineTool({
  description:
    "Searches the web for authoritative technical documentation and references, with optional domain filtering.",
  inputSchema: z.object({
    query: z.string().describe("Search query terms or topic to search for"),
    domain: z
      .string()
      .optional()
      .describe("Optional domain to restrict results to (e.g. 'docs.anthropic.com', 'nodejs.org')"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Maximum number of search results to return (default: 5)"),
  }),
  label: {
    start: ({ query, domain }) =>
      `Web search: "${query}"${domain ? ` (site:${domain})` : ""}`,
  },
  async execute({ query, domain, limit = 5 }) {
    const fullQuery = domain ? `site:${domain} ${query}` : query;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(fullQuery)}`;

    const results: SearchResultItem[] = [];

    try {
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const html = await response.text();

        // Extract search result blocks
        // Format: <a class="result__a" href="...">title</a> ... <a class="result__snippet" ...>snippet</a>
        const titleRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

        const titleMatches = Array.from(html.matchAll(titleRegex));
        const snippetMatches = Array.from(html.matchAll(snippetRegex));

        for (let i = 0; i < titleMatches.length && results.length < limit; i++) {
          const rawHref = titleMatches[i][1];
          const rawTitle = titleMatches[i][2];
          const rawSnippet = snippetMatches[i] ? snippetMatches[i][1] : "";

          // Clean title and snippet HTML tags
          const title = rawTitle.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim();
          const snippet = rawSnippet.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim();

          // Resolve actual destination URL from DDG redirect (uddg=...)
          let url = rawHref;
          const uddgMatch = rawHref.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            try {
              url = decodeURIComponent(uddgMatch[1]);
            } catch {
              url = rawHref;
            }
          } else if (rawHref.startsWith("//")) {
            url = `https:${rawHref}`;
          }

          if (title && url) {
            results.push({
              title,
              url,
              snippet: snippet || title,
            });
          }
        }
      }
    } catch {
      // Graceful fallback if network request fails
    }

    return {
      query: fullQuery,
      totalResults: results.length,
      results,
    };
  },
});
