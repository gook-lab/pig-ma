import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CursorChatProps {
  initialPosition: { x: number; y: number };
  onClose: () => void;
}

const FADE_DELAY = 5000; // 5 seconds of inactivity before fade starts
const FADE_DURATION = 2000; // 2 seconds fade animation

export function CursorChat({ initialPosition, onClose }: CursorChatProps) {
  const [text, setText] = useState("");
  const [isFading, setIsFading] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const inputRef = useRef<HTMLInputElement>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Follow mouse cursor
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX + 20,
        y: e.clientY - 15,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Reset fade timer on text change
  const resetFadeTimer = useCallback(() => {
    // Clear existing timers
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setIsFading(false);

    // Start new fade timer
    fadeTimeoutRef.current = setTimeout(() => {
      setIsFading(true);
      // Close after fade animation completes
      closeTimeoutRef.current = setTimeout(() => {
        onClose();
      }, FADE_DURATION);
    }, FADE_DELAY);
  }, [onClose]);

  // Start fade timer on mount and reset on text change
  useEffect(() => {
    resetFadeTimer();
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [resetFadeTimer]);

  // Reset timer when text changes
  useEffect(() => {
    if (text) {
      resetFadeTimer();
    }
  }, [text, resetFadeTimer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      // Start fade immediately on Enter
      setIsFading(true);
      closeTimeoutRef.current = setTimeout(() => {
        onClose();
      }, FADE_DURATION);
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-auto fixed z-[200] transition-opacity",
        isFading ? "opacity-0" : "opacity-100",
      )}
      style={{
        left: position.x,
        top: position.y,
        transitionDuration: isFading ? `${FADE_DURATION}ms` : "0ms",
      }}
    >
      {/* Speech bubble */}
      <div className="relative">
        {/* Bubble tail */}
        <div
          className="absolute top-1/2 -left-2 h-0 w-0 -translate-y-1/2"
          style={{
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderRight: "10px solid #fbbf24",
          }}
        />
        {/* Bubble body */}
        <div className="min-w-[120px] rounded-full bg-amber-400 px-4 py-2 shadow-lg">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="대화를 시작하세요"
            className={cn(
              "border-none bg-transparent text-sm font-medium outline-none",
              "text-amber-900 placeholder:text-amber-700/60",
              "w-full min-w-[100px]",
            )}
            style={{ width: Math.max(100, text.length * 10 + 20) }}
          />
        </div>
      </div>
    </div>
  );
}
