import { useEffect, useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCanvasStore } from "@/store";
import type { CanvasObject, GroupInfo } from "@/types";

interface StoreState {
  objects: CanvasObject[];
  groups: GroupInfo[];
  currentPageId: string;
}

export interface HistorySnapshot {
  id: string;
  timestamp: number;
  pageId: string; // 스냅샷이 속한 페이지 ID
  objects: CanvasObject[];
  groups: GroupInfo[];
  label: string;
}

interface HistoryStore {
  snapshots: HistorySnapshot[];
  maxSnapshots: number;
  autoSaveInterval: number; // in minutes
  addSnapshot: (
    pageId: string,
    objects: CanvasObject[],
    groups: GroupInfo[],
    label?: string,
  ) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  clearHistory: () => void;
  clearPageHistory: (pageId: string) => void;
  setAutoSaveInterval: (minutes: number) => void;
  getPageSnapshots: (pageId: string) => HistorySnapshot[];
}

// 마이그레이션용 레거시 상태 타입
type HistoryStateLegacy = Record<string, unknown> & {
  snapshots?: Array<
    HistorySnapshot & { pageId?: string; groups?: GroupInfo[] }
  >;
};

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      snapshots: [],
      maxSnapshots: 20,
      autoSaveInterval: 10, // 10 minutes default

      addSnapshot: (pageId, objects, groups, label) => {
        const now = Date.now();
        const newSnapshot: HistorySnapshot = {
          id: `snapshot-${now}`,
          timestamp: now,
          pageId,
          objects: JSON.parse(JSON.stringify(objects)), // Deep clone
          groups: JSON.parse(JSON.stringify(groups)), // Deep clone
          label: label ?? formatTime(now),
        };

        set((state) => {
          const newSnapshots = [newSnapshot, ...state.snapshots];
          // Keep only the most recent snapshots
          return { snapshots: newSnapshots.slice(0, state.maxSnapshots) };
        });
      },

      restoreSnapshot: (id: string) => {
        const snapshot = get().snapshots.find(
          (s: HistorySnapshot) => s.id === id,
        );
        if (snapshot) {
          // This will be called from outside with the canvas store
          return snapshot.objects;
        }
      },

      deleteSnapshot: (id: string) => {
        set((state: HistoryStore) => ({
          snapshots: state.snapshots.filter(
            (s: HistorySnapshot) => s.id !== id,
          ),
        }));
      },

      clearHistory: () => set({ snapshots: [] }),

      clearPageHistory: (pageId: string) =>
        set((state: HistoryStore) => ({
          snapshots: state.snapshots.filter(
            (s: HistorySnapshot) => s.pageId !== pageId,
          ),
        })),

      setAutoSaveInterval: (minutes: number) =>
        set({ autoSaveInterval: minutes }),

      getPageSnapshots: (pageId: string) =>
        get().snapshots.filter((s: HistorySnapshot) => s.pageId === pageId),
    }),
    {
      name: "canvas-history",
      version: 2, // v2: Page system
      migrate: (persistedState, version) => {
        const state = persistedState as HistoryStateLegacy;

        if (version < 2) {
          // v1 -> v2: Add pageId to existing snapshots (set to empty string)
          return {
            ...state,
            snapshots:
              state.snapshots?.map(
                (
                  s: HistorySnapshot & {
                    pageId?: string;
                    groups?: GroupInfo[];
                  },
                ) => ({
                  ...s,
                  pageId: s.pageId ?? "",
                  groups: s.groups ?? [],
                }),
              ) ?? [],
          };
        }

        return state;
      },
    },
  ),
);

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return `오늘 ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

  return `${dateStr} ${timeStr}`;
}

export function useAutoSave() {
  const objects = useCanvasStore((state: StoreState) => state.objects);
  const groups = useCanvasStore((state: StoreState) => state.groups);
  const currentPageId = useCanvasStore(
    (state: StoreState) => state.currentPageId,
  );
  const { addSnapshot, autoSaveInterval } = useHistoryStore();

  // Auto-save at interval
  useEffect(() => {
    if (autoSaveInterval <= 0) return;

    const intervalMs = autoSaveInterval * 60 * 1000;

    const interval = setInterval(() => {
      if (objects.length > 0) {
        addSnapshot(currentPageId, objects, groups, `자동 저장`);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [objects, groups, currentPageId, addSnapshot, autoSaveInterval]);

  // Manual save function
  const saveNow = useCallback(() => {
    if (objects.length > 0) {
      addSnapshot(currentPageId, objects, groups, "수동 저장");
    }
  }, [objects, groups, currentPageId, addSnapshot]);

  return { saveNow };
}
