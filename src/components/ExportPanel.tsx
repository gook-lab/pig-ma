import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Download, X, Loader2 } from "lucide-react";
import Konva from "konva";
import { cn } from "@/lib/utils";
import { Z_MODAL_BACKDROP, Z_MODAL_CONTENT } from "@/constants/zIndex";
import { useCanvasStore } from "@/store";
import { getObjectBounds } from "@/utils/geometry";
import { exportToSvg } from "@/figma/export";

type ExportFormat = "png" | "jpeg" | "svg";
type ExportScope = "all" | "selected";

const SCALES = [0.5, 1, 2, 3, 4];

/** Hide caption markers and grid, set viewport, optionally add background rect */
function prepareStageForExport(
  stage: import("konva/lib/Stage").Stage,
  bounds: { x: number; y: number; width: number; height: number },
  withBackground: boolean,
) {
  // Hide captions & grid
  const hiddenNodes: import("konva/lib/Node").Node[] = [];
  stage.find(".caption-marker").forEach((node) => {
    if (node.visible()) {
      node.visible(false);
      hiddenNodes.push(node);
    }
  });
  stage.find(".grid").forEach((node) => {
    if (node.visible()) {
      node.visible(false);
      hiddenNodes.push(node);
    }
  });

  // Save state
  const oldScale = stage.scaleX();
  const oldPos = { x: stage.x(), y: stage.y() };
  const oldW = stage.width();
  const oldH = stage.height();

  // Set viewport to fit export bounds at 1:1 scale
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: -bounds.x, y: -bounds.y });
  stage.width(bounds.width);
  stage.height(bounds.height);

  // Add white background rect to first layer
  let bgRect: Konva.Rect | null = null;
  if (withBackground) {
    bgRect = new Konva.Rect({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fill: "#fafafa",
      listening: false,
      name: "export-bg",
    });
    const firstLayer = stage.getLayers()[0];
    if (firstLayer) {
      firstLayer.add(bgRect);
      bgRect.moveToBottom();
    }
  }

  stage.batchDraw();

  return {
    restore: () => {
      if (bgRect) bgRect.destroy();
      hiddenNodes.forEach((node) => node.visible(true));
      stage.scale({ x: oldScale, y: oldScale });
      stage.position(oldPos);
      stage.width(oldW);
      stage.height(oldH);
      stage.batchDraw();
    },
  };
}

export function ExportPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState(2);
  const [scope, setScope] = useState<ExportScope>("all");
  const [includeBackground, setIncludeBackground] = useState(true);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useCanvasStore((s) => s.stageRef);
  const objects = useCanvasStore((s) => s.objects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-export-panel", handler);
    return () => window.removeEventListener("open-export-panel", handler);
  }, []);

  // Auto-select scope based on selection
  useEffect(() => {
    if (isOpen && selectedIds.length > 0) {
      setScope("selected");
    }
  }, [isOpen, selectedIds.length]);

  // Calculate export bounds
  const exportBounds = useMemo(() => {
    const targetObjects =
      scope === "selected" && selectedIds.length > 0
        ? objects.filter((o) => selectedIds.includes(o.id))
        : objects;

    if (targetObjects.length === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const obj of targetObjects) {
      const b = getObjectBounds(obj);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }

    const padding = 40;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [objects, selectedIds, scope]);

  const exportWidth = exportBounds ? Math.round(exportBounds.width * scale) : 0;
  const exportHeight = exportBounds
    ? Math.round(exportBounds.height * scale)
    : 0;

  // Generate preview thumbnail
  useEffect(() => {
    if (!isOpen || !exportBounds || !previewRef.current) return;
    const stage = stageRef?.current;
    if (!stage) return;

    const canvas = previewRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const previewPixelRatio = Math.min(
      canvas.width / exportBounds.width,
      canvas.height / exportBounds.height,
    );

    const { restore } = prepareStageForExport(
      stage,
      exportBounds,
      includeBackground,
    );
    const dataUrl = stage.toDataURL({
      mimeType: "image/png",
      pixelRatio: previewPixelRatio,
    });
    restore();

    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!includeBackground) {
        const sz = 8;
        for (let y = 0; y < canvas.height; y += sz) {
          for (let x = 0; x < canvas.width; x += sz) {
            ctx.fillStyle = (x / sz + y / sz) % 2 === 0 ? "#f0f0f0" : "#fff";
            ctx.fillRect(x, y, sz, sz);
          }
        }
      } else {
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const imgScale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height,
      );
      const w = img.width * imgScale;
      const h = img.height * imgScale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    img.src = dataUrl;
  }, [isOpen, exportBounds, stageRef, includeBackground, scope]);

  const handleExport = useCallback(async () => {
    if (!exportBounds) return;
    const stage = stageRef?.current;
    if (!stage) return;

    setIsExporting(true);

    try {
      if (format === "svg") {
        // SVG export
        const targetObjects =
          scope === "selected" && selectedIds.length > 0
            ? objects.filter((o) => selectedIds.includes(o.id))
            : objects;
        const svg = exportToSvg(targetObjects);
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = downloadLinkRef.current;
        if (link) {
          link.href = url;
          link.download = `export-${Date.now()}.svg`;
          link.click();
        }
        URL.revokeObjectURL(url);
      } else {
        // Raster export (PNG/JPEG) — pixelRatio controls actual resolution
        const { restore } = prepareStageForExport(
          stage,
          exportBounds,
          includeBackground,
        );

        const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
        const quality = format === "jpeg" ? 0.92 : 1;
        const dataUrl = stage.toDataURL({
          mimeType,
          quality,
          pixelRatio: scale,
        });

        restore();

        const link = downloadLinkRef.current;
        if (link) {
          link.href = dataUrl;
          link.download = `export-${Date.now()}.${format}`;
          link.click();
        }
      }

      setIsOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  }, [stageRef, format, scale, scope, exportBounds, objects, selectedIds]);

  return (
    <>
      <a ref={downloadLinkRef} className="hidden" />

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30"
            style={{ zIndex: Z_MODAL_BACKDROP }}
            onClick={() => setIsOpen(false)}
          />

          <div
            className={cn(
              "popover-enter fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[420px] rounded-2xl bg-white p-5 shadow-2xl",
            )}
            style={{ zIndex: Z_MODAL_CONTENT }}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Export image
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Preview */}
            <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <canvas
                ref={previewRef}
                width={380}
                height={200}
                className="block w-full"
              />
            </div>

            {/* Scope */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setScope("all")}
                className={cn(
                  "flex-1 rounded-lg border-2 py-2 text-xs font-medium transition-all",
                  scope === "all"
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300",
                )}
              >
                All objects
              </button>
              <button
                onClick={() => setScope("selected")}
                disabled={selectedIds.length === 0}
                className={cn(
                  "flex-1 rounded-lg border-2 py-2 text-xs font-medium transition-all",
                  scope === "selected"
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300",
                  selectedIds.length === 0 && "cursor-not-allowed opacity-40",
                )}
              >
                Selected ({selectedIds.length})
              </button>
            </div>

            {/* Format + Scale row */}
            <div className="mb-3 flex gap-3">
              {/* Format */}
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium tracking-wide text-gray-400 uppercase">
                  Format
                </label>
                <div className="flex gap-1">
                  {(["png", "jpeg", "svg"] as ExportFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "flex-1 rounded-md border py-1.5 text-xs font-medium transition-all",
                        format === f
                          ? "border-violet-500 bg-violet-50 text-violet-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300",
                      )}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scale */}
              {format !== "svg" && (
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium tracking-wide text-gray-400 uppercase">
                    Scale
                  </label>
                  <div className="flex gap-1">
                    {SCALES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setScale(s)}
                        className={cn(
                          "flex-1 rounded-md border py-1.5 text-xs font-medium transition-all",
                          scale === s
                            ? "border-violet-500 bg-violet-50 text-violet-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300",
                        )}
                      >
                        {s === 0.5 ? "½" : `${s}x`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Background + Size info */}
            <div className="mb-3 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeBackground}
                  onChange={(e) => setIncludeBackground(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-xs text-gray-600">Background</span>
              </label>
              {format !== "svg" && exportBounds && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  {exportWidth} × {exportHeight}px
                </span>
              )}
            </div>
            {format !== "svg" && (
              <p className="mb-4 text-[11px] text-gray-400">
                Higher scale = more pixels = sharper when zoomed in or printed
              </p>
            )}

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={isExporting || !exportBounds}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-2.5",
                "bg-violet-500 text-sm font-medium text-white",
                "transition-all hover:bg-violet-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download {format.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </>
  );
}
