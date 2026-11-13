import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Play, Search, Tv, AlertCircle } from "lucide-react";

interface ChannelRow {
  slug: string;
  name: string;
  country?: string;
  countryCode?: string;
  category?: string;
  quality?: string;
  live?: boolean;
  logo?: string;
  url?: string;
}

interface ResolvedStream {
  url: string;
  rawUrl: string;
  isProxy: boolean;
  quality: string;
  title: string;
  labels: string[];
  userAgent: string | null;
  referrer: string | null;
  streamType: "M3U8" | "DASH" | "VIDEO";
}

interface ChannelDetail {
  slug?: string;
  name?: string;
  logo?: string;
  quality?: string;
  owners?: string[];
  streamCount?: number;
  country?: { name?: string };
  categories?: Array<{ name?: string }>;
  languages?: Array<{ name?: string }>;
}

interface ChannelExplorerProps {
  includeProxyStreams: boolean;
}

const BROWSE_FEEDS = [
  { id: "api:popular", label: "Featured" },
  { id: "kategori/haberler", label: "Haberler" },
  { id: "kategori/spor", label: "Spor" },
  { id: "kategori/filmler", label: "Filmler" },
  { id: "kategori/diziler", label: "Diziler" },
  { id: "kategori/belgesel", label: "Belgesel" },
  { id: "kategori/eglence", label: "Eglence" },
  { id: "kategori/cocuk", label: "Cocuk" },
  { id: "kategori/muzik", label: "Muzik" },
  { id: "ulke/turkiye", label: "Turkiye" },
] as const;

function ChannelLogo({ slug, name }: { slug: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();

  if (failed) {
    return (
      <div className="h-10 w-10 shrink-0 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
        {initials || <Tv className="h-4 w-4" />}
      </div>
    );
  }

  return (
    <img
      src={`https://tvizle.tr/api/img?c=${encodeURIComponent(slug)}&w=108&auto=format`}
      alt={`${name} logo`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-md bg-slate-100 border border-slate-200 object-contain p-1"
    />
  );
}

export function ChannelExplorer({ includeProxyStreams }: ChannelExplorerProps) {
  const [activeFeed, setActiveFeed] = useState<string>("api:popular");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalChannels, setTotalChannels] = useState<number>(31040);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedDetail, setResolvedDetail] = useState<ChannelDetail | null>(null);
  const [resolvedStreams, setResolvedStreams] = useState<ResolvedStream[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadChannels() {
      setListLoading(true);
      setListError(null);
      try {
        if (searchQuery.trim()) {
          const resp = await fetch(
            `/api/tvizle/search?q=${encodeURIComponent(searchQuery.trim())}`
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = (await resp.json()) as {
            hits?: Array<{ slug: string; name: string; sub?: string; live?: boolean }>;
          };
          if (!cancelled) {
            setChannels(
              (data.hits || []).map((h) => ({
                slug: h.slug,
                name: h.name,
                country: h.sub || "",
                live: h.live,
              }))
            );
          }
        } else if (activeFeed === "api:popular") {
          const limit = 36;
          const offset = page * limit;
          const resp = await fetch(
            `/api/tvizle/channels?limit=${limit}&offset=${offset}`
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = (await resp.json()) as {
            total?: number;
            channels?: ChannelRow[];
          };
          if (!cancelled) {
            setTotalChannels(data.total || 31040);
            setChannels(data.channels || []);
          }
        } else {
          const resp = await fetch(
            `/api/tvizle/browse?path=${encodeURIComponent(activeFeed)}`
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = (await resp.json()) as { channels?: ChannelRow[] };
          if (!cancelled) {
            setChannels(data.channels || []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setListError(
            err instanceof Error ? err.message : "Failed to fetch tvizle.tr channels"
          );
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }
    loadChannels();
    return () => {
      cancelled = true;
    };
  }, [activeFeed, page, searchQuery]);

  async function inspectChannel(slug: string) {
    setSelectedSlug(slug);
    setResolveLoading(true);
    setResolveError(null);
    try {
      const resp = await fetch(`/api/tvizle/resolve/${encodeURIComponent(slug)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        channel: ChannelDetail | null;
        streams: ResolvedStream[];
      };
      setResolvedDetail(data.channel);
      setResolvedStreams(data.streams || []);
    } catch (err) {
      setResolveError(
        err instanceof Error ? err.message : "Failed to resolve streams"
      );
      setResolvedDetail(null);
      setResolvedStreams([]);
    } finally {
      setResolveLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchInput.trim());
  }

  function copyStreamUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl((prev) => (prev === url ? null : prev)), 1800);
  }

  const visibleStreams = includeProxyStreams
    ? resolvedStreams
    : resolvedStreams.filter((s) => !s.isProxy);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
            Live Channel & Stream Inspector
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Verify the exact endpoints and Next.js RSC stream extraction logic used by{" "}
            <span className="font-mono text-slate-800">TvizleProvider.kt</span> across{" "}
            <span className="tabular-nums font-medium text-slate-900">
              {totalChannels.toLocaleString()}
            </span>{" "}
            indexed iptv-org channels.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value.trim()) setSearchQuery("");
              }}
              placeholder="Search channels (e.g. TRT, BBC)"
              className="w-64 sm:w-72 pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {BROWSE_FEEDS.map((feed) => {
            const active = !searchQuery && activeFeed === feed.id;
            return (
              <button
                key={feed.id}
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchInput("");
                  setPage(0);
                  setActiveFeed(feed.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {feed.label}
              </button>
            );
          })}
        </div>

        {!searchQuery && activeFeed === "api:popular" && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="tabular-nums">
              Page {page + 1} · Offset {page * 36}
            </span>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-md font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              {searchQuery
                ? `Search results for "${searchQuery}"`
                : `Feed: ${activeFeed}`}
            </span>
            <span className="tabular-nums">{channels.length} channels loaded</span>
          </div>

          {listLoading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 bg-slate-100 rounded" />
                    <div className="h-3 w-28 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : listError ? (
            <div className="p-8 text-center space-y-2">
              <AlertCircle className="h-6 w-6 text-rose-600 mx-auto" />
              <p className="text-sm font-medium text-slate-900">
                Could not fetch channels from tvizle.tr
              </p>
              <p className="text-xs text-slate-500">{listError}</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">
                No channels matched this query
              </p>
              <p className="text-xs text-slate-500">
                Try another search term or switch back to Featured channels.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
              {channels.map((ch) => {
                const isSelected = selectedSlug === ch.slug;
                const metaParts = [ch.category, ch.quality, ch.country].filter(Boolean);
                return (
                  <button
                    key={ch.slug}
                    type="button"
                    onClick={() => inspectChannel(ch.slug)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                      isSelected ? "bg-rose-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChannelLogo slug={ch.slug} name={ch.name} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {ch.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {metaParts.length > 0 ? metaParts.join(" · ") : ch.slug}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-rose-700 whitespace-nowrap shrink-0">
                      Inspect streams
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden lg:sticky lg:top-20">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">
              Provider Output Preview (load & loadLinks)
            </span>
            {selectedSlug && (
              <a
                href={`https://tvizle.tr/izle/${selectedSlug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
              >
                Open source page
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {!selectedSlug ? (
            <div className="p-8 text-center space-y-2">
              <Play className="h-6 w-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-900">
                Select any channel on the left
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Click a channel to run the live metadata lookup and extract HLS (.m3u8) stream links exactly as Cloudstream will.
              </p>
            </div>
          ) : resolveLoading ? (
            <div className="p-6 space-y-4">
              <div className="h-5 w-48 bg-slate-100 rounded" />
              <div className="h-3 w-64 bg-slate-100 rounded" />
              <div className="space-y-2 pt-2">
                <div className="h-16 w-full bg-slate-100 rounded-lg" />
                <div className="h-16 w-full bg-slate-100 rounded-lg" />
              </div>
            </div>
          ) : resolveError ? (
            <div className="p-6 text-center space-y-2">
              <AlertCircle className="h-6 w-6 text-rose-600 mx-auto" />
              <p className="text-sm font-medium text-slate-900">Resolution failed</p>
              <p className="text-xs text-slate-500">{resolveError}</p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              <div className="flex items-start gap-3">
                <ChannelLogo
                  slug={selectedSlug}
                  name={resolvedDetail?.name || selectedSlug}
                />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900">
                    {resolvedDetail?.name || selectedSlug}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[
                      resolvedDetail?.country?.name,
                      resolvedDetail?.categories?.map((c) => c.name).join(", "),
                      resolvedDetail?.languages?.map((l) => l.name).join(", "),
                      resolvedDetail?.quality,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Live TV Channel"}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Extracted ExtractorLink Sources ({visibleStreams.length})
                  </h3>
                  {!includeProxyStreams &&
                    resolvedStreams.some((s) => s.isProxy) && (
                      <span className="text-xs text-slate-500">
                        Proxy links hidden by config
                      </span>
                    )}
                </div>

                {visibleStreams.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">
                    No playable stream URLs were found in this channel's RSC payload.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {visibleStreams.map((stream, index) => (
                      <div
                        key={`${stream.url}-${index}`}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-900 truncate">
                            {stream.title} · {stream.quality} · {stream.streamType}
                            {stream.isProxy ? " · Vekil" : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyStreamUrl(stream.url)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700 shrink-0 cursor-pointer"
                          >
                            {copiedUrl === stream.url ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy URL
                              </>
                            )}
                          </button>
                        </div>
                        <p className="font-mono text-[11px] text-slate-600 break-all leading-relaxed">
                          {stream.url}
                        </p>
                        {(stream.userAgent || stream.referrer || stream.labels.length > 0) && (
                          <p className="text-[11px] text-slate-500">
                            {[
                              ...stream.labels,
                              stream.referrer ? `Referer: ${stream.referrer}` : null,
                              stream.userAgent ? `UA: ${stream.userAgent}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
