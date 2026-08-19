import { memo } from "react";
import { MessageSquare, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaptionThread } from "@/types";

interface CaptionPanelItemProps {
  caption: CaptionThread;
  index: number;
  isActive: boolean;
  onClick: () => void;
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
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
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

export const CaptionPanelItem = memo(function CaptionPanelItem({
  caption,
  index,
  isActive,
  onClick,
}: CaptionPanelItemProps) {
  const firstMessage = caption.messages[0];
  if (!firstMessage) return null;

  const avatarColor = getAvatarColor(firstMessage.authorId);
  const initials = firstMessage.authorName.slice(0, 1).toUpperCase();
  const replyCount = caption.messages.length - 1;

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg p-3 transition-colors",
        isActive ? "bg-violet-50 ring-1 ring-violet-200" : "hover:bg-gray-50",
        !caption.isRead &&
          !caption.isResolved &&
          "border-l-2 border-violet-500",
      )}
    >
      <div className="flex gap-3">
        {/* Index badge */}
        <div
          className={cn(
            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            caption.isResolved ? "bg-green-500" : "bg-violet-500",
          )}
        >
          {caption.isResolved ? <Check size={12} /> : index}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Author and time */}
          <div className="flex items-center gap-2">
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-800">
              {firstMessage.authorName}
            </span>
            <span className="text-xs text-gray-400">
              {formatRelativeTime(caption.createdAt)}
            </span>
          </div>

          {/* Message preview */}
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">
            {firstMessage.content}
          </p>

          {/* Attachments indicator */}
          {firstMessage.attachments && firstMessage.attachments.length > 0 && (
            <div className="mt-1 flex gap-1">
              {firstMessage.attachments.map((attachment) => (
                <img
                  key={attachment.id}
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-8 w-8 rounded border border-gray-200 object-cover"
                />
              ))}
            </div>
          )}

          {/* Reply count */}
          {replyCount > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <MessageSquare size={12} />
              <span>답글 {replyCount}개</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
