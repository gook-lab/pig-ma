import { forwardRef, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  placeholder?: string;
  className?: string;
}

/** Render text with @mention highlights as HTML */
function renderHighlighted(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="mention">
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // Trailing newline needs a space to maintain height
  if (text.endsWith("\n")) {
    parts.push(" ");
  }

  return parts.length > 0 ? parts : [text || " "];
}

export const MentionTextarea = forwardRef<
  HTMLTextAreaElement,
  MentionTextareaProps
>(function MentionTextarea(
  {
    value,
    onChange,
    onKeyDown,
    onCompositionStart,
    onCompositionEnd,
    placeholder,
    className,
  },
  ref,
) {
  const highlightRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);

  // Sync scroll between textarea and highlight div
  const syncScroll = () => {
    if (internalRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = internalRef.current.scrollTop;
    }
  };

  // Set ref
  useEffect(() => {
    if (typeof ref === "function") {
      ref(internalRef.current);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
        internalRef.current;
    }
  }, [ref]);

  const hasMentions = /@\w+/.test(value);

  return (
    <div className="relative w-full">
      {/* Highlight layer — shows styled text behind textarea */}
      {hasMentions && (
        <div
          ref={highlightRef}
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden text-sm break-words whitespace-pre-wrap text-gray-800",
            className,
          )}
          style={{
            // Match textarea padding and border exactly
            color: "transparent",
            background: "transparent",
            border: "1px solid transparent",
          }}
          aria-hidden
        >
          {renderHighlighted(value)}
        </div>
      )}

      {/* Actual textarea — transparent text when mentions present */}
      <textarea
        ref={internalRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        placeholder={placeholder}
        className={cn(
          className,
          hasMentions && "text-transparent caret-gray-800",
        )}
      />
    </div>
  );
});
