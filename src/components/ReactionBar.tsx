import { memo, useState, useCallback, useMemo } from "react";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REACTION_EMOJIS,
  type ReactionEmoji,
  type ObjectReaction,
} from "@/types";
import { useCanvasStore } from "@/store";

interface ReactionBarProps {
  objectId: string;
  reactions: ObjectReaction[];
  onAddReaction: (emoji: ReactionEmoji) => void;
  onRemoveReaction: (emoji: ReactionEmoji) => void;
  compact?: boolean;
}

/** 이모지별 리액션 집계 */
function aggregateReactions(reactions: ObjectReaction[]) {
  const grouped: Record<
    ReactionEmoji,
    { count: number; users: string[]; hasCurrentUser: boolean }
  > = {} as never;
  const currentUserId = useCanvasStore.getState().currentUser?.id;

  REACTION_EMOJIS.forEach((emoji) => {
    grouped[emoji] = { count: 0, users: [], hasCurrentUser: false };
  });

  reactions.forEach((r) => {
    if (grouped[r.emoji]) {
      grouped[r.emoji].count++;
      if (r.userName) grouped[r.emoji].users.push(r.userName);
      if (r.userId === currentUserId) grouped[r.emoji].hasCurrentUser = true;
    }
  });

  return grouped;
}

export const ReactionBar = memo(function ReactionBar({
  objectId: _objectId,
  reactions,
  onAddReaction,
  onRemoveReaction,
  compact: _compact = false,
}: ReactionBarProps) {
  void _objectId;
  void _compact;
  const [showPicker, setShowPicker] = useState(false);
  const aggregated = useMemo(() => aggregateReactions(reactions), [reactions]);

  const handleEmojiClick = useCallback(
    (emoji: ReactionEmoji) => {
      const data = aggregated[emoji];
      if (data.hasCurrentUser) {
        onRemoveReaction(emoji);
      } else {
        onAddReaction(emoji);
      }
      setShowPicker(false);
    },
    [aggregated, onAddReaction, onRemoveReaction],
  );

  // 활성 리액션만 필터링
  const activeReactions = useMemo(() => {
    return REACTION_EMOJIS.filter((emoji) => aggregated[emoji].count > 0);
  }, [aggregated]);

  return (
    <div className="flex items-center gap-1">
      {/* 활성 리액션 표시 */}
      {activeReactions.map((emoji) => {
        const data = aggregated[emoji];
        return (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5",
              "text-sm transition-all",
              data.hasCurrentUser
                ? "bg-violet-100 text-violet-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            )}
            title={data.users.length > 0 ? data.users.join(", ") : undefined}
          >
            <span>{emoji}</span>
            {data.count > 1 && <span className="text-xs">{data.count}</span>}
          </button>
        );
      })}

      {/* 리액션 추가 버튼 */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full",
            "text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600",
            showPicker && "bg-gray-100 text-gray-600",
          )}
          title="Add reaction"
        >
          <SmilePlus size={14} />
        </button>

        {/* 이모지 피커 */}
        {showPicker && (
          <div
            className={cn(
              "absolute bottom-full left-0 mb-2",
              "flex gap-1 rounded-xl bg-white p-2 shadow-lg",
              "border border-gray-200",
            )}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-lg",
                  "transition-all hover:bg-gray-100",
                  aggregated[emoji].hasCurrentUser && "bg-violet-100",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/** 간단한 리액션 표시 (읽기 전용, 캔버스 위) */
export const ReactionDisplay = memo(function ReactionDisplay({
  reactions,
}: {
  reactions: ObjectReaction[];
}) {
  if (!reactions || reactions.length === 0) return null;

  const aggregated = aggregateReactions(reactions);
  const activeReactions = REACTION_EMOJIS.filter(
    (emoji) => aggregated[emoji].count > 0,
  );

  if (activeReactions.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5">
      {activeReactions.slice(0, 3).map((emoji) => (
        <span key={emoji} className="text-sm">
          {emoji}
        </span>
      ))}
      {activeReactions.length > 3 && (
        <span className="text-xs text-gray-500">
          +{activeReactions.length - 3}
        </span>
      )}
    </div>
  );
});
