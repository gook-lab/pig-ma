import { memo, useState, useRef, useEffect, type ReactNode } from "react";
import { MoreHorizontal, Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommentMessage } from "@/types";

/** Render text with @mention highlighting */
function renderWithMentions(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const mentionRegex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Text before mention
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Mention span
    parts.push(
      <span key={match.index} className="mention">
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

interface CaptionMessageProps {
  message: CommentMessage;
  isAuthor: boolean;
  onDelete: () => void;
  onEdit?: (content: string) => void;
}

// Avatar colors for different users
const AVATAR_COLORS = [
  "#8b5cf6", // violet
  "#22c55e", // green
  "#f97316", // orange
  "#3b82f6", // blue
  "#ef4444", // red
  "#eab308", // yellow
  "#14b8a6", // teal
  "#ec4899", // pink
];

function getAvatarColor(authorId: string): string {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = authorId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export const CaptionMessage = memo(function CaptionMessage({
  message,
  isAuthor,
  onDelete,
}: CaptionMessageProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate menu position when opened
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 128, // 128 = menu width (w-32)
      });
    }
  }, [showMenu]);

  const avatarColor = getAvatarColor(message.authorId);
  const initials = message.authorName.slice(0, 1).toUpperCase();

  return (
    <div className="group flex gap-2 rounded-lg px-2 py-2 hover:bg-gray-100">
      {/* Avatar */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">
            {message.authorName}
          </span>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(message.createdAt)}
          </span>
        </div>

        {/* Message text */}
        <p className="mt-0.5 text-sm whitespace-pre-wrap text-gray-600">
          {renderWithMentions(message.content)}
        </p>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded border border-gray-200"
              >
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-24 w-auto max-w-[200px] object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Actions menu */}
      {isAuthor && (
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setShowMenu(!showMenu)}
            className={cn(
              "rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600",
              "opacity-0 transition-opacity group-hover:opacity-100",
              showMenu && "opacity-100",
            )}
          >
            <MoreHorizontal size={16} />
          </button>

          {showMenu && (
            <>
              {/* Fixed backdrop */}
              <div
                className="fixed inset-0 z-[200]"
                onClick={() => setShowMenu(false)}
              />
              {/* Fixed menu positioned based on button location */}
              <div
                className="fixed z-[201] w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                style={{
                  top: menuPosition.top,
                  left: menuPosition.left,
                }}
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // Edit functionality would go here
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <Edit2 size={14} />
                  수정
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});
