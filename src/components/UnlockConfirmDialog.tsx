import { useState, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";
import { useCanvasStore } from "@/store";
import { cn } from "@/lib/utils";

export function UnlockConfirmDialog() {
  const [showDialog, setShowDialog] = useState(false);
  const { isLocked, setLocked } = useCanvasStore();

  // Listen for unlock request events
  useEffect(() => {
    const handleUnlockRequest = () => {
      if (isLocked) {
        setShowDialog(true);
      }
    };

    window.addEventListener("canvas-unlock-request", handleUnlockRequest);
    return () =>
      window.removeEventListener("canvas-unlock-request", handleUnlockRequest);
  }, [isLocked]);

  const handleUnlock = () => {
    setLocked(false); // store에서 Select Tool 전환 처리
    setShowDialog(false);
  };

  const handleCancel = () => {
    setShowDialog(false);
  };

  // Handle keyboard events (capture 단계에서 처리하여 다른 핸들러보다 먼저 실행)
  useEffect(() => {
    if (!showDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShowDialog(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        setLocked(false);
        setShowDialog(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // capture: true
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [showDialog, setLocked]);

  if (!showDialog) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[360px] max-w-[calc(100vw-32px)] rounded-2xl bg-white p-6 shadow-2xl">
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Lock className="h-8 w-8 text-amber-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center text-xl font-semibold text-gray-900">
          화면 잠금 해제
        </h2>

        {/* Description */}
        <p className="mb-6 text-center text-sm text-gray-500">
          잠금을 해제하면 캔버스를 다시 편집할 수 있습니다.
          <br />
          잠금을 해제하시겠습니까?
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium",
              "bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200",
            )}
          >
            취소
          </button>
          <button
            onClick={handleUnlock}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium",
              "bg-violet-600 text-white transition-colors hover:bg-violet-700",
              "flex items-center justify-center gap-2",
            )}
          >
            <Unlock className="h-4 w-4" />
            잠금 해제
          </button>
        </div>

        {/* Keyboard hint */}
        <p className="mt-4 text-center text-xs text-gray-400">
          Enter로 해제 · Esc로 취소
        </p>
      </div>
    </div>
  );
}
