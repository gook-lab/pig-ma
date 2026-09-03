import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import type { CanvasObject } from "@/types";
import { Z_SIDE_PANEL } from "@/constants/zIndex";
import { tiptapToPlainText } from "@/utils/tiptapMigration";

interface SearchResult {
  object: CanvasObject;
  matchText: string;
  matchType: "text" | "label" | "content";
}

/** 객체에서 검색 가능한 텍스트 추출 */
function getSearchableText(obj: CanvasObject): string[] {
  const texts: string[] = [];

  // 일반 텍스트
  if (obj.text) texts.push(obj.text);

  // Tiptap 콘텐츠
  if (obj.tiptapContent) {
    const plainText = tiptapToPlainText(obj.tiptapContent);
    if (plainText) texts.push(plainText);
  }

  // 커넥터 라벨
  if (obj.label) texts.push(obj.label);

  // 차트 데이터
  if (obj.chartData) {
    obj.chartData.items.forEach((item) => {
      if (item.label) texts.push(item.label);
    });
    if (obj.chartData.series) {
      obj.chartData.series.forEach((s) => {
        if (s.name) texts.push(s.name);
      });
    }
  }

  // 테이블 데이터
  if (obj.tableData?.cells) {
    Object.values(obj.tableData.cells).forEach((cell) => {
      if (cell.content) {
        const plainText = tiptapToPlainText(cell.content);
        if (plainText) texts.push(plainText);
      }
    });
  }

  return texts;
}

export function SearchPanel({ mobile = false }: { mobile?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const objects = useCanvasStore((s) => s.objects);
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const viewport = useCanvasStore((s) => s.viewport);

  // 검색 결과
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const matched: SearchResult[] = [];

    objects.forEach((obj) => {
      const texts = getSearchableText(obj);
      for (const text of texts) {
        if (text.toLowerCase().includes(lowerQuery)) {
          matched.push({
            object: obj,
            matchText: text,
            matchType: obj.label ? "label" : obj.chartData ? "content" : "text",
          });
          break; // 객체당 하나만
        }
      }
    });

    return matched;
  }, [query, objects]);

  // 결과로 이동
  const navigateToResult = useCallback(
    (index: number) => {
      const result = results[index];
      if (!result) return;

      const obj = result.object;
      const centerX = obj.x + (obj.width ?? 100) / 2;
      const centerY = obj.y + (obj.height ?? 100) / 2;

      // 뷰포트 중앙으로 이동
      setViewport({
        ...viewport,
        x: -centerX * viewport.zoom + window.innerWidth / 2,
        y: -centerY * viewport.zoom + window.innerHeight / 2,
      });

      // 선택
      setSelectedIds([obj.id]);
      setCurrentIndex(index);
    },
    [results, viewport, setViewport, setSelectedIds],
  );

  // 다음/이전 결과
  const goNext = useCallback(() => {
    if (results.length === 0) return;
    const nextIndex = (currentIndex + 1) % results.length;
    navigateToResult(nextIndex);
  }, [currentIndex, results.length, navigateToResult]);

  const goPrev = useCallback(() => {
    if (results.length === 0) return;
    const prevIndex = (currentIndex - 1 + results.length) % results.length;
    navigateToResult(prevIndex);
  }, [currentIndex, results.length, navigateToResult]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F로 검색 열기
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      // ESC로 닫기
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
      }
      // Enter로 다음 결과
      if (e.key === "Enter" && isOpen && results.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          goPrev();
        } else {
          goNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results.length, goNext, goPrev]);

  // 첫 결과 자동 이동
  useEffect(() => {
    if (results.length > 0 && currentIndex >= results.length) {
      setCurrentIndex(0);
    }
    if (results.length === 1) {
      navigateToResult(0);
    }
  }, [results.length, currentIndex, navigateToResult]);

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="검색"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={cn(
          "pointer-events-auto flex h-10 w-10 items-center justify-center",
          "rounded-lg border border-gray-200 bg-white shadow-md",
          "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
          "text-gray-600 transition-all hover:bg-gray-50",
          "dark:text-gray-700 dark:hover:bg-[#c8c9cc]",
        )}
        title="검색 (Cmd+F)"
      >
        <Search size={18} />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2",
        mobile && "fixed top-4 right-4 left-4",
        "rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg",
        "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
      )}
      style={{ zIndex: Z_SIDE_PANEL }}
    >
      <Search size={16} className="text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCurrentIndex(0);
        }}
        placeholder="캔버스 검색"
        className={cn(
          "min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400 dark:text-gray-800 dark:caret-gray-800",
          mobile ? "flex-1" : "w-48",
        )}
        autoFocus
      />

      {results.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>
            {currentIndex + 1}/{results.length}
          </span>
          <button
            type="button"
            aria-label="이전 검색 결과"
            onClick={goPrev}
            className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
            title="이전 결과 (Shift+Enter)"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            aria-label="다음 검색 결과"
            onClick={goNext}
            className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
            title="다음 결과 (Enter)"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {query && results.length === 0 && (
        <span className="text-xs text-gray-400">검색 결과 없음</span>
      )}

      <button
        type="button"
        aria-label="검색 닫기"
        onClick={() => {
          setIsOpen(false);
          setQuery("");
        }}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#c8c9cc]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
