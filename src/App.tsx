import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Download } from "lucide-react";
import { ChannelExplorer } from "./components/ChannelExplorer";
import { CodeWorkbench } from "./components/CodeWorkbench";
import { InstallGuide, RepoCustomizer } from "./components/RepoCustomizer";
import {
  generateExtensionFiles,
  type ExtensionConfig,
} from "./lib/extensionGenerator";

type ActiveTab = "explorer" | "source" | "repo" | "guide";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("explorer");
  const [downloading, setDownloading] = useState(false);
  const [config, setConfig] = useState<ExtensionConfig>({
    githubUser: "your-username",
    repoName: "tvizle-cloudstream",
    authorName: "personal",
    pluginLang: "tr",
    includeProxyStreams: true,
    repoDisplayName: "TVizle.tr Extensions",
  });

  const files = useMemo(() => generateExtensionFiles(config), [config]);

  async function handleDownloadZip() {
    setDownloading(true);
    try {
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.path, file.content);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${config.repoName.trim() || "tvizle-cloudstream"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: "explorer", label: "Live Explorer" },
    { id: "source", label: "Kotlin Source" },
    { id: "repo", label: "Repo & CI" },
    { id: "guide", label: "Install Guide" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab("explorer")}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            TVizle Studio
          </button>

          <nav className="flex items-center gap-6 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
                    isActive
                      ? "text-slate-900 border-rose-600"
                      : "text-slate-600 border-transparent hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? "Building ZIP..." : "Download Extension ZIP"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === "explorer" && (
          <ChannelExplorer includeProxyStreams={config.includeProxyStreams} />
        )}
        {activeTab === "source" && <CodeWorkbench files={files} />}
        {activeTab === "repo" && (
          <RepoCustomizer
            config={config}
            onChange={setConfig}
            files={files}
            onDownloadZip={handleDownloadZip}
          />
        )}
        {activeTab === "guide" && (
          <InstallGuide config={config} onDownloadZip={handleDownloadZip} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            Channel metadata & open stream directory sourced from tvizle.tr and iptv-org/iptv
          </span>
          <a
            href="https://tvizle.tr/"
            target="_blank"
            rel="noreferrer"
            className="text-slate-700 hover:text-slate-900 underline underline-offset-2"
          >
            tvizle.tr
          </a>
        </div>
      </footer>
    </div>
  );
}
