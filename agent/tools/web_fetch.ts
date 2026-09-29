import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * Converts an HTML string into clean readable markdown.
 */
export function htmlToMarkdown(html: string): { title?: string; markdown: string } {
  // Extract page title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : undefined;

  let text = html;

  // Remove non-content blocks
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");
  text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "");
  text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "");
  text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "");

  // Convert headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n");
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n");

  // Code blocks and inline code
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n");
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Links
  text = text.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");

  // Paragraphs and breaks
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n---\n");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");

  // Collapse multiple blank lines
  text = text.replace(/\n\s*\n\s*\n+/g, "\n\n").trim();

  // Cap length to 50KB to preserve model context
  const MAX_CHARS = 50 * 1024;
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + "\n\n[Content truncated: 50KB limit reached]";
  }

  return { title, markdown: text };
}

export default defineTool({
  description:
    "Fetches web page content from a specified URL and converts HTML into clean markdown text for documentation analysis.",
  inputSchema: z.object({
    url: z.string().url().describe("The HTTP or HTTPS URL to fetch content from"),
    raw: z
      .boolean()
      .default(false)
      .describe("Whether to return raw response text instead of parsed markdown (default: false)"),
  }),
  label: {
    start: ({ url }) => `Fetch URL: ${url}`,
  },
  async execute({ url, raw = false }) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        },
        signal: AbortSignal.timeout(15000),
      });

      const status = response.status;
      if (!response.ok) {
        return {
          url,
          status,
          markdown: `HTTP Error: Received status code ${status} from ${url}`,
        };
      }

      const bodyText = await response.text();

      if (raw) {
        return {
          url,
          status,
          markdown: bodyText,
        };
      }

      const { title, markdown } = htmlToMarkdown(bodyText);

      return {
        url,
        title,
        status,
        markdown,
      };
    } catch (err) {
      return {
        url,
        status: 0,
        markdown: `Failed to fetch URL "${url}": ${(err as Error).message}`,
      };
    }
  },
});
