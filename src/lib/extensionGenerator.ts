export interface ExtensionConfig {
  githubUser: string;
  repoName: string;
  authorName: string;
  pluginLang: string;
  includeProxyStreams: boolean;
  repoDisplayName: string;
}

export interface GeneratedFile {
  path: string;
  language: "kotlin" | "json" | "yaml" | "markdown" | "properties" | "xml";
  description: string;
  content: string;
}

export function generateExtensionFiles(config: ExtensionConfig): GeneratedFile[] {
  const cleanUser = config.githubUser.trim() || "your-username";
  const cleanRepo = config.repoName.trim() || "tvizle-cloudstream";
  const cleanAuthor = config.authorName.trim() || cleanUser;
  const cleanLang = config.pluginLang.trim() || "tr";
  const cleanRepoTitle = config.repoDisplayName.trim() || "TVizle.tr Extensions";

  const rootBuildGradle = `import com.android.build.gradle.BaseExtension
import com.lagradost.cloudstream3.gradle.CloudstreamExtension
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.tasks.KotlinJvmCompile

buildscript {
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }

    dependencies {
        classpath("com.android.tools.build:gradle:8.7.3")
        classpath("com.github.recloudstream:gradle:-SNAPSHOT")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.0")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }
}

fun Project.cloudstream(configuration: CloudstreamExtension.() -> Unit) =
    extensions.getByName<CloudstreamExtension>("cloudstream").configuration()

fun Project.android(configuration: BaseExtension.() -> Unit) =
    extensions.getByName<BaseExtension>("android").configuration()

subprojects {
    apply(plugin = "com.android.library")
    apply(plugin = "kotlin-android")
    apply(plugin = "com.lagradost.cloudstream3.gradle")

    cloudstream {
        setRepo(System.getenv("GITHUB_REPOSITORY") ?: "${cleanUser}/${cleanRepo}")
    }

    android {
        namespace = "com.tvizle"

        defaultConfig {
            minSdk = 21
            compileSdkVersion(35)
            targetSdk = 35
        }

        compileOptions {
            sourceCompatibility = JavaVersion.VERSION_1_8
            targetCompatibility = JavaVersion.VERSION_1_8
        }

        tasks.withType<KotlinJvmCompile> {
            compilerOptions {
                jvmTarget.set(JvmTarget.JVM_1_8)
                freeCompilerArgs.addAll(
                    "-Xno-call-assertions",
                    "-Xno-param-assertions",
                    "-Xno-receiver-assertions"
                )
            }
        }
    }

    dependencies {
        val implementation by configurations

        implementation("com.github.recloudstream.cloudstream:library:-SNAPSHOT")

        implementation(kotlin("stdlib"))
        implementation("com.github.Blatzar:NiceHttp:0.4.11")
        implementation("org.jsoup:jsoup:1.18.3")
        // Keep Jackson at 2.13.1 for Android compatibility
        implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.13.1")
    }
}

task<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
`;

  const settingsGradle = `rootProject.name = "TvizlePlugins"

include(":TvizleProvider")
`;

  const gradleProperties = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
`;

  const androidManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest />
`;

  const pluginBuildGradle = `version = 1

cloudstream {
    language = "${cleanLang}"
    description = "TVizle.tr canli TV kanallari ve iptv-org acik kaynakli HLS yayinlari."
    authors = listOf("${cleanAuthor}")

    /**
     * Status int:
     * 0: Down
     * 1: Ok
     * 2: Slow
     * 3: Beta only
     */
    status = 1

    tvTypes = listOf("Live")

    iconUrl = "https://tvizle.tr/icon-512.png"
}
`;

  const pluginEntryKt = `package com.tvizle

import com.lagradost.cloudstream3.plugins.BasePlugin
import com.lagradost.cloudstream3.plugins.CloudstreamPlugin

@CloudstreamPlugin
class TvizlePlugin : BasePlugin() {
    override fun load() {
        registerMainAPI(TvizleProvider())
    }
}
`;

  const providerKt = `package com.tvizle

import com.fasterxml.jackson.annotation.JsonProperty
import com.lagradost.cloudstream3.*
import com.lagradost.cloudstream3.utils.*
import java.net.URLEncoder

class TvizleProvider : MainAPI() {
    override var mainUrl = "https://tvizle.tr"
    override var name = "TVizle.tr"
    override val hasMainPage = true
    override var lang = "${cleanLang}"
    override val hasQuickSearch = true
    override val supportedTypes = setOf(TvType.Live)

    private val includeProxyStreams = ${config.includeProxyStreams ? "true" : "false"}

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
                    url = "$mainUrl/izle/\${ch.slug}",
                    type = TvType.Live
                ) {
                    this.posterUrl = "$mainUrl/api/img?c=\${ch.slug}&w=320&auto=format"
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

        val doc = app.get("$mainUrl/\${request.data}").document
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
                url = "$mainUrl/izle/\${hit.slug}",
                type = TvType.Live
            ) {
                this.posterUrl = "$mainUrl/api/img?c=\${hit.slug}&w=320&auto=format"
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
            if (categories.isNotEmpty()) add("Kategori: \${categories.joinToString(", ")}")
            if (languages.isNotEmpty()) add("Dil: \${languages.joinToString(", ")}")
            detail?.quality?.let { add("Kalite: $it") }
            if (owners.isNotEmpty()) add("Yayıncı: \${owners.joinToString(", ")}")
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
        val escapedQuote = "\\\\" + '"'
        val normalized = html
            .replace(escapedQuote, "\\"")
            .replace("\\\\u0026", "&")
            .replace("\\\\/", "/")

        val streamsJson = extractJsonArrayAfterKey(normalized, "\\"streams\\":")
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
                } else if (ch == '\\\\') {
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
`;

  const repoJson = JSON.stringify(
    {
      name: cleanRepoTitle,
      description: "TVizle.tr live TV extension powered by iptv-org open data",
      manifestVersion: 1,
      pluginLists: [
        `https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/builds/plugins.json`,
      ],
    },
    null,
    2
  );

  const githubWorkflow = `name: Build Cloudstream Extensions

concurrency:
  group: "build"
  cancel-in-progress: true

on:
  push:
    branches:
      - main
      - master
    paths-ignore:
      - "*.md"
      - "src/**"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout source
        uses: actions/checkout@v7
        with:
          path: repo_src

      - name: Setup JDK 17
        uses: actions/setup-java@v6
        with:
          distribution: temurin
          java-version: "17"

      - name: Setup Android SDK
        uses: android-actions/setup-android@v4

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v6
        with:
          gradle-version: "8.12"
          cache-provider: basic

      - name: Build .cs3 plugins and plugins.json
        working-directory: repo_src
        run: gradle make makePluginsJson --no-daemon --stacktrace

      - name: Prepare builds branch output
        run: |
          mkdir -p builds_out
          find repo_src -path "*/build/*.cs3" -exec cp {} builds_out/ \\;
          cp repo_src/build/plugins.json builds_out/plugins.json
          node -e '
            const fs = require("fs");
            const repo = process.env.GITHUB_REPOSITORY;
            const raw = JSON.parse(fs.readFileSync("repo_src/repo.json", "utf8"));
            raw.pluginLists = [\`https://raw.githubusercontent.com/\${repo}/builds/plugins.json\`];
            fs.writeFileSync("builds_out/repo.json", JSON.stringify(raw, null, 2) + "\\n");
          '

      - name: Publish to builds branch
        working-directory: builds_out
        run: |
          git init
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout -b builds
          git add .
          git commit -m "Build \${{ github.sha }}"
          git remote add origin "https://x-access-token:\${{ secrets.GITHUB_TOKEN }}@github.com/\${{ github.repository }}.git"
          git push --force origin builds
`;

  const readmeMd = `# ${cleanRepoTitle}

Personal Cloudstream 3 extension repository for **TVizle.tr** (powered by open-source \`iptv-org/iptv\` channel metadata and public HLS streams).

## Quick Install (Zero Local Android SDK Needed)

1. Push this repository to GitHub (on \`main\` or \`master\`).
2. Open the **Actions** tab on GitHub and run **Build Cloudstream Extensions** (it also runs automatically on push).
3. After ~2 minutes, the workflow creates a \`builds\` branch containing \`TvizleProvider.cs3\`, \`plugins.json\`, and \`repo.json\` automatically configured for your GitHub repository.
4. In the **Cloudstream** Android app:
   - Go to **Settings -> Extensions -> Add repository**
   - Paste:
     \`\`\`
     https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/builds/repo.json
     \`\`\`
     (replacing \`${cleanUser}/${cleanRepo}\` with your GitHub \`username/repo\`)
   - Install **TVizle.tr** from the newly added repository.
`;

  return [
    {
      path: "TvizleProvider/src/main/kotlin/com/tvizle/TvizleProvider.kt",
      language: "kotlin",
      description: "MainAPI provider implementing browse, search, channel metadata, and HLS stream extraction.",
      content: providerKt,
    },
    {
      path: "TvizleProvider/src/main/kotlin/com/tvizle/TvizlePlugin.kt",
      language: "kotlin",
      description: "CloudstreamPlugin entry point registering TvizleProvider.",
      content: pluginEntryKt,
    },
    {
      path: "TvizleProvider/src/main/AndroidManifest.xml",
      language: "xml",
      description: "Minimal Android library manifest required by AGP 8+.",
      content: androidManifest,
    },
    {
      path: "TvizleProvider/build.gradle.kts",
      language: "kotlin",
      description: "Extension module metadata (version, language, status, Live tvType, icon).",
      content: pluginBuildGradle,
    },
    {
      path: "build.gradle.kts",
      language: "kotlin",
      description: "Root Gradle configuration with Cloudstream 3 plugin and Android SDK 35 targets.",
      content: rootBuildGradle,
    },
    {
      path: "settings.gradle.kts",
      language: "kotlin",
      description: "Gradle subproject configuration including TvizleProvider.",
      content: settingsGradle,
    },
    {
      path: "gradle.properties",
      language: "properties",
      description: "JVM heap and AndroidX flags.",
      content: gradleProperties,
    },
    {
      path: "repo.json",
      language: "json",
      description: "Cloudstream repository manifest pointing to builds/plugins.json.",
      content: repoJson,
    },
    {
      path: ".github/workflows/build.yml",
      language: "yaml",
      description: "GitHub Actions workflow that compiles .cs3 and publishes the builds branch automatically.",
      content: githubWorkflow,
    },
    {
      path: "README.md",
      language: "markdown",
      description: "Step-by-step GitHub Actions build and Cloudstream installation guide.",
      content: readmeMd,
    },
  ];
}
