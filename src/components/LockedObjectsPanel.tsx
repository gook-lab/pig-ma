import { useMemo, useState } from "react";
import { Lock, Unlock, X } from "lucide-react";
import { useCanvasStore } from "@/store";
import { Z_SIDE_PANEL } from "@/constants/zIndex";
import type { CanvasObject } from "@/types";
import { cn } from "@/lib/utils";

/** 잠긴 객체를 목록으로 보여주는 사람 읽기용 라벨 */
function objectLabel(obj: CanvasObject): string {
  const text = obj.text?.trim() || obj.chartTitle?.trim();
  if (text) return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  switch (obj.type) {
    case "shape":
      return obj.shapeVariant ?? "Shape";
    case "stickyNote":
      return "Sticky note";
    case "textBox":
      return "Text";
    case "codeBlock":
      return obj.codeLanguage ?? "Code";
    case "chart":
      return obj.chartData?.variant
        ? `${obj.chartData.variant} chart`
        : "Chart";
    case "connector":
      return "Connector";
    case "table":
      return "Table";
    case "image":
      return "Image";
    case "embed":
      return "Embed";
    case "line":
      return "Drawing";
    default:
      return obj.type;
  }
}

/**
 * 잠금 객체 일괄 관리 패널.
 *
 * 잠긴 객체는 클릭 선택이 안 되어 하나씩 찾아 풀기 어렵다 — 잠긴 객체가
 * 있을 때만 좌하단에 칩이 나타나고, 패널에서 개별/일괄 해제와 위치 이동을
 * 제공한다. (UI 텍스트는 규칙에 따라 영어)
 */
export function LockedObjectsPanel() {
  const [open, setOpen] = useState(false);
  const objects = useCanvasStore((s) => s.objects);
  const hideUI = useCanvasStore((s) => s.hideUI);

  const lockedObjects = useMemo(
    () => objects.filter((o) => o.locked),
    [objects],
  );

  if (hideUI || lockedObjects.length === 0) return null;

  const unlock = (ids: string[]) => {
    useCanvasStore.getState().setObjectsLocked(ids, false);
  };

  const panTo = (obj: CanvasObject) => {
    const { viewport, setViewport } = useCanvasStore.getState();
    const cx = obj.x + (obj.width ?? 100) / 2;
    const cy = obj.y + (obj.height ?? 100) / 2;
    setViewport({
      x: window.innerWidth / 2 - cx * viewport.zoom,
      y: window.innerHeight / 2 - cy * viewport.zoom,
    });
  };

  return (
    <div
      className="fixed bottom-4 left-4"
      style={{ zIndex: Z_SIDE_PANEL }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {open && (
        <div className="mb-2 w-64 rounded-lg bg-gray-800 shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-600 px-3 py-2">
            <span className="text-sm font-semibold text-white">
              Locked objects ({lockedObjects.length})
            </span>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 transition-all hover:bg-gray-700"
              aria-label="Close panel"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {lockedObjects.map((obj) => (
              <div
                key={obj.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700"
              >
                <button
                  onClick={() => panTo(obj)}
                  className="flex-1 truncate text-left text-sm text-white"
                  title="Go to object"
                >
                  {objectLabel(obj)}
                </button>
                <button
                  onClick={() => unlock([obj.id])}
                  className="rounded p-1 transition-all hover:bg-gray-600"
                  title="Unlock"
                  aria-label="Unlock object"
                >
                  <Unlock className="h-4 w-4 text-gray-300" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-600 p-2">
            <button
              onClick={() => unlock(lockedObjects.map((o) => o.id))}
              className="w-full rounded bg-red-600 px-3 py-1.5 text-sm text-white transition-all hover:bg-red-700"
            >
              Unlock all
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-2 shadow-lg transition-all",
          open
            ? "bg-violet-600 hover:bg-violet-700"
            : "bg-gray-800 hover:bg-gray-700",
        )}
        title="Locked objects"
      >
        <Lock className="h-4 w-4 text-white" />
        <span className="text-sm font-medium text-white">
          {lockedObjects.length}
        </span>
      </button>
    </div>
  );
}
