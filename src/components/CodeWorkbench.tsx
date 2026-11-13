import { useState } from "react";
import { Check, Copy, Download, FileCode } from "lucide-react";
import type { GeneratedFile } from "../lib/extensionGenerator";

interface CodeWorkbenchProps {
  files: GeneratedFile[];
}

export function CodeWorkbench({ files }: CodeWorkbenchProps) {
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path || "");
  const [copied, setCopied] = useState(false);

  const activeFile = files.find((f) => f.path === selectedPath) || files[0];
  if (!activeFile) return null;

  const lines = activeFile.content.split("\n");

  function handleCopy() {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadSingle() {
    const blob = new Blob([activeFile.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile.path.split("/").pop() || "file.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-slate-200">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance">
          Cloudstream 3 Kotlin Extension Source
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Complete multi-module Gradle project targeting <span className="font-mono text-slate-800">com.lagradost:cloudstream3:pre-release</span> with <span className="font-mono text-slate-800">LiveSearchResponse</span> and <span className="font-mono text-slate-800">newExtractorLink</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-xs font-semibold text-slate-700">
            Repository Files ({files.length})
          </div>
          <nav className="divide-y divide-slate-100">
            {files.map((file) => {
              const isSelected = file.path === activeFile.path;
              const fileName = file.path.split("/").pop() || file.path;
              const folder = file.path.includes("/")
                ? file.path.slice(0, file.path.lastIndexOf("/"))
                : "root";
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-2.5 transition-colors cursor-pointer ${
                    isSelected ? "bg-rose-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <FileCode
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      isSelected ? "text-rose-600" : "text-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-medium text-slate-900 truncate">
                      {fileName}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                      {folder}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold text-slate-900 truncate">
                {activeFile.path}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {activeFile.description}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy File
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadSingle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                Save File
              </button>
            </div>
          </div>

          <div className="bg-slate-950 text-slate-100 overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="w-full border-collapse font-mono text-xs leading-relaxed">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-slate-900/70">
                    <td className="select-none text-right pr-4 pl-4 py-0.5 text-slate-500 tabular-nums w-12 align-top">
                      {i + 1}
                    </td>
                    <td className="pr-4 py-0.5 whitespace-pre text-slate-100">
                      {line || " "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
