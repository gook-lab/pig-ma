import { useState, useCallback } from "react";
import { X, Figma, Copy, Download, Check, Loader2, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Z_MODAL_BACKDROP, Z_MODAL_CONTENT } from "@/constants/zIndex";
import { useCanvasStore } from "@/store";
import {
  copyToFigmaClipboard,
  downloadSvgFile,
  downloadFigmaJson,
  exportToFigmaJson,
} from "@/figma/export";

interface FigmaExportModalProps {
  onClose: () => void;
}

type CopyState =
  | { status: "idle" }
  | { status: "copying" }
  | { status: "copied" }
  | { status: "error"; message: string };

export function FigmaExportModal({ onClose }: FigmaExportModalProps) {
  const objects = useCanvasStore((s) => s.objects);
  const [svgCopyState, setSvgCopyState] = useState<CopyState>({
    status: "idle",
  });
  const [jsonCopyState, setJsonCopyState] = useState<CopyState>({
    status: "idle",
  });

  const exportableObjects = objects.filter(
    (obj) => obj.type !== "connectorLabel",
  );

  // SVG clipboard (paste as single vector in Figma)
  const handleCopySvg = useCallback(async () => {
    if (exportableObjects.length === 0) return;
    setSvgCopyState({ status: "copying" });
    try {
      await copyToFigmaClipboard(exportableObjects);
      setSvgCopyState({ status: "copied" });
      setTimeout(() => setSvgCopyState({ status: "idle" }), 2000);
    } catch (err) {
      setSvgCopyState({
        status: "error",
        message: err instanceof Error ? err.message : "Copy failed",
      });
    }
  }, [exportableObjects]);

  // JSON clipboard (paste into pig-ma Figma plugin for editable nodes)
  const handleCopyJson = useCallback(async () => {
    if (exportableObjects.length === 0) return;
    setJsonCopyState({ status: "copying" });
    try {
      const data = exportToFigmaJson(exportableObjects);
      await navigator.clipboard.writeText(JSON.stringify(data));
      setJsonCopyState({ status: "copied" });
      setTimeout(() => setJsonCopyState({ status: "idle" }), 2000);
    } catch (err) {
      setJsonCopyState({
        status: "error",
        message: err instanceof Error ? err.message : "Copy failed",
      });
    }
  }, [exportableObjects]);

  // SVG file download
  const handleDownloadSvg = useCallback(() => {
    if (exportableObjects.length === 0) return;
    downloadSvgFile(exportableObjects);
  }, [exportableObjects]);

  const isEmpty = exportableObjects.length === 0;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30"
        style={{ zIndex: Z_MODAL_BACKDROP }}
        onClick={onClose}
      />

      <div
        className="popover-enter fixed left-1/2 top-1/2 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
        style={{ zIndex: Z_MODAL_CONTENT }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Figma size={20} />
            <h2 className="text-lg font-semibold text-gray-900">
              Export to Figma
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          {exportableObjects.length} objects to export
        </p>

        {/* ===== Option 1: Editable nodes via plugin (recommended) ===== */}
        <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Puzzle size={16} className="text-violet-600" />
            <span className="text-sm font-semibold text-violet-900">
              Editable nodes (recommended)
            </span>
          </div>
          <p className="mb-3 text-xs text-violet-700/80">
            Each shape becomes an independent, editable Figma node. Requires the
            pig-ma Figma plugin.
          </p>

          {/* Step 1: Copy JSON */}
          <button
            onClick={handleCopyJson}
            disabled={isEmpty || jsonCopyState.status === "copying"}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
              "hover:bg-white active:scale-[0.98]",
              jsonCopyState.status === "copied"
                ? "border-green-300 bg-green-50"
                : "border-violet-200 bg-white",
              isEmpty && "cursor-not-allowed opacity-40",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                jsonCopyState.status === "copied"
                  ? "bg-green-100 text-green-600"
                  : "bg-violet-100 text-violet-600",
              )}
            >
              {jsonCopyState.status === "copying" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : jsonCopyState.status === "copied" ? (
                <Check size={16} />
              ) : (
                <Copy size={16} />
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-gray-900">
                {jsonCopyState.status === "copied"
                  ? "Copied! Now paste in the plugin"
                  : "Step 1: Copy for Figma plugin"}
              </div>
              <div className="text-[11px] text-gray-500">
                Step 2: In Figma, run pig-ma plugin → paste → Import
              </div>
            </div>
          </button>

          {/* Copy + Download row */}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                if (isEmpty) return;
                downloadFigmaJson(exportableObjects);
              }}
              disabled={isEmpty}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-violet-700 transition-all",
                "hover:bg-violet-50 active:scale-[0.98]",
                isEmpty && "cursor-not-allowed opacity-40",
              )}
            >
              <Download size={12} />
              Download .json
            </button>
            <span className="text-[11px] text-violet-500/70">
              Plugin:{" "}
              <code className="rounded bg-violet-100 px-1 py-0.5 text-[10px]">
                figma-plugin/
              </code>{" "}
              → Figma Plugins → Import from manifest
            </span>
          </div>
        </div>

        {/* ===== Option 2: Quick export (SVG) ===== */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Quick export (SVG → editable nodes)
          </span>

          <div className="flex gap-2">
            {/* Copy SVG */}
            <button
              onClick={handleCopySvg}
              disabled={isEmpty || svgCopyState.status === "copying"}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all",
                "hover:bg-gray-50 active:scale-[0.98]",
                svgCopyState.status === "copied"
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200",
                isEmpty && "cursor-not-allowed opacity-40",
              )}
            >
              {svgCopyState.status === "copied" ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <Copy size={14} className="text-gray-500" />
              )}
              <span className="text-xs font-medium text-gray-700">
                {svgCopyState.status === "copied" ? "Copied!" : "Copy SVG"}
              </span>
            </button>

            {/* Download SVG */}
            <button
              onClick={handleDownloadSvg}
              disabled={isEmpty}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-left transition-all",
                "hover:bg-gray-50 active:scale-[0.98]",
                isEmpty && "cursor-not-allowed opacity-40",
              )}
            >
              <Download size={14} className="text-gray-500" />
              <span className="text-xs font-medium text-gray-700">
                Download .svg
              </span>
            </button>
          </div>
        </div>

        {/* Error */}
        {(svgCopyState.status === "error" ||
          jsonCopyState.status === "error") && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {svgCopyState.status === "error"
              ? svgCopyState.message
              : jsonCopyState.status === "error"
                ? jsonCopyState.message
                : ""}
          </div>
        )}
      </div>
    </>
  );
}
