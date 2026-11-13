import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { ExtensionConfig, GeneratedFile } from "../lib/extensionGenerator";

interface RepoCustomizerProps {
  config: ExtensionConfig;
  onChange: (next: ExtensionConfig) => void;
  files: GeneratedFile[];
  onDownloadZip: () => void;
}

export function RepoCustomizer({
  config,
  onChange,
  files,
  onDownloadZip,
}: RepoCustomizerProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const cleanUser = config.githubUser.trim() || "your-username";
  const cleanRepo = config.repoName.trim() || "tvizle-cloudstream";
  const rawRepoUrl = `https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/builds/repo.json`;
  const repoJsonFile = files.find((f) => f.path === "repo.json");

  function copyRepoUrl() {
    navigator.clipboard.writeText(rawRepoUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1800);
  }

  return (
    <div className="space-y-8">
      <div className="pb-5 border-b border-slate-200">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
          Repository Manifest & GitHub Actions Config
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure your personal GitHub details below. Changes update{" "}
          <span className="font-mono text-slate-800">repo.json</span>,{" "}
          <span className="font-mono text-slate-800">build.gradle.kts</span>,{" "}
          <span className="font-mono text-slate-800">TvizleProvider.kt</span>, and the downloadable ZIP automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900">
            Extension Identity & Streams
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">
                GitHub Username
              </span>
              <input
                type="text"
                value={config.githubUser}
                onChange={(e) =>
                  onChange({ ...config, githubUser: e.target.value })
                }
                placeholder="your-username"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">
                GitHub Repository Name
              </span>
              <input
                type="text"
                value={config.repoName}
                onChange={(e) =>
                  onChange({ ...config, repoName: e.target.value })
                }
                placeholder="tvizle-cloudstream"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">
                Plugin Author
              </span>
              <input
                type="text"
                value={config.authorName}
                onChange={(e) =>
                  onChange({ ...config, authorName: e.target.value })
                }
                placeholder="Your Name"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">
                Provider Language Tag
              </span>
              <select
                value={config.pluginLang}
                onChange={(e) =>
                  onChange({ ...config, pluginLang: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              >
                <option value="tr">tr (Turkish)</option>
                <option value="en">en (International)</option>
                <option value="multi">multi (Multilingual)</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-700">
              Repository Display Title
            </span>
            <input
              type="text"
              value={config.repoDisplayName}
              onChange={(e) =>
                onChange({ ...config, repoDisplayName: e.target.value })
              }
              placeholder="TVizle.tr Extensions"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
            />
          </label>

          <label className="flex items-start gap-3 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeProxyStreams}
              onChange={(e) =>
                onChange({ ...config, includeProxyStreams: e.target.checked })
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-600"
            />
            <div>
              <div className="text-sm font-medium text-slate-900">
                Include TVizle.tr proxy fallback streams (/api/yayin)
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Useful when an upstream broadcaster blocks direct mobile playback; both direct .m3u8 URLs and proxy URLs will appear in Cloudstream's source picker.
              </div>
            </div>
          </label>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Cloudstream Repository URL
            </h2>
            <p className="text-xs text-slate-500">
              Paste this URL into Cloudstream Android under Settings · Extensions · Add repository after pushing to GitHub.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 break-all">
                {rawRepoUrl}
              </code>
              <button
                type="button"
                onClick={copyRepoUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onDownloadZip}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Download Configured Extension ZIP
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-xs font-semibold text-slate-700">
              Generated repo.json Preview
            </div>
            <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
              {repoJsonFile?.content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstallGuide({
  config,
  onDownloadZip,
}: {
  config: ExtensionConfig;
  onDownloadZip: () => void;
}) {
  const cleanUser = config.githubUser.trim() || "your-username";
  const cleanRepo = config.repoName.trim() || "tvizle-cloudstream";
  const rawRepoUrl = `https://raw.githubusercontent.com/${cleanUser}/${cleanRepo}/builds/repo.json`;

  const steps = [
    {
      num: "01. Download and extract the extension project",
      body: "Click Download Extension ZIP to save the complete Gradle repository (TvizleProvider, build.gradle.kts, repo.json, and GitHub Actions workflow).",
    },
    {
      num: "02. Push to your GitHub repository",
      body: `Create a repository named ${cleanRepo} under ${cleanUser} on GitHub, then push the extracted folder to the main branch.`,
      code: `git init\ngit add .\ngit commit -m "Add TVizle.tr Cloudstream extension"\ngit branch -M main\ngit remote add origin https://github.com/${cleanUser}/${cleanRepo}.git\ngit push -u origin main`,
    },
    {
      num: "03. Let GitHub Actions compile the .cs3 package",
      body: "The included .github/workflows/build.yml workflow installs JDK 17, Android SDK 35, and Gradle 8.11.1, compiles TvizleProvider.cs3, and publishes plugins.json + repo.json to the builds branch automatically.",
    },
    {
      num: "04. Add the repository inside Cloudstream 3",
      body: "Open Cloudstream on Android, go to Settings -> Extensions -> Add repository, and paste your raw repo.json link below.",
      code: rawRepoUrl,
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="pb-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
            Build & Install Guide for Cloudstream 3
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Compile your <span className="font-mono text-slate-800">.cs3</span> Android extension in ~2 minutes via GitHub Actions with zero local Android Studio setup.
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadZip}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          <Download className="h-4 w-4" />
          Download ZIP
        </button>
      </div>

      <div className="space-y-6">
        {steps.map((step) => (
          <section
            key={step.num}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
          >
            <h2 className="text-base font-semibold text-slate-900">{step.num}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
            {step.code && (
              <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed">
                {step.code}
              </pre>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
