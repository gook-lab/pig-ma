import { useMemo } from "react";
import { AtSign, MessageSquare, StickyNote, X } from "lucide-react";
import { useCanvasStore } from "@/store";
import { scanAllMentions, groupMentionsByUser } from "@/utils/mentions";
import { DEFAULT_USERS } from "@/components/tiptap/MentionList";
import { Z_SIDE_PANEL } from "@/constants/zIndex";

interface MentionPanelProps {
  onClose: () => void;
}

export function MentionPanel({ onClose }: MentionPanelProps) {
  const objects = useCanvasStore((s) => s.objects);
  const captions = useCanvasStore((s) => s.captions);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
  const viewport = useCanvasStore((s) => s.viewport);

  const mentions = useMemo(
    () => scanAllMentions(objects, captions ?? []),
    [objects, captions],
  );

  const grouped = useMemo(() => groupMentionsByUser(mentions), [mentions]);

  const navigateToMention = (entry: {
    x: number;
    y: number;
    sourceId: string;
    sourceType: string;
  }) => {
    // Center viewport on the mention source
    const stage = useCanvasStore.getState().stageRef?.current;
    if (stage) {
      const stageWidth = stage.width();
      const stageHeight = stage.height();
      setViewport({
        x: -entry.x * viewport.zoom + stageWidth / 2,
        y: -entry.y * viewport.zoom + stageHeight / 2,
        zoom: viewport.zoom,
      });
    }
    if (entry.sourceType === "object") {
      setSelectedIds([entry.sourceId]);
    }
  };

  const getUserColor = (label: string) => {
    const user = DEFAULT_USERS.find((u) => u.label === label);
    return user?.color ?? "#6b7280";
  };

  return (
    <div
      className="popover-enter fixed right-4 top-20 w-72 rounded-xl border border-gray-200 bg-white shadow-xl"
      style={{ zIndex: Z_SIDE_PANEL }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <AtSign size={16} className="text-violet-600" />
          <span className="text-sm font-semibold text-gray-900">Mentions</span>
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
            {mentions.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto p-2">
        {mentions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-gray-400">
            No mentions yet. Use @ in text or comments.
          </p>
        ) : (
          Array.from(grouped.entries()).map(([label, entries]) => (
            <div key={label} className="mb-2">
              {/* User header */}
              <div className="flex items-center gap-2 px-2 py-1">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: getUserColor(label) }}
                >
                  {label[0]?.toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  @{label}
                </span>
                <span className="text-[10px] text-gray-400">
                  {entries.length}
                </span>
              </div>
              {/* Mention entries */}
              {entries.map((entry, i) => (
                <button
                  key={`${entry.sourceId}-${i}`}
                  onClick={() => navigateToMention(entry)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-gray-500 transition-colors hover:bg-gray-50"
                >
                  {entry.sourceType === "caption" ? (
                    <MessageSquare
                      size={12}
                      className="shrink-0 text-gray-400"
                    />
                  ) : (
                    <StickyNote size={12} className="shrink-0 text-gray-400" />
                  )}
                  <span className="truncate">{entry.sourceName}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
