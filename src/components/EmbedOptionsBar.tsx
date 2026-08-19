import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import {
  Play,
  Square,
  ExternalLink,
  Link2,
  Trash2,
  Lock,
  LockOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import type { CanvasObject } from "@/types";
import { Z_OPTIONS_BAR } from "@/constants/zIndex";

// Prevent keyboard events from propagating (e.g., backspace deleting objects)
const stopKeyPropagation = (e: KeyboardEvent) => {
  e.stopPropagation();
};

// Prevent mouse events from propagating
const stopMousePropagation = (e: MouseEvent) => {
  e.stopPropagation();
};

import type { OptionsBarPosition } from "@/utils/optionsBar";

interface EmbedOptionsBarProps {
  shape: CanvasObject;
  position: OptionsBarPosition;
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onDelete?: () => void;
  onReplaceUrl?: () => void;
}

export function EmbedOptionsBar({
  shape,
  position,
  onUpdate,
  onDelete,
  onReplaceUrl,
}: EmbedOptionsBarProps) {
  const isPlaying = shape.isPlaying ?? false;
  const isLocked = shape.locked ?? false;
  const embedType = shape.embedType ?? "youtube";
  const embedUrl = shape.embedUrl ?? "";

  const handleTogglePlay = useCallback(() => {
    onUpdate({ isPlaying: !isPlaying });
  }, [isPlaying, onUpdate]);

  const handleToggleLock = useCallback(() => {
    onUpdate({ locked: !isLocked });
  }, [isLocked, onUpdate]);

  const handleOpenExternal = useCallback(() => {
    if (embedUrl) {
      window.open(embedUrl, "_blank", "noopener,noreferrer");
    }
  }, [embedUrl]);

  // Service label
  const serviceLabel =
    embedType === "youtube"
      ? "YouTube"
      : embedType === "figma"
        ? "Figma"
        : "Notion";
  const serviceColor =
    embedType === "youtube"
      ? "#FF0000"
      : embedType === "figma"
        ? "#F24E1E"
        : "#000000";

  return (
    <div
      className="fixed"
      style={{
        left: position.x,
        top: position.y,
        zIndex: Z_OPTIONS_BAR,
        transform: getOptionsBarTransform(position),
      }}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={stopKeyPropagation}
      onClick={stopMousePropagation}
    >
      <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
        {/* Service badge */}
        <div
          className="flex items-center rounded px-2 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: serviceColor }}
        >
          {serviceLabel}
        </div>

        <div className="mx-1 h-5 w-px bg-gray-600" />

        {/* Play/Stop toggle - YouTube only */}
        {embedType === "youtube" && (
          <>
            <button
              onClick={handleTogglePlay}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs transition-all",
                isPlaying
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white",
              )}
              title={isPlaying ? "Stop" : "Play"}
            >
              {isPlaying ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Play</span>
                </>
              )}
            </button>

            <div className="mx-1 h-5 w-px bg-gray-600" />
          </>
        )}

        {/* Replace URL */}
        <button
          onClick={onReplaceUrl}
          className="rounded p-1.5 text-gray-300 transition-all hover:bg-gray-700 hover:text-white"
          title="Replace URL"
        >
          <Link2 className="h-4 w-4" />
        </button>

        {/* Open external */}
        <button
          onClick={handleOpenExternal}
          className="rounded p-1.5 text-gray-300 transition-all hover:bg-gray-700 hover:text-white"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-gray-600" />

        {/* Lock toggle */}
        <button
          onClick={handleToggleLock}
          className={cn(
            "rounded p-1.5 transition-all",
            isLocked
              ? "bg-red-600 text-white hover:bg-red-700"
              : "text-gray-300 hover:bg-gray-700 hover:text-white",
          )}
          title={isLocked ? "Unlock" : "Lock"}
        >
          {isLocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <LockOpen className="h-4 w-4" />
          )}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-gray-300 transition-all hover:bg-red-600 hover:text-white"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
