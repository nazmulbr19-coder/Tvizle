import express from "express";
import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const PORT = Number(process.env.PORT) || 3000;
const TVIZLE_BASE = "https://tvizle.tr";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/html;q=0.9, */*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
};

interface RawStreamItem {
  url?: string;
  quality?: string | null;
  title?: string | null;
  labels?: unknown;
  userAgent?: string | null;
  referrer?: string | null;
}

interface ParsedChannelTile {
  slug: string;
  name: string;
  quality: string;
  country: string;
  live: boolean;
  logo: string;
  url: string;
}

function unescapeNextRscPayload(html: string): string {
  return html
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}

function extractJsonArrayAfterKey(source: string, key: string): string | null {
  let searchIdx = 0;
  while (searchIdx < source.length) {
    const keyIdx = source.indexOf(key, searchIdx);
    if (keyIdx === -1) return null;

    let idx = keyIdx + key.length;
    while (idx < source.length && /\s/.test(source[idx])) idx++;
    if (source[idx] !== "[") {
      searchIdx = keyIdx + key.length;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    const start = idx;

    for (; idx < source.length; idx++) {
      const ch = source[idx];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === "[") depth++;
        else if (ch === "]") {
          depth--;
          if (depth === 0) {
            return source.slice(start, idx + 1);
          }
        }
      }
    }
    searchIdx = keyIdx + key.length;
  }
  return null;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseCategoryHtmlChannels(html: string): ParsedChannelTile[] {
  const results: ParsedChannelTile[] = [];
  const seen = new Set<string>();
  const cardRegex =
    /<a\s+class="ch-card[^"]*"\s+href="\/izle\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = cardRegex.exec(html)) !== null) {
    const slug = match[1].trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const inner = match[2];
    const nameMatch = inner.match(/<span\s+class="ch-name">([\s\S]*?)<\/span>/);
    const name = nameMatch ? decodeHtmlEntities(nameMatch[1]) : slug;

    const metaMatch = inner.match(/<span\s+class="ch-meta">([\s\S]*?)<\/span>\s*<\/span>/);
    const metaBlock = metaMatch ? metaMatch[1] : inner;
    const spans = [...metaBlock.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) =>
      decodeHtmlEntities(m[1])
    );

    const live = spans.some((s) => s.toLowerCase().includes("canlı") || s.toLowerCase() === "live");
    const quality = spans.find((s) => /^\d{3,4}p$/i.test(s)) || "";
    const country =
      spans.find(
        (s) =>
          s &&
          !s.toLowerCase().includes("canlı") &&
          s.toLowerCase() !== "live" &&
          !/^\d{3,4}p$/i.test(s)
      ) || "";

    results.push({
      slug,
      name,
      quality,
      country,
      live,
      logo: `${TVIZLE_BASE}/api/img?c=${encodeURIComponent(slug)}&w=160&auto=format`,
      url: `${TVIZLE_BASE}/izle/${slug}`,
    });
  }
  return results;
}

async function startServer() {
  const app = express();

  app.get("/api/tvizle/channels", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 48, 1), 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const upstream = await fetch(
        `${TVIZLE_BASE}/api/kanallar?limit=${limit}&offset=${offset}`,
        { headers: REQUEST_HEADERS }
      );
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream HTTP ${upstream.status}` });
        return;
      }
      const data = await upstream.json();
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to reach tvizle.tr",
      });
    }
  });

  app.get("/api/tvizle/browse", async (req: Request, res: Response) => {
    try {
      const rawPath = String(req.query.path || "kategori/haberler").replace(/^\/+/, "");
      if (!/^(kategori|ulke|dil|bolge)\/[a-z0-9-]+$/i.test(rawPath)) {
        res.status(400).json({ error: "Invalid browse path" });
        return;
      }
      const upstream = await fetch(`${TVIZLE_BASE}/${rawPath}`, {
        headers: REQUEST_HEADERS,
      });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream HTTP ${upstream.status}` });
        return;
      }
      const html = await upstream.text();
      const channels = parseCategoryHtmlChannels(html);
      res.json({ path: rawPath, count: channels.length, channels });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to browse category",
      });
    }
  });

  app.get("/api/tvizle/search", async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        res.json({ q: "", hits: [] });
        return;
      }
      const upstream = await fetch(
        `${TVIZLE_BASE}/api/ara?q=${encodeURIComponent(q)}&tur=channel&limit=40`,
        { headers: REQUEST_HEADERS }
      );
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream HTTP ${upstream.status}` });
        return;
      }
      const data = (await upstream.json()) as {
        q?: string;
        groups?: Array<{
          type: string;
          hits: Array<{
            slug: string;
            name: string;
            sub?: string;
            href?: string;
            live?: boolean;
          }>;
        }>;
      };
      const channelGroup = data.groups?.find((g) => g.type === "channel");
      res.json({
        q: data.q || q,
        hits: (channelGroup?.hits || []).map((h) => ({
          ...h,
          logo: `${TVIZLE_BASE}/api/img?c=${encodeURIComponent(h.slug)}&w=160&auto=format`,
          url: `${TVIZLE_BASE}/izle/${h.slug}`,
        })),
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Search request failed",
      });
    }
  });

  app.get("/api/tvizle/resolve/:slug", async (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug || "").trim();
      if (!/^[a-z0-9-]+$/i.test(slug)) {
        res.status(400).json({ error: "Invalid channel slug" });
        return;
      }

      const [metaResp, pageResp] = await Promise.all([
        fetch(`${TVIZLE_BASE}/api/kanallar?slug=${encodeURIComponent(slug)}`, {
          headers: REQUEST_HEADERS,
        }),
        fetch(`${TVIZLE_BASE}/izle/${encodeURIComponent(slug)}`, {
          headers: REQUEST_HEADERS,
        }),
      ]);

      const metaJson = metaResp.ok
        ? ((await metaResp.json()) as { channel?: Record<string, unknown> })
        : null;
      const html = pageResp.ok ? await pageResp.text() : "";
      const normalized = unescapeNextRscPayload(html);
      const streamsJson = extractJsonArrayAfterKey(normalized, '"streams":');

      let parsedStreams: Array<{
        url: string;
        rawUrl: string;
        isProxy: boolean;
        quality: string;
        title: string;
        labels: string[];
        userAgent: string | null;
        referrer: string | null;
        streamType: "M3U8" | "DASH" | "VIDEO";
      }> = [];

      if (streamsJson) {
        const rawList = JSON.parse(streamsJson) as RawStreamItem[];
        parsedStreams = rawList
          .filter((item) => typeof item.url === "string" && item.url.trim().length > 0)
          .map((item) => {
            const rawUrl = String(item.url).trim();
            const isProxy = rawUrl.startsWith("/");
            const resolvedUrl = isProxy ? `${TVIZLE_BASE}${rawUrl}` : rawUrl;
            const lower = resolvedUrl.toLowerCase();
            const streamType: "M3U8" | "DASH" | "VIDEO" = lower.includes(".mpd")
              ? "DASH"
              : lower.includes(".mp4") && !lower.includes(".m3u8")
                ? "VIDEO"
                : "M3U8";
            const labels = Array.isArray(item.labels)
              ? item.labels.filter((l): l is string => typeof l === "string" && !l.startsWith("$"))
              : [];

            return {
              url: resolvedUrl,
              rawUrl,
              isProxy,
              quality: item.quality || "Auto",
              title: item.title || slug,
              labels,
              userAgent: item.userAgent || null,
              referrer: item.referrer || null,
              streamType,
            };
          });
      }

      res.json({
        slug,
        channel: metaJson?.channel || null,
        streams: parsedStreams,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to resolve channel streams",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build output not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
