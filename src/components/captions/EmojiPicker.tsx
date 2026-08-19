import { memo } from "react";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

// Common emojis organized by category
const EMOJI_CATEGORIES = [
  {
    name: "자주 사용",
    emojis: ["👍", "👎", "❤️", "😊", "😂", "🎉", "🔥", "✅", "❌", "⭐"],
  },
  {
    name: "표정",
    emojis: ["😀", "😃", "😄", "😁", "😅", "🤣", "😊", "🥰", "😍", "🤩"],
  },
  {
    name: "제스처",
    emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "👌", "👋", "🙏"],
  },
  {
    name: "심볼",
    emojis: ["✅", "❌", "⭐", "❤️", "💔", "💯", "🔥", "⚡", "💡", "📌"],
  },
  {
    name: "동물",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯"],
  },
];

export const EmojiPicker = memo(function EmojiPicker({
  onSelect,
  onClose,
}: EmojiPickerProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[160]" onClick={onClose} />

      <div className="absolute bottom-full left-0 z-[161] mb-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.name} className="mb-3 last:mb-0">
            <div className="mb-1.5 text-xs font-medium text-gray-400">
              {category.name}
            </div>
            <div className="flex flex-wrap gap-1">
              {category.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelect(emoji);
                    onClose();
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded text-lg",
                    "transition-colors hover:bg-gray-100",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
});
