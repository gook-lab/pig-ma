import { Lock } from "lucide-react";
import { useCanvasStore } from "@/store";

export function LockOverlay() {
  const isLocked = useCanvasStore((s) => s.isLocked);
  const toggleLock = useCanvasStore((s) => s.toggleLock);

  if (!isLocked) return null;

  return (
    <>
      {/* 화면 전체 테두리 - 주황색 */}
      <div
        className="pointer-events-none fixed inset-0 z-[60] border-4 border-orange-500"
        style={{ boxShadow: "inset 0 0 20px rgba(249, 115, 22, 0.3)" }}
      />

      {/* 헤더 중앙 잠금 뱃지 */}
      <div className="fixed top-4 left-1/2 z-[61] -translate-x-1/2">
        <button
          onClick={toggleLock}
          className="flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-orange-600 active:scale-95"
        >
          <Lock className="h-4 w-4" />
          <span>화면 잠금됨</span>
          <span className="rounded bg-orange-600 px-1.5 py-0.5 text-xs">
            클릭하여 해제
          </span>
        </button>
      </div>
    </>
  );
}
