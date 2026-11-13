package com.tvizle

import com.fasterxml.jackson.annotation.JsonProperty
import com.lagradost.cloudstream3.*
import com.lagradost.cloudstream3.utils.*
import java.net.URLEncoder

class TvizleProvider : MainAPI() {
    override var mainUrl = "https://tvizle.tr"
    override var name = "TVizle.tr"
    override val hasMainPage = true
    override var lang = "tr"
    override val hasQuickSearch = true
    override val supportedTypes = setOf(TvType.Live)

    private val includeProxyStreams = true

    override val mainPage = mainPageOf(
        "api:popular" to "Öne Çıkanlar",
        "kategori/haberler" to "Haberler",
        "kategori/spor" to "Spor",
        "kategori/filmler" to "Filmler",
        "kategori/diziler" to "Diziler",
        "kategori/belgesel" to "Belgesel",
        "kategori/eglence" to "Eğlence",
        "kategori/cocuk" to "Çocuk",
        "kategori/muzik" to "Müzik",
        "ulke/turkiye" to "Türkiye Kanalları",
        "ulke/united-kingdom" to "Birleşik Krallık",
        "ulke/united-states" to "ABD Kanalları"
    )

    override suspend fun getMainPage(
        page: Int,
        request: MainPageRequest
    ): HomePageResponse {
        if (request.data == "api:popular") {
            val limit = 60
            val offset = (page - 1) * limit
            val res = app.get("$mainUrl/api/kanallar?limit=$limit&offset=$offset")
                .parsedSafe<KanallarListResponse>()
                ?: throw ErrorLoadingException("TVizle kanal listesi yuklenemedi")

            val items = res.channels.map { ch ->
                newLiveSearchResponse(
                    name = ch.name,
                    url = "$mainUrl/izle/${ch.slug}",
                    type = TvType.Live
                ) {
                    this.posterUrl = "$mainUrl/api/img?c=${ch.slug}&w=320&auto=format"
                }
            }

            val hasNext = (offset + items.size) < res.total
            return newHomePageResponse(
                list = HomePageList(request.name, items, isHorizontalImages = true),
                hasNext = hasNext
            )
        }

        if (page > 1) {
            return newHomePageResponse(
                list = HomePageList(request.name, emptyList(), isHorizontalImages = true),
                hasNext = false
            )
        }

        val doc = app.get("$mainUrl/${request.data}").document
        val items = doc.select("ul.ch-grid li a.ch-card").mapNotNull { el ->
            val href = el.attr("href").takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val title = el.selectFirst("span.ch-name")?.text()?.trim()
                ?: return@mapNotNull null
            val slug = extractSlug(href)
            val poster = "$mainUrl/api/img?c=$slug&w=320&auto=format"

            newLiveSearchResponse(
                name = title,
                url = fixUrl(href),
                type = TvType.Live
            ) {
                this.posterUrl = poster
            }
        }

        return newHomePageResponse(
            list = HomePageList(request.name, items, isHorizontalImages = true),
            hasNext = false
        )
    }

    override suspend fun search(query: String): List<SearchResponse> {
        val encoded = URLEncoder.encode(query.trim(), "UTF-8")
        val res = app.get("$mainUrl/api/ara?q=$encoded&tur=channel&limit=50")
            .parsedSafe<SearchApiResponse>() ?: return emptyList()

        val channelHits = res.groups
            .firstOrNull { it.type == "channel" }
            ?.hits
            .orEmpty()

        return channelHits.map { hit ->
            newLiveSearchResponse(
                name = hit.name,
                url = "$mainUrl/izle/${hit.slug}",
                type = TvType.Live
            ) {
                this.posterUrl = "$mainUrl/api/img?c=${hit.slug}&w=320&auto=format"
            }
        }
    }

    override suspend fun quickSearch(query: String): List<SearchResponse> = search(query)

    override suspend fun load(url: String): LoadResponse? {
        val slug = extractSlug(url)
        val detail = app.get("$mainUrl/api/kanallar?slug=$slug")
            .parsedSafe<SingleChannelResponse>()
            ?.channel

        val title = detail?.name ?: slug
        val poster = detail?.logo?.takeIf { it.isNotBlank() }
            ?: "$mainUrl/api/img?c=$slug&w=512&auto=format"

        val categories = detail?.categories?.mapNotNull { it.name }.orEmpty()
        val languages = detail?.languages?.mapNotNull { it.name }.orEmpty()
        val owners = detail?.owners.orEmpty()

        val summaryParts = buildList {
            detail?.country?.name?.let { add("Ülke: $it") }
            if (categories.isNotEmpty()) add("Kategori: ${categories.joinToString(", ")}")
            if (languages.isNotEmpty()) add("Dil: ${languages.joinToString(", ")}")
            detail?.quality?.let { add("Kalite: $it") }
            if (owners.isNotEmpty()) add("Yayıncı: ${owners.joinToString(", ")}")
            detail?.streamCount?.let { add("Kaynak sayısı: $it") }
        }

        val watchUrl = "$mainUrl/izle/$slug"
        return newLiveStreamLoadResponse(title, watchUrl, watchUrl) {
            this.posterUrl = poster
            this.plot = summaryParts.joinToString(" • ")
            this@newLiveStreamLoadResponse.tags = categories
        }
    }

    override suspend fun loadLinks(
        data: String,
        isCasting: Boolean,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit
    ): Boolean {
        val slug = extractSlug(data)
        val html = app.get("$mainUrl/izle/$slug").text
        val escapedQuote = "\\" + '"'
        val normalized = html
            .replace(escapedQuote, "\"")
            .replace("\\u0026", "&")
            .replace("\\/", "/")

        val streamsJson = extractJsonArrayAfterKey(normalized, "\"streams\":")
            ?: return false

        val streams = try {
            AppUtils.parseJson<List<RscStreamItem>>(streamsJson)
        } catch (_: Exception) {
            emptyList()
        }

        var emitted = false
        streams.forEachIndexed { index, stream ->
            val rawUrl = stream.url?.trim().orEmpty()
            if (rawUrl.isBlank()) return@forEachIndexed

            val isProxy = rawUrl.startsWith("/")
            if (isProxy && !includeProxyStreams) return@forEachIndexed

            val resolvedUrl = if (isProxy) "$mainUrl$rawUrl" else rawUrl
            val lower = resolvedUrl.lowercase()
            val linkType = when {
                lower.contains(".mpd") -> ExtractorLinkType.DASH
                lower.contains(".mp4") && !lower.contains(".m3u8") -> ExtractorLinkType.VIDEO
                else -> ExtractorLinkType.M3U8
            }

            val qualityLabel = stream.quality?.takeIf { it.isNotBlank() } ?: "Auto"
            val displayName = buildString {
                append(stream.title?.takeIf { it.isNotBlank() } ?: name)
                append(" [")
                append(qualityLabel)
                if (isProxy) append(" • Vekil")
                append(" #")
                append(index + 1)
                append("]")
            }

            callback.invoke(
                newExtractorLink(
                    source = this.name,
                    name = displayName,
                    url = resolvedUrl,
                    type = linkType
                ) {
                    this.referer = stream.referrer?.takeIf { it.isNotBlank() } ?: "$mainUrl/"
                    this.quality = getQualityFromName(stream.quality)
                    val ua = stream.userAgent?.takeIf { it.isNotBlank() }
                    if (ua != null) {
                        this.headers = mapOf("User-Agent" to ua)
                    }
                }
            )
            emitted = true
        }

        return emitted
    }

    private fun extractSlug(urlOrPath: String): String {
        return urlOrPath
            .substringAfter("/izle/", urlOrPath)
            .substringBefore("?")
            .substringBefore("#")
            .trim('/')
    }

    private fun extractJsonArrayAfterKey(source: String, key: String): String? {
        var searchIdx = 0
        while (searchIdx < source.length) {
            val keyIdx = source.indexOf(key, searchIdx)
            if (keyIdx == -1) return null

            var idx = keyIdx + key.length
            while (idx < source.length && source[idx].isWhitespace()) idx++
            if (idx >= source.length || source[idx] != '[') {
                searchIdx = keyIdx + key.length
                continue
            }

            var depth = 0
            var inString = false
            var escaped = false
            val start = idx

            while (idx < source.length) {
                val ch = source[idx]
                if (escaped) {
                    escaped = false
                } else if (ch == '\\') {
                    escaped = true
                } else if (ch == '"') {
                    inString = !inString
                } else if (!inString) {
                    if (ch == '[') {
                        depth++
                    } else if (ch == ']') {
                        depth--
                        if (depth == 0) {
                            return source.substring(start, idx + 1)
                        }
                    }
                }
                idx++
            }
            searchIdx = keyIdx + key.length
        }
        return null
    }

    data class KanallarListResponse(
        @JsonProperty("total") val total: Int = 0,
        @JsonProperty("count") val count: Int = 0,
        @JsonProperty("channels") val channels: List<ChannelSummary> = emptyList()
    )

    data class ChannelSummary(
        @JsonProperty("slug") val slug: String,
        @JsonProperty("name") val name: String,
        @JsonProperty("country") val country: String? = null,
        @JsonProperty("countryCode") val countryCode: String? = null,
        @JsonProperty("category") val category: String? = null,
        @JsonProperty("quality") val quality: String? = null,
        @JsonProperty("live") val live: Boolean = true
    )

    data class SearchApiResponse(
        @JsonProperty("groups") val groups: List<SearchGroup> = emptyList()
    )

    data class SearchGroup(
        @JsonProperty("type") val type: String,
        @JsonProperty("hits") val hits: List<SearchHit> = emptyList()
    )

    data class SearchHit(
        @JsonProperty("slug") val slug: String,
        @JsonProperty("name") val name: String,
        @JsonProperty("sub") val sub: String? = null,
        @JsonProperty("live") val live: Boolean = true
    )

    data class SingleChannelResponse(
        @JsonProperty("channel") val channel: ChannelDetail? = null
    )

    data class ChannelDetail(
        @JsonProperty("slug") val slug: String? = null,
        @JsonProperty("name") val name: String? = null,
        @JsonProperty("logo") val logo: String? = null,
        @JsonProperty("quality") val quality: String? = null,
        @JsonProperty("owners") val owners: List<String>? = null,
        @JsonProperty("streamCount") val streamCount: Int? = null,
        @JsonProperty("country") val country: NamedRef? = null,
        @JsonProperty("categories") val categories: List<NamedRef>? = null,
        @JsonProperty("languages") val languages: List<NamedRef>? = null
    )

    data class NamedRef(
        @JsonProperty("name") val name: String? = null,
        @JsonProperty("url") val url: String? = null
    )

    data class RscStreamItem(
        @JsonProperty("url") val url: String? = null,
        @JsonProperty("quality") val quality: String? = null,
        @JsonProperty("title") val title: String? = null,
        @JsonProperty("userAgent") val userAgent: String? = null,
        @JsonProperty("referrer") val referrer: String? = null
    )
}
