import { History, X, Trash2, RotateCcw, Save } from "lucide-react";
import { useState, useMemo } from "react";
import {
  useHistoryStore,
  useAutoSave,
  type HistorySnapshot,
} from "@/hooks/useAutoSave";
import { useCanvasStore, clearHistory as clearUndoRedoStack } from "@/store";
import type { CanvasObject } from "@/types";
import { cn } from "@/lib/utils";

interface StoreState {
  currentPageId: string;
  objects: CanvasObject[];
}

export function HistoryPanel() {
  const [showPanel, setShowPanel] = useState(false);
  const { snapshots, deleteSnapshot, clearPageHistory } = useHistoryStore();
  const { saveNow } = useAutoSave();
  const currentPageId = useCanvasStore((s: StoreState) => s.currentPageId);

  // 현재 페이지의 스냅샷만 필터링
  const pageSnapshots = useMemo(
    () =>
      snapshots.filter(
        (s: HistorySnapshot) => s.pageId === currentPageId || s.pageId === "",
      ),
    [snapshots, currentPageId],
  );

  const handleRestore = (snapshotId: string) => {
    const snapshot = pageSnapshots.find(
      (s: HistorySnapshot) => s.id === snapshotId,
    );
    if (snapshot) {
      // Replace all objects and groups with the snapshot
      const store = useCanvasStore.getState();
      // Clear current objects
      store.setSelectedIds([]);
      // We need to replace the objects array
      // Using a workaround: delete all and add all from snapshot
      const currentIds = store.objects.map((o: CanvasObject) => o.id);
      currentIds.forEach((id: string) => {
        const state = useCanvasStore.getState();
        useCanvasStore.setState({
          objects: state.objects.filter((o: CanvasObject) => o.id !== id),
        });
      });
      // Add snapshot objects
      snapshot.objects.forEach((obj: CanvasObject) => {
        useCanvasStore.getState().addObject(obj);
      });
      // Restore groups
      useCanvasStore.setState({ groups: snapshot.groups ?? [] });
      // Undo/Redo 스택 초기화
      clearUndoRedoStack();
      setShowPanel(false);
    }
  };

  const handleClearHistory = () => {
    clearPageHistory(currentPageId);
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={cn(
          "fixed right-20 bottom-4 z-40 p-3",
          "rounded-full border border-gray-200 bg-white shadow-lg",
          "transition-colors hover:bg-gray-50",
          showPanel && "bg-gray-100",
        )}
        title="히스토리"
      >
        <History className="h-5 w-5 text-gray-600" />
      </button>

      {/* Panel */}
      {showPanel && (
        <div
          className={cn(
            "fixed right-20 bottom-20 z-40",
            "w-72 rounded-xl border border-gray-200 bg-white shadow-xl",
            "overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-700">히스토리</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={saveNow}
                className="rounded p-1.5 transition-colors hover:bg-gray-100"
                title="지금 저장"
              >
                <Save className="h-4 w-4 text-gray-500" />
              </button>
              <button
                onClick={() => setShowPanel(false)}
                className="rounded p-1 transition-colors hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Snapshots list */}
          <div className="max-h-80 overflow-y-auto">
            {pageSnapshots.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                저장된 히스토리가 없습니다
              </div>
            ) : (
              <div className="p-2">
                {pageSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2",
                      "group transition-colors hover:bg-gray-50",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-gray-700">
                        {snapshot.label}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatTimeAgo(snapshot.timestamp)} ·{" "}
                        {snapshot.objects.length}개 객체
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleRestore(snapshot.id)}
                        className="rounded p-1.5 transition-colors hover:bg-blue-100"
                        title="복원"
                      >
                        <RotateCcw className="h-4 w-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => deleteSnapshot(snapshot.id)}
                        className="rounded p-1.5 transition-colors hover:bg-red-100"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {pageSnapshots.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
              <button
                onClick={handleClearHistory}
                className="text-xs text-red-500 transition-colors hover:text-red-600"
              >
                현재 페이지 히스토리 삭제
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
