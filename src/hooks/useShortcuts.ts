import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ShortcutConfig, ShortcutAction } from "@/types";

// Version for migration - increment when shortcuts structure changes
const SHORTCUTS_VERSION = 4;

// Default shortcuts
const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  { action: "select", label: "선택 도구", binding: { key: "v" } },
  { action: "hand", label: "이동", binding: { key: "h" } },
  { action: "shape", label: "도형", binding: { key: "r" } },
  { action: "pencil", label: "펜", binding: { key: "p" } },
  { action: "eraser", label: "지우개", binding: { key: "e" } },
  { action: "stickyNote", label: "메모지", binding: { key: "s" } },
  { action: "connector", label: "연결선", binding: { key: "l" } },
  { action: "textBox", label: "텍스트", binding: { key: "t" } },
  { action: "chart", label: "차트", binding: { key: "k" } },
  { action: "delete", label: "삭제", binding: { key: "Delete" } },
  {
    action: "undo",
    label: "실행 취소",
    binding: { key: "z", modifiers: ["ctrl"] },
  },
  {
    action: "redo",
    label: "다시 실행",
    binding: { key: "z", modifiers: ["ctrl", "shift"] },
  },
];

interface ShortcutsStore {
  shortcuts: ShortcutConfig[];
  version: number;
  showPanel: boolean;
  isCapturing: boolean; // 키 캡처 모드 - 전역 단축키 비활성화
  setShortcuts: (shortcuts: ShortcutConfig[]) => void;
  updateShortcut: (
    action: ShortcutAction,
    binding: ShortcutConfig["binding"],
  ) => void;
  resetToDefaults: () => void;
  togglePanel: () => void;
  setShowPanel: (show: boolean) => void;
  setCapturing: (value: boolean) => void;
}

export const useShortcutsStore = create<ShortcutsStore>()(
  persist(
    (set) => ({
      shortcuts: DEFAULT_SHORTCUTS,
      version: SHORTCUTS_VERSION,
      showPanel: false,
      isCapturing: false,

      setShortcuts: (shortcuts) => set({ shortcuts }),

      updateShortcut: (action, binding) =>
        set((state) => ({
          shortcuts: state.shortcuts.map((s) =>
            s.action === action ? { ...s, binding } : s,
          ),
        })),

      resetToDefaults: () =>
        set({ shortcuts: DEFAULT_SHORTCUTS, version: SHORTCUTS_VERSION }),

      togglePanel: () => set((state) => ({ showPanel: !state.showPanel })),

      setShowPanel: (show) => set({ showPanel: show }),

      setCapturing: (value) => set({ isCapturing: value }),
    }),
    {
      name: "canvas-shortcuts",
      version: SHORTCUTS_VERSION,
      partialize: (state) => ({
        shortcuts: state.shortcuts,
        version: state.version,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // If version mismatch, reset to defaults
        if (version < SHORTCUTS_VERSION) {
          return {
            shortcuts: DEFAULT_SHORTCUTS,
            version: SHORTCUTS_VERSION,
            showPanel: false,
          };
        }
        return persistedState as ShortcutsStore;
      },
    },
  ),
);

// Helper to format binding for display
export function formatBinding(binding: ShortcutConfig["binding"]): string {
  // Handle empty binding
  if (!binding.key) return "";

  const parts: string[] = [];
  if (binding.modifiers?.includes("ctrl")) parts.push("Ctrl");
  if (binding.modifiers?.includes("shift")) parts.push("Shift");
  if (binding.modifiers?.includes("alt")) parts.push("Alt");
  if (binding.modifiers?.includes("meta")) parts.push("⌘");

  // Format key name
  let keyName = binding.key;
  if (keyName === "Delete") keyName = "Del";
  else if (keyName === "Backspace") keyName = "⌫";
  else if (keyName === "ArrowUp") keyName = "↑";
  else if (keyName === "ArrowDown") keyName = "↓";
  else if (keyName === "ArrowLeft") keyName = "←";
  else if (keyName === "ArrowRight") keyName = "→";
  else keyName = keyName.toUpperCase();

  parts.push(keyName);
  return parts.join(" + ");
}

// Map from key to physical key code (for non-English keyboard layouts)
const KEY_TO_CODE: Record<string, string> = {
  v: "KeyV",
  h: "KeyH",
  r: "KeyR",
  p: "KeyP",
  e: "KeyE",
  s: "KeyS",
  l: "KeyL",
  t: "KeyT",
  c: "KeyC",
  z: "KeyZ",
  a: "KeyA",
  x: "KeyX",
  d: "KeyD",
  k: "KeyK",
};

// Special keys that should match exactly (case-sensitive)
const SPECIAL_KEYS = [
  "Delete",
  "Backspace",
  "Enter",
  "Escape",
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

// Helper to check if event matches binding
export function matchesBinding(
  e: KeyboardEvent,
  binding: ShortcutConfig["binding"],
): boolean {
  const bindingKey = binding.key;
  const isSpecialKey = SPECIAL_KEYS.includes(bindingKey);

  // Check key match
  let keyMatches: boolean;
  if (isSpecialKey) {
    // Special keys match exactly (case-sensitive) or with Backspace/Delete interchangeable
    keyMatches =
      e.key === bindingKey ||
      (bindingKey === "Delete" && e.key === "Backspace") ||
      (bindingKey === "Backspace" && e.key === "Delete");
  } else {
    // Regular keys - support both e.key and e.code for non-English layouts
    const expectedKey = bindingKey.toLowerCase();
    keyMatches =
      e.key.toLowerCase() === expectedKey ||
      (KEY_TO_CODE[expectedKey] !== undefined &&
        e.code === KEY_TO_CODE[expectedKey]);
  }

  if (!keyMatches) return false;

  const modifiers = binding.modifiers ?? [];
  const ctrlRequired = modifiers.includes("ctrl");
  const shiftRequired = modifiers.includes("shift");
  const altRequired = modifiers.includes("alt");

  // Check modifiers (ctrl or meta for cross-platform)
  const ctrlMatches = ctrlRequired
    ? e.ctrlKey || e.metaKey
    : !(e.ctrlKey || e.metaKey);
  const shiftMatches = shiftRequired ? e.shiftKey : !e.shiftKey;
  const altMatches = altRequired ? e.altKey : !e.altKey;

  return ctrlMatches && shiftMatches && altMatches;
}

// Helper to compare two bindings for equality
export function bindingsEqual(
  a: ShortcutConfig["binding"],
  b: ShortcutConfig["binding"],
): boolean {
  // Empty bindings are equal
  if (!a.key && !b.key) return true;
  // Compare keys (case-insensitive for regular keys)
  if (a.key.toLowerCase() !== b.key.toLowerCase()) return false;

  // Compare modifiers
  const modA = new Set(a.modifiers ?? []);
  const modB = new Set(b.modifiers ?? []);
  if (modA.size !== modB.size) return false;
  for (const mod of modA) {
    if (!modB.has(mod)) return false;
  }
  return true;
}

// Helper to get modifiers from KeyboardEvent
export function getModifiersFromEvent(
  e: KeyboardEvent,
): ShortcutConfig["binding"]["modifiers"] {
  const modifiers: ("ctrl" | "shift" | "alt" | "meta")[] = [];
  if (e.ctrlKey) modifiers.push("ctrl");
  if (e.shiftKey) modifiers.push("shift");
  if (e.altKey) modifiers.push("alt");
  if (e.metaKey) modifiers.push("meta");
  return modifiers.length > 0 ? modifiers : undefined;
}
