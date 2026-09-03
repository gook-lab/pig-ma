import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Keyboard,
  History,
  X,
  Trash2,
  RotateCcw,
  Save,
  MessageSquare,
  AtSign,
  MoreHorizontal,
  Check,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHistoryStore, useAutoSave } from "@/hooks/useAutoSave";
import { useCanvasStore } from "@/store";
import {
  useShortcutsStore,
  bindingsEqual,
  getModifiersFromEvent,
} from "@/hooks/useShortcuts";
import type { ShortcutAction, ShortcutConfig } from "@/types";
import toast from "@/utils/toast";

// Detect Mac vs Windows
const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Key mappings for Mac vs Windows
const KEY_LABELS: Record<string, { mac: string; win: string }> = {
  Meta: { mac: "⌘", win: "Win" },
  Control: { mac: "⌃", win: "Ctrl" },
  Alt: { mac: "⌥", win: "Alt" },
  Shift: { mac: "⇧", win: "Shift" },
  Enter: { mac: "↵", win: "Enter" },
  Backspace: { mac: "⌫", win: "Back" },
  Delete: { mac: "⌦", win: "Del" },
  Escape: { mac: "esc", win: "Esc" },
  Tab: { mac: "⇥", win: "Tab" },
  CapsLock: { mac: "⇪", win: "Caps" },
  ArrowUp: { mac: "↑", win: "↑" },
  ArrowDown: { mac: "↓", win: "↓" },
  ArrowLeft: { mac: "←", win: "←" },
  ArrowRight: { mac: "→", win: "→" },
  " ": { mac: "Space", win: "Space" },
};

function getKeyLabel(key: string): string {
  const mapping = KEY_LABELS[key];
  if (mapping) {
    return isMac ? mapping.mac : mapping.win;
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}

// Keyboard layout
const KEYBOARD_ROWS = [
  [
    "Escape",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
    "-",
    "=",
    "Backspace",
  ],
  ["Tab", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
  ["CapsLock", "a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "Enter"],
  ["Shift", "z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "Shift"],
  [
    isMac ? "Control" : "Control",
    isMac ? "Alt" : "Alt",
    isMac ? "Meta" : "Meta",
    " ",
    isMac ? "Meta" : "Meta",
    isMac ? "Alt" : "Alt",
    "ArrowLeft",
    "ArrowUp",
    "ArrowDown",
    "ArrowRight",
  ],
];

const KEY_WIDTHS: Record<string, number> = {
  Backspace: 2,
  Tab: 1.5,
  "\\": 1.5,
  CapsLock: 1.75,
  Enter: 2.25,
  Shift: 2.25,
  Control: 1.25,
  Alt: 1.25,
  Meta: 1.25,
  " ": 6,
};

// Shortcut categories data
interface ShortcutItem {
  name: string;
  keys: string[];
  description?: string;
  action?: ShortcutAction; // Link to customizable shortcuts
  editable?: boolean; // Whether this shortcut can be customized
}

interface ShortcutCategory {
  id: string;
  label: string;
  items: ShortcutItem[];
}

// Convert binding to keys array for display
function bindingToKeys(binding: ShortcutConfig["binding"]): string[] {
  const keys: string[] = [];
  if (binding.modifiers?.includes("ctrl"))
    keys.push(isMac ? "Control" : "Control");
  if (binding.modifiers?.includes("meta")) keys.push("Meta");
  if (binding.modifiers?.includes("alt")) keys.push("Alt");
  if (binding.modifiers?.includes("shift")) keys.push("Shift");
  if (binding.key) keys.push(binding.key);
  return keys;
}

// Static shortcut categories (some are customizable via action link)
const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    id: "tools",
    label: "도구",
    items: [
      { name: "Select", keys: ["v"], action: "select", editable: true },
      { name: "Hand", keys: ["h"], action: "hand", editable: true },
      { name: "Pencil", keys: ["p"], action: "pencil", editable: true },
      { name: "Shape", keys: ["r"], action: "shape", editable: true },
      { name: "Comment", keys: ["c"] }, // Not in shortcuts store
      {
        name: "Sticky Note",
        keys: ["s"],
        action: "stickyNote",
        editable: true,
      },
      { name: "Connector", keys: ["l"], action: "connector", editable: true },
      { name: "TextBox", keys: ["t"], action: "textBox", editable: true },
    ],
  },
  {
    id: "edit",
    label: "편집",
    items: [
      { name: "Undo", keys: ["Meta", "z"], action: "undo", editable: true },
      {
        name: "Redo",
        keys: ["Meta", "Shift", "z"],
        action: "redo",
        editable: true,
      },
      { name: "Copy", keys: ["Meta", "c"] }, // System shortcut
      { name: "Paste", keys: ["Meta", "v"] }, // System shortcut
      { name: "Delete", keys: ["Backspace"], action: "delete", editable: true },
    ],
  },
  {
    id: "canvas",
    label: "캔버스",
    items: [
      { name: "Move Up", keys: ["ArrowUp"] },
      { name: "Move Down", keys: ["ArrowDown"] },
      { name: "Move Left", keys: ["ArrowLeft"] },
      { name: "Move Right", keys: ["ArrowRight"] },
      { name: "Move Fast", keys: ["Shift", "ArrowUp"] },
    ],
  },
  {
    id: "other",
    label: "기타",
    items: [
      { name: "Lock Screen", keys: ["Meta", "l"] },
      { name: "Save", keys: ["Meta", "s"] },
      { name: "Cursor Chat", keys: ["/"] },
    ],
  },
];

// Get English name from action
function getActionName(action: ShortcutAction): string {
  for (const category of SHORTCUT_CATEGORIES) {
    const item = category.items.find((i) => i.action === action);
    if (item) return item.name;
  }
  return action;
}

// Keyboard Map Modal (upgraded from KeyboardVisualizer)
function KeyboardVisualizer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [recentKeys, setRecentKeys] = useState<string[]>([]);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(
    new Set(),
  );

  // Shortcut editing state
  const { shortcuts, updateShortcut, resetToDefaults, setCapturing } =
    useShortcutsStore();
  const [editingAction, setEditingAction] = useState<ShortcutAction | null>(
    null,
  );
  const [pendingChanges, setPendingChanges] = useState<
    Map<ShortcutAction, ShortcutConfig["binding"]>
  >(new Map());
  const [conflictingAction, setConflictingAction] =
    useState<ShortcutAction | null>(null);

  const hasChanges = pendingChanges.size > 0;

  // Get current binding for an action (pending or stored)
  const getBinding = useCallback(
    (action: ShortcutAction): ShortcutConfig["binding"] => {
      return (
        pendingChanges.get(action) ??
        shortcuts.find((s) => s.action === action)?.binding ?? { key: "" }
      );
    },
    [pendingChanges, shortcuts],
  );

  // Build dynamic categories with current bindings
  const dynamicCategories = useMemo(() => {
    return SHORTCUT_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.map((item) => {
        if (item.action) {
          const binding = getBinding(item.action);
          return { ...item, keys: bindingToKeys(binding) };
        }
        return item;
      }),
    }));
  }, [getBinding]);

  // Check if key is Korean (Hangul)
  const isKoreanKey = useCallback((key: string): boolean => {
    if (!key || key.length !== 1) return false;
    const code = key.charCodeAt(0);
    // Hangul Jamo: ㄱ-ㅎ, ㅏ-ㅣ (0x3131-0x3163)
    // Hangul Syllables: 가-힣 (0xAC00-0xD7A3)
    return (
      (code >= 0x3131 && code <= 0x3163) || (code >= 0xac00 && code <= 0xd7a3)
    );
  }, []);

  // Check if binding is a system reserved key
  const isSystemReservedKey = useCallback(
    (binding: ShortcutConfig["binding"]): boolean => {
      const { key, modifiers } = binding;
      if (!key) return false;

      const hasCtrl =
        modifiers?.includes("ctrl") || modifiers?.includes("meta");
      const hasShift = modifiers?.includes("shift");
      const hasAlt = modifiers?.includes("alt");
      const lowerKey = key.toLowerCase();

      // Browser/OS system shortcuts (Cmd/Ctrl + key)
      if (hasCtrl && !hasShift && !hasAlt) {
        // Common system shortcuts
        if (
          [
            "q",
            "w",
            "t",
            "n",
            "r",
            "f",
            "g",
            "a",
            "c",
            "v",
            "x",
            "p",
            "o",
          ].includes(lowerKey)
        ) {
          return true;
        }
      }

      // Cmd+Shift combinations
      if (hasCtrl && hasShift && !hasAlt) {
        if (["t", "n", "p"].includes(lowerKey)) {
          return true;
        }
      }

      // Function keys (F1-F12)
      if (key.startsWith("F") && !isNaN(parseInt(key.slice(1)))) {
        return true;
      }

      return false;
    },
    [],
  );

  // Find conflict
  const findConflict = useCallback(
    (
      action: ShortcutAction,
      binding: ShortcutConfig["binding"],
    ): ShortcutAction | null => {
      if (!binding.key) return null;
      for (const shortcut of shortcuts) {
        if (shortcut.action === action) continue;
        const otherBinding =
          pendingChanges.get(shortcut.action) ?? shortcut.binding;
        if (bindingsEqual(otherBinding, binding)) {
          return shortcut.action;
        }
      }
      return null;
    },
    [shortcuts, pendingChanges],
  );

  // Start editing
  const startEditing = useCallback(
    (action: ShortcutAction) => {
      setEditingAction(action);
      setConflictingAction(null);
      setCapturing(true);
    },
    [setCapturing],
  );

  // Cancel editing (don't clear conflict - let it timeout)
  const cancelEditing = useCallback(() => {
    setEditingAction(null);
    setCapturing(false);
  }, [setCapturing]);

  // Discard all changes
  const discardChanges = useCallback(() => {
    setPendingChanges(new Map());
    setEditingAction(null);
    setConflictingAction(null);
    setCapturing(false);
  }, [setCapturing]);

  // Save all changes
  const saveChanges = useCallback(() => {
    for (const [action, binding] of pendingChanges) {
      updateShortcut(action, binding);
    }
    setPendingChanges(new Map());
    setConflictingAction(null);
    toast.success({ message: "Shortcuts saved", duration: 1500 });
  }, [pendingChanges, updateShortcut]);

  // Handle reset
  const handleReset = useCallback(() => {
    if (window.confirm("Reset all shortcuts to defaults?")) {
      resetToDefaults();
      setPendingChanges(new Map());
      setConflictingAction(null);
      toast.success({ message: "Shortcuts reset", duration: 1500 });
    }
  }, [resetToDefaults]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // If editing, capture the key
      if (editingAction) {
        e.preventDefault();
        e.stopPropagation();

        // ESC to cancel editing
        if (e.key === "Escape") {
          cancelEditing();
          return;
        }

        // Ignore modifier-only
        if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
          return;
        }

        // Tab/Enter to confirm
        if (e.key === "Tab" || e.key === "Enter") {
          cancelEditing();
          return;
        }

        // Capture binding
        const binding: ShortcutConfig["binding"] =
          e.key === "Backspace" || e.key === "Delete"
            ? { key: "" }
            : {
                key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
                modifiers: getModifiersFromEvent(e),
              };

        // Check Korean key
        if (binding.key && isKoreanKey(binding.key)) {
          toast.error({
            message: "Korean input not allowed",
            duration: 2000,
          });
          cancelEditing();
          return;
        }

        // Check system reserved key
        if (binding.key && isSystemReservedKey(binding)) {
          toast.error({
            message: "System shortcut - cannot use",
            duration: 2000,
          });
          cancelEditing();
          return;
        }

        // Check if same as current binding
        const currentBinding = getBinding(editingAction);
        if (bindingsEqual(currentBinding, binding)) {
          toast.warning({
            message: "Same as current key",
            duration: 2000,
          });
          cancelEditing();
          return;
        }

        // Check conflict with other shortcuts
        const conflict = findConflict(editingAction, binding);
        if (conflict) {
          setConflictingAction(conflict);
          const conflictName = getActionName(conflict);
          toast.error({
            message: `Already used by "${conflictName}"`,
            duration: 2000,
          });
          // Don't save - keep original key, but keep conflict highlight for 3s
          cancelEditing();
          setTimeout(() => setConflictingAction(null), 3000);
          return;
        }

        // No conflict - store pending change
        setConflictingAction(null);
        setPendingChanges((prev) => {
          const next = new Map(prev);
          next.set(editingAction, binding);
          return next;
        });

        cancelEditing();
        return;
      }

      // ESC 키로 모달 닫기
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (hasChanges) {
          if (window.confirm("Discard unsaved changes?")) {
            discardChanges();
            onClose();
          }
        } else {
          onClose();
        }
        return;
      }

      const key = e.key;
      setPressedKeys((prev) => new Set(prev).add(key));

      const keyCombo: string[] = [];
      if (e.metaKey && key !== "Meta") keyCombo.push(isMac ? "⌘" : "Win");
      if (e.ctrlKey && key !== "Control") keyCombo.push(isMac ? "⌃" : "Ctrl");
      if (e.altKey && key !== "Alt") keyCombo.push(isMac ? "⌥" : "Alt");
      if (e.shiftKey && key !== "Shift") keyCombo.push(isMac ? "⇧" : "Shift");
      keyCombo.push(getKeyLabel(key));

      const combo = keyCombo.join(" + ");
      setRecentKeys((prev) => [combo, ...prev.slice(0, 4)]);
    },
    [
      editingAction,
      cancelEditing,
      isKoreanKey,
      isSystemReservedKey,
      getBinding,
      findConflict,
      shortcuts,
      hasChanges,
      discardChanges,
      onClose,
    ],
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key;
    setPressedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // capture: true로 다른 핸들러보다 먼저 이벤트 처리
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isOpen, handleKeyDown, handleKeyUp]);

  useEffect(() => {
    if (!isOpen) {
      setPressedKeys(new Set());
      setHighlightedKeys(new Set());
      setRecentKeys([]);
      setEditingAction(null);
      setPendingChanges(new Map());
      setConflictingAction(null);
      setCapturing(false);
    }
  }, [isOpen, setCapturing]);

  // Handle shortcut item click/hover
  const handleShortcutHover = useCallback((keys: string[]) => {
    setHighlightedKeys(new Set(keys));
  }, []);

  const handleShortcutLeave = useCallback(() => {
    setHighlightedKeys(new Set());
  }, []);

  // Handle shortcut click (start editing)
  const handleShortcutClick = useCallback(
    (item: ShortcutItem) => {
      if (item.editable && item.action) {
        startEditing(item.action);
      }
    },
    [startEditing],
  );

  if (!isOpen) return null;

  const isKeyHighlighted = (key: string) => {
    // Check real-time pressed keys
    if (key === "Shift" && pressedKeys.has("Shift")) return "pressed";
    if (key === "Control" && pressedKeys.has("Control")) return "pressed";
    if (key === "Alt" && pressedKeys.has("Alt")) return "pressed";
    if (key === "Meta" && pressedKeys.has("Meta")) return "pressed";
    if (
      pressedKeys.has(key) ||
      pressedKeys.has(key.toUpperCase()) ||
      pressedKeys.has(key.toLowerCase())
    )
      return "pressed";

    // Check highlighted from shortcut list hover
    if (
      highlightedKeys.has(key) ||
      highlightedKeys.has(key.toLowerCase()) ||
      highlightedKeys.has(key.toUpperCase())
    )
      return "highlighted";

    // Handle arrow keys specially
    if (key.startsWith("Arrow") && highlightedKeys.has(key))
      return "highlighted";

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-[70%] max-w-4xl rounded-2xl bg-gray-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-white" />
            <span className="font-semibold text-white">Keyboard Shortcuts</span>
            <span className="ml-2 text-xs text-gray-400">
              {isMac ? "macOS" : "Windows"}
            </span>
            {hasChanges && (
              <span className="ml-2 rounded bg-amber-500 px-2 py-0.5 text-xs text-white">
                {pendingChanges.size} unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <button
                  onClick={discardChanges}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
                >
                  Discard
                </button>
                <button
                  onClick={saveChanges}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700"
                >
                  <Check className="h-4 w-4" />
                  Save
                </button>
              </>
            )}
            <button
              onClick={handleReset}
              className="rounded-lg p-1.5 transition-colors hover:bg-gray-700"
              title="Reset to defaults"
            >
              <RotateCcw className="h-4 w-4 text-gray-400" />
            </button>
            <button
              onClick={() => {
                if (hasChanges) {
                  if (window.confirm("Discard unsaved changes?")) {
                    discardChanges();
                    onClose();
                  }
                } else {
                  onClose();
                }
              }}
              className="rounded-lg p-1.5 transition-colors hover:bg-gray-700"
              title="닫기 (ESC)"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Top: Keyboard visualization */}
        <div className="mb-6">
          {/* Recent keys display */}
          <div className="mb-4 flex h-10 items-center gap-2 overflow-hidden">
            {recentKeys.length > 0 ? (
              recentKeys.map((combo, i) => (
                <div
                  key={`${combo}-${i}`}
                  className={cn(
                    "rounded-lg px-3 py-1.5 font-mono text-sm transition-all",
                    i === 0
                      ? "scale-105 bg-violet-600 text-white"
                      : "bg-gray-700 text-gray-300 opacity-50",
                  )}
                >
                  {combo}
                </div>
              ))
            ) : (
              <span className="text-sm text-gray-500">
                키를 누르거나 아래 단축키 위에 마우스를 올려보세요...
              </span>
            )}
          </div>

          {/* Keyboard */}
          <div className="flex flex-col gap-1">
            {KEYBOARD_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-1">
                {row.map((key, keyIndex) => {
                  const width = KEY_WIDTHS[key] ?? 1;
                  const highlightState = isKeyHighlighted(key);
                  const label = getKeyLabel(key);

                  return (
                    <div
                      key={`${key}-${keyIndex}`}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-lg text-xs font-medium transition-all",
                        "border",
                        highlightState === "pressed"
                          ? "scale-95 border-violet-400 bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                          : highlightState === "highlighted"
                            ? "border-amber-400 bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                            : "border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700",
                      )}
                      style={{ width: `${width * 40}px` }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border border-violet-400 bg-violet-600" />
              <span>실시간 입력</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border border-amber-400 bg-amber-500" />
              <span>단축키 미리보기</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-6 border-t border-gray-700" />

        {/* Bottom: Shortcut grid (4 columns) */}
        <div className="grid grid-cols-4 gap-3">
          {dynamicCategories.map((category) => (
            <div key={category.id} className="rounded-xl bg-gray-800/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-violet-400">
                {category.label}
              </h3>
              <div className="space-y-2">
                {category.items.map((item, index) => {
                  const isEditing = editingAction === item.action;
                  const isConflicting = conflictingAction === item.action;
                  const hasPendingChange =
                    item.action && pendingChanges.has(item.action);

                  return (
                    <div
                      key={`${item.name}-${index}`}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 transition-colors",
                        item.editable ? "cursor-pointer" : "cursor-default",
                        isEditing
                          ? "bg-blue-600 ring-2 ring-blue-400"
                          : isConflicting
                            ? "bg-red-600/50 ring-2 ring-red-400"
                            : item.editable
                              ? "hover:bg-gray-700/50"
                              : "",
                      )}
                      onClick={() => handleShortcutClick(item)}
                      onMouseEnter={() => handleShortcutHover(item.keys)}
                      onMouseLeave={handleShortcutLeave}
                    >
                      <span
                        className={cn(
                          "text-sm",
                          isConflicting
                            ? "font-medium text-red-300"
                            : "text-white",
                        )}
                      >
                        {item.name}
                        {item.editable && (
                          <span className="ml-1 text-xs text-gray-500">●</span>
                        )}
                      </span>
                      {isEditing ? (
                        <span className="animate-pulse text-xs text-blue-200">
                          Press key...
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          {item.keys.length === 0 || !item.keys[0] ? (
                            <kbd className="rounded bg-gray-600 px-2 py-0.5 font-mono text-xs text-gray-400">
                              None
                            </kbd>
                          ) : (
                            item.keys.map((key, ki) => (
                              <kbd
                                key={`${key}-${ki}`}
                                className={cn(
                                  "rounded px-2 py-0.5 font-mono text-xs",
                                  isConflicting
                                    ? "bg-red-500 text-white"
                                    : hasPendingChange
                                      ? "bg-amber-500 text-white"
                                      : "bg-gray-700 text-gray-300",
                                )}
                              >
                                {getKeyLabel(key)}
                              </kbd>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="mt-4 text-center text-xs text-gray-500">
          {editingAction
            ? "Press a key to assign, ESC to cancel"
            : "Click ● items to customize shortcuts"}
        </div>
      </div>
    </div>
  );
}

// History Panel
function HistoryPanelContent({
  isOpen,
  onClose,
  isMobile = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}) {
  const { snapshots, deleteSnapshot, clearHistory } = useHistoryStore();
  const { saveNow } = useAutoSave();

  const handleRestore = (snapshotId: string) => {
    const snapshot = snapshots.find((s) => s.id === snapshotId);
    if (snapshot) {
      const store = useCanvasStore.getState();
      store.setSelectedIds([]);
      const currentIds = store.objects.map((o) => o.id);
      currentIds.forEach((id) => {
        const state = useCanvasStore.getState();
        useCanvasStore.setState({
          objects: state.objects.filter((o) => o.id !== id),
        });
      });
      snapshot.objects.forEach((obj) => {
        useCanvasStore.getState().addObject(obj);
      });
      onClose();
    }
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

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed z-50",
        "w-72 rounded-xl border border-gray-200 bg-white shadow-xl",
        "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
        "overflow-hidden",
      )}
      style={
        isMobile
          ? { right: "204px", bottom: "160px" }
          : { right: "265px", bottom: "24px" }
      }
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-[#c0c1c4]">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-800">
          히스토리
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={saveNow}
            className="rounded p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
            title="지금 저장"
          >
            <Save className="h-4 w-4 text-gray-500 dark:text-gray-600" />
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-gray-600" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {snapshots.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            저장된 히스토리가 없습니다
          </div>
        ) : (
          <div className="p-2">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2",
                  "group transition-colors hover:bg-gray-50 dark:hover:bg-[#c8c9cc]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-gray-700 dark:text-gray-800">
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

      {snapshots.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
          <button
            onClick={clearHistory}
            className="text-xs text-red-500 transition-colors hover:text-red-600"
          >
            전체 히스토리 삭제
          </button>
        </div>
      )}
    </div>
  );
}

export function FloatingUtilityBar() {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isCaptionPanelOpen = useCanvasStore((s) => s.isCaptionPanelOpen);
  const toggleCaptionPanel = useCanvasStore((s) => s.toggleCaptionPanel);
  const captions = useCanvasStore((s) => s.captions);
  const hideUI = useCanvasStore((s) => s.hideUI);
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);
  const unreadCount = captions.filter((c) => !c.isRead && !c.isResolved).length;

  // Check if mobile/tablet size (< 1024px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = () => setMobileMenuOpen(false);
    // Delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Hide UI mode - hide floating utility bar
  if (hideUI) {
    return null;
  }

  // Mobile/Tablet: Floating button with popup menu
  if (isMobile) {
    return (
      <>
        {/* Mobile Floating Button - 미니맵 상단에 위치 */}
        <div className="fixed z-50" style={{ right: "16px", bottom: "200px" }}>
          {/* Popup Menu */}
          {mobileMenuOpen && (
            <div
              className={cn(
                "absolute right-0 bottom-14",
                "flex flex-col gap-2 p-2",
                "rounded-xl border border-gray-200 bg-white shadow-xl",
                "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
                "animate-in fade-in slide-in-from-bottom-2 duration-200",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Keyboard Button */}
              <button
                onClick={() => {
                  setShowKeyboard(true);
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                  "hover:bg-gray-100",
                )}
              >
                <Keyboard className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-700">Keyboard</span>
              </button>

              {/* History Button */}
              <button
                onClick={() => {
                  setShowHistory(true);
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                  "hover:bg-gray-100",
                )}
              >
                <History className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-700">History</span>
              </button>

              {/* Comments Button */}
              <button
                onClick={() => {
                  toggleCaptionPanel();
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                  "hover:bg-gray-100",
                  isCaptionPanelOpen && "bg-blue-50",
                )}
              >
                <div className="relative">
                  <MessageSquare
                    className={cn(
                      "h-5 w-5",
                      isCaptionPanelOpen ? "text-blue-600" : "text-gray-600",
                    )}
                  />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                      {unreadCount > 9 ? "!" : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-700">Comments</span>
              </button>

              {/* Mentions Button */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("toggle-mention-panel"));
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                  "hover:bg-gray-100",
                )}
              >
                <AtSign className="h-5 w-5 text-violet-600" />
                <span className="text-sm text-gray-700">Mentions</span>
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={() => {
                  toggleTheme();
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                  "hover:bg-gray-100",
                )}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-amber-500" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600" />
                )}
                <span className="text-sm text-gray-700">
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </span>
              </button>
            </div>
          )}

          {/* Main Floating Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            className={cn(
              "relative rounded-full p-3 shadow-lg transition-all",
              "border border-gray-200 bg-white",
              "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
              mobileMenuOpen
                ? "rotate-45 bg-gray-100 dark:bg-[#c8c9cc]"
                : "hover:bg-gray-50 dark:hover:bg-[#c8c9cc]",
            )}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-600" />
            ) : (
              <>
                <MoreHorizontal className="h-6 w-6 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* Keyboard Visualizer Modal */}
        <KeyboardVisualizer
          isOpen={showKeyboard}
          onClose={() => setShowKeyboard(false)}
        />

        {/* History Panel */}
        <HistoryPanelContent
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          isMobile={true}
        />
      </>
    );
  }

  // Desktop: Original horizontal bar
  return (
    <>
      {/* Floating Utility Bar - left of ZoomControls */}
      <div
        className={cn(
          "fixed bottom-6 z-50",
          "flex h-10 items-center gap-1 px-2",
          "rounded-xl border border-gray-200 bg-white shadow-lg",
          "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
        )}
        style={{ right: "200px" }}
      >
        {/* Keyboard Button */}
        <button
          type="button"
          aria-label="키보드 단축키"
          aria-pressed={showKeyboard}
          onClick={() => {
            setShowKeyboard(!showKeyboard);
            setShowHistory(false);
          }}
          className={cn(
            "rounded-lg p-2 transition-colors",
            "hover:bg-gray-100",
            showKeyboard && "bg-gray-100",
          )}
          title="키보드 단축키"
        >
          <Keyboard className="h-4 w-4 text-gray-600" />
        </button>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600" />

        {/* History Button */}
        <button
          type="button"
          aria-label="히스토리"
          aria-pressed={showHistory}
          onClick={() => {
            setShowHistory(!showHistory);
            setShowKeyboard(false);
          }}
          className={cn(
            "rounded-lg p-2 transition-colors",
            "hover:bg-gray-100",
            showHistory && "bg-gray-100",
          )}
          title="히스토리"
        >
          <History className="h-4 w-4 text-gray-600" />
        </button>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600" />

        {/* Comments Button */}
        <button
          type="button"
          aria-label="댓글"
          aria-pressed={isCaptionPanelOpen}
          onClick={() => {
            toggleCaptionPanel();
            setShowKeyboard(false);
            setShowHistory(false);
          }}
          className={cn(
            "relative rounded-lg p-2 transition-colors",
            "hover:bg-gray-100",
            isCaptionPanelOpen && "bg-blue-100",
          )}
          title="댓글 (C)"
        >
          <MessageSquare
            className={cn(
              "h-4 w-4",
              isCaptionPanelOpen ? "text-blue-600" : "text-gray-600",
            )}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600" />

        {/* Theme Toggle Button */}
        <button
          type="button"
          aria-label={
            theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"
          }
          onClick={toggleTheme}
          className={cn(
            "rounded-lg p-2 transition-colors",
            "hover:bg-gray-100",
          )}
          title={theme === "dark" ? "라이트 모드" : "다크 모드"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-500" />
          ) : (
            <Moon className="h-4 w-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* Keyboard Visualizer Modal */}
      <KeyboardVisualizer
        isOpen={showKeyboard}
        onClose={() => setShowKeyboard(false)}
      />

      {/* History Panel */}
      <HistoryPanelContent
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </>
  );
}
