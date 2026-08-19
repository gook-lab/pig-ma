import { useState, useMemo } from "react";
import { X, Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "@/store";
import { CaptionPanelItem } from "./CaptionPanelItem";
import { CaptionFilters } from "./CaptionFilters";

export function CaptionPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const captions = useCanvasStore((s) => s.captions);
  const currentUser = useCanvasStore((s) => s.currentUser);
  const activeCaptionId = useCanvasStore((s) => s.activeCaptionId);
  const captionFilter = useCanvasStore((s) => s.captionFilter);
  const isCaptionPanelOpen = useCanvasStore((s) => s.isCaptionPanelOpen);
  const setCaptionPanelOpen = useCanvasStore((s) => s.setCaptionPanelOpen);
  const setActiveCaptionId = useCanvasStore((s) => s.setActiveCaptionId);
  const setCaptionFilter = useCanvasStore((s) => s.setCaptionFilter);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const viewport = useCanvasStore((s) => s.viewport);
  const markAsRead = useCanvasStore((s) => s.markAsRead);

  // Filter and sort captions
  const filteredCaptions = useMemo(() => {
    let result = [...captions];

    // Filter by resolved status
    if (!captionFilter.showResolved) {
      result = result.filter((c) => !c.isResolved);
    }

    // Filter by author (my threads only)
    if (captionFilter.onlyMyThreads) {
      result = result.filter((c) =>
        c.messages.some((m) => m.authorId === currentUser.id),
      );
    }

    // Filter by author search (name-based)
    if (captionFilter.authorSearch?.trim()) {
      const authorQuery = captionFilter.authorSearch.toLowerCase();
      result = result.filter((c) =>
        c.messages.some((m) =>
          m.authorName.toLowerCase().includes(authorQuery),
        ),
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.messages.some(
          (m) =>
            m.content.toLowerCase().includes(query) ||
            m.authorName.toLowerCase().includes(query),
        ),
      );
    }

    // Sort
    if (captionFilter.sortBy === "unread") {
      result.sort((a, b) => {
        // Unread first
        if (!a.isRead && b.isRead) return -1;
        if (a.isRead && !b.isRead) return 1;
        // Then by date
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    } else {
      // Sort by date (most recent first)
      result.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return result;
  }, [captions, captionFilter, searchQuery, currentUser.id]);

  // Handle item click - navigate to caption and open popup
  const handleItemClick = (captionId: string) => {
    const caption = captions.find((c) => c.id === captionId);
    if (!caption) return;

    // Calculate center position to show the caption
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    // Move viewport to center on caption
    const newViewportX = screenCenterX - caption.x * viewport.zoom;
    const newViewportY = screenCenterY - caption.y * viewport.zoom;

    setViewport({ x: newViewportX, y: newViewportY });
    setActiveCaptionId(captionId);
    markAsRead(captionId);
  };

  if (!isCaptionPanelOpen) return null;

  // Get original index for each caption
  const getOriginalIndex = (captionId: string) => {
    return captions.findIndex((c) => c.id === captionId) + 1;
  };

  return (
    <div
      className="pointer-events-auto fixed right-4 z-[90] flex w-64 flex-col rounded-2xl border border-gray-200 bg-white shadow-xl"
      style={{ top: "76px", height: "calc(100% - 176px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-violet-500" />
          <span className="font-semibold text-gray-800">Comments</span>
          <span className="text-sm text-gray-400">({captions.length})</span>
        </div>
        <button
          onClick={() => setCaptionPanelOpen(false)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={20} />
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-2 border-b border-gray-200 p-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute top-1/2 left-3 z-10 -translate-y-1/2 text-gray-400"
          />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search comments"
            className="pr-3 pl-9"
          />
        </div>
        <CaptionFilters
          filter={captionFilter}
          onFilterChange={setCaptionFilter}
          isOpen={showFilters}
          onToggle={() => setShowFilters(!showFilters)}
        />
      </div>

      {/* Caption list */}
      <div className="flex-1 overflow-y-auto">
        {filteredCaptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={48} className="mb-4 text-gray-300" />
            <p className="text-sm text-gray-500">
              {captions.length === 0
                ? "아직 댓글이 없습니다"
                : searchQuery.trim() || captionFilter.authorSearch?.trim()
                  ? "검색 결과가 없습니다"
                  : "표시할 댓글이 없습니다"}
            </p>
            {captions.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">
                C 키를 눌러 캔버스에 댓글을 추가하세요
              </p>
            )}
          </div>
        ) : (
          <div className="p-2">
            {filteredCaptions.map((caption) => (
              <CaptionPanelItem
                key={caption.id}
                caption={caption}
                index={getOriginalIndex(caption.id)}
                isActive={activeCaptionId === caption.id}
                onClick={() => handleItemClick(caption.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
