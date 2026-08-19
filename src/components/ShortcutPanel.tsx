import { useState, useEffect, useCallback, useRef } from "react";
import { Keyboard, X, RotateCcw, Check } from "lucide-react";
import {
  useShortcutsStore,
  formatBinding,
  bindingsEqual,
  getModifiersFromEvent,
} from "@/hooks/useShortcuts";
import { cn } from "@/lib/utils";
import type { ShortcutAction, ShortcutConfig } from "@/types";
import toast from "react-hot-toast";

export function ShortcutPanel() {
  const {
    shortcuts,
    showPanel,
    togglePanel,
    updateShortcut,
    resetToDefaults,
    setCapturing,
  } = useShortcutsStore();

  // Editing state
  const [editingAction, setEditingAction] = useState<ShortcutAction | null>(
    null,
  );
  // Pending changes (not yet saved)
  const [pendingChanges, setPendingChanges] = useState<
    Map<ShortcutAction, ShortcutConfig["binding"]>
  >(new Map());
  // Conflicting action (for red highlight)
  const [conflictingAction, setConflictingAction] =
    useState<ShortcutAction | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Check if there are unsaved changes
  const hasChanges = pendingChanges.size > 0;

  // Get the display binding for a shortcut (pending or current)
  const getDisplayBinding = useCallback(
    (action: ShortcutAction): ShortcutConfig["binding"] => {
      return (
        pendingChanges.get(action) ??
        shortcuts.find((s) => s.action === action)?.binding ?? { key: "" }
      );
    },
    [pendingChanges, shortcuts],
  );

  // Check for conflicts with a new binding
  const findConflict = useCallback(
    (
      action: ShortcutAction,
      binding: ShortcutConfig["binding"],
    ): ShortcutAction | null => {
      if (!binding.key) return null;

      for (const shortcut of shortcuts) {
        if (shortcut.action === action) continue;
        // Check against pending changes first, then current binding
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

  // Start editing a shortcut
  const startEditing = useCallback(
    (action: ShortcutAction) => {
      setEditingAction(action);
      setConflictingAction(null);
      setCapturing(true);
    },
    [setCapturing],
  );

  // Cancel editing (just exit insert mode, keep pending changes)
  const cancelEditing = useCallback(() => {
    setEditingAction(null);
    setConflictingAction(null);
    setCapturing(false);
  }, [setCapturing]);

  // Discard all pending changes
  const discardChanges = useCallback(() => {
    setPendingChanges(new Map());
    setEditingAction(null);
    setConflictingAction(null);
    setCapturing(false);
  }, [setCapturing]);

  // Save all pending changes
  const saveChanges = useCallback(() => {
    // Check for any remaining conflicts
    for (const [action, binding] of pendingChanges) {
      const conflict = findConflict(action, binding);
      if (conflict && !pendingChanges.has(conflict)) {
        // There's a conflict with a non-pending shortcut
        toast.error(
          `"${formatBinding(binding)}" conflicts with "${shortcuts.find((s) => s.action === conflict)?.label}"`,
          { position: "bottom-center" },
        );
        setConflictingAction(conflict);
        return;
      }
    }

    // Apply all pending changes
    for (const [action, binding] of pendingChanges) {
      updateShortcut(action, binding);
    }

    setPendingChanges(new Map());
    setEditingAction(null);
    setConflictingAction(null);
    setCapturing(false);
    toast.success("Shortcuts saved", {
      position: "bottom-center",
      duration: 1500,
    });
  }, [pendingChanges, findConflict, updateShortcut, shortcuts, setCapturing]);

  // Handle key capture
  useEffect(() => {
    if (!editingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // ESC to cancel editing (exit insert mode)
      if (e.key === "Escape") {
        cancelEditing();
        return;
      }

      // Ignore modifier-only presses
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      // Tab, Enter to exit insert mode
      if (e.key === "Tab" || e.key === "Enter") {
        cancelEditing();
        return;
      }

      // Capture the key
      const binding: ShortcutConfig["binding"] =
        e.key === "Backspace" || e.key === "Delete"
          ? { key: "" } // Clear binding
          : {
              key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
              modifiers: getModifiersFromEvent(e),
            };

      // Check for conflicts
      const conflict = findConflict(editingAction, binding);
      if (conflict) {
        setConflictingAction(conflict);
        const conflictLabel = shortcuts.find(
          (s) => s.action === conflict,
        )?.label;
        toast.error(`Already used by "${conflictLabel}"`, {
          position: "bottom-center",
          duration: 2000,
        });
      } else {
        setConflictingAction(null);
      }

      // Store as pending change
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(editingAction, binding);
        return next;
      });

      // Exit insert mode after capturing
      cancelEditing();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingAction, findConflict, shortcuts, cancelEditing]);

  // Handle outside click - just exit insert mode
  useEffect(() => {
    if (!editingAction) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        cancelEditing();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingAction, cancelEditing]);

  // Reset handler with confirmation
  const handleReset = useCallback(() => {
    const confirmReset = window.confirm(
      "Reset all shortcuts to defaults? This cannot be undone.",
    );
    if (confirmReset) {
      resetToDefaults();
      setPendingChanges(new Map());
      setConflictingAction(null);
    }
  }, [resetToDefaults]);

  // Close panel - warn if unsaved changes
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmClose = window.confirm(
        "You have unsaved changes. Discard them?",
      );
      if (!confirmClose) return;
      discardChanges();
    }
    togglePanel();
  }, [hasChanges, discardChanges, togglePanel]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={togglePanel}
        className={cn(
          "fixed right-4 bottom-4 z-50 p-3",
          "rounded-full border border-gray-200 bg-white shadow-lg",
          "transition-colors hover:bg-gray-50",
          showPanel && "bg-gray-100",
        )}
        title="키보드 단축키"
      >
        <Keyboard className="h-5 w-5 text-gray-600" />
      </button>

      {/* Panel */}
      {showPanel && (
        <div
          ref={containerRef}
          className={cn(
            "fixed right-4 bottom-20 z-50",
            "w-72 rounded-xl border border-gray-200 bg-white shadow-xl",
            "overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Keyboard Shortcuts
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Reset to defaults"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={handleClose}
                className="rounded p-1 transition-colors hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Shortcuts list */}
          <div className="max-h-80 overflow-y-auto p-2">
            {shortcuts.map((shortcut) => {
              const isEditing = editingAction === shortcut.action;
              const isConflicting = conflictingAction === shortcut.action;
              const hasPendingChange = pendingChanges.has(shortcut.action);
              const displayBinding = getDisplayBinding(shortcut.action);

              return (
                <button
                  key={shortcut.action}
                  onClick={() => !isEditing && startEditing(shortcut.action)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2",
                    "transition-colors",
                    isEditing
                      ? "bg-blue-50 ring-2 ring-blue-500"
                      : isConflicting
                        ? "bg-red-50 ring-2 ring-red-500"
                        : "hover:bg-gray-50",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm",
                      isConflicting
                        ? "text-red-600 font-medium"
                        : "text-gray-600",
                    )}
                  >
                    {shortcut.label}
                  </span>
                  {isEditing ? (
                    <span className="animate-pulse text-xs text-blue-600">
                      Press a key...
                    </span>
                  ) : (
                    <kbd
                      className={cn(
                        "px-2 py-1 font-mono text-xs",
                        "rounded border",
                        isConflicting
                          ? "border-red-300 bg-red-100 text-red-600"
                          : hasPendingChange
                            ? "border-amber-300 bg-amber-100 text-amber-700"
                            : "border-gray-200 bg-gray-100",
                        displayBinding.key ? "" : "text-gray-400",
                      )}
                    >
                      {displayBinding.key
                        ? formatBinding(displayBinding)
                        : "None"}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            {hasChanges ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-600">
                  {pendingChanges.size} unsaved change
                  {pendingChanges.size > 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={discardChanges}
                    className="rounded px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveChanges}
                    className="flex items-center gap-1 rounded bg-blue-500 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-600"
                  >
                    <Check className="h-3 w-3" />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-2 text-xs text-gray-500">Movement</div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Arrow keys: 1px</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                  <span>Shift + Arrow: 10px</span>
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  Click to edit. ESC to cancel.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
