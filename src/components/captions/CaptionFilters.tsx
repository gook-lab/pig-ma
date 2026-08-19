import { memo, useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { CaptionFilter } from "@/types";

interface CaptionFiltersProps {
  filter: CaptionFilter;
  onFilterChange: (filter: Partial<CaptionFilter>) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const CaptionFilters = memo(function CaptionFilters({
  filter,
  onFilterChange,
  isOpen,
  onToggle,
}: CaptionFiltersProps) {
  const [localAuthorSearch, setLocalAuthorSearch] = useState(
    filter.authorSearch || "",
  );
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state with filter when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setLocalAuthorSearch(filter.authorSearch || "");
    }
  }, [isOpen, filter.authorSearch]);

  // Debounced author search
  const handleAuthorSearchChange = (value: string) => {
    setLocalAuthorSearch(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onFilterChange({ authorSearch: value });
    }, 300);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-500 transition-colors",
          "hover:bg-gray-100 hover:text-gray-700",
          isOpen && "bg-gray-100 text-gray-700",
        )}
      >
        필터
        <ChevronDown
          size={14}
          className={cn("transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="absolute top-full right-0 z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
            {/* Show resolved */}
            <button
              onClick={() =>
                onFilterChange({ showResolved: !filter.showResolved })
              }
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <span>해결된 댓글 표시</span>
              {filter.showResolved && (
                <Check size={14} className="text-violet-500" />
              )}
            </button>

            {/* Only my threads */}
            <button
              onClick={() =>
                onFilterChange({ onlyMyThreads: !filter.onlyMyThreads })
              }
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <span>내 댓글만</span>
              {filter.onlyMyThreads && (
                <Check size={14} className="text-violet-500" />
              )}
            </button>

            <div className="my-1 border-t border-gray-100" />

            {/* Author search */}
            <div className="px-3 py-1 text-xs font-medium text-gray-400">
              작성자 검색
            </div>
            <div className="px-3 py-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute top-1/2 left-2 z-10 -translate-y-1/2 text-gray-400"
                />
                <Input
                  type="text"
                  value={localAuthorSearch}
                  onChange={(e) => handleAuthorSearchChange(e.target.value)}
                  placeholder="이름으로 검색..."
                  className="h-8 pr-2 pl-7 text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="my-1 border-t border-gray-100" />

            {/* Sort options */}
            <div className="px-3 py-1 text-xs font-medium text-gray-400">
              정렬
            </div>
            <button
              onClick={() => onFilterChange({ sortBy: "date" })}
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <span>날짜순</span>
              {filter.sortBy === "date" && (
                <Check size={14} className="text-violet-500" />
              )}
            </button>
            <button
              onClick={() => onFilterChange({ sortBy: "unread" })}
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <span>읽지 않음</span>
              {filter.sortBy === "unread" && (
                <Check size={14} className="text-violet-500" />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
});
