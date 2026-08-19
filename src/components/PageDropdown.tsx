import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useCanvasStore, usePages, useCurrentPageId } from "@/store";
import { useHistoryStore } from "@/hooks/useAutoSave";
import type { PageData, CanvasObject, GroupInfo } from "@/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Z_DROPDOWN_BACKDROP, Z_DROPDOWN_CONTENT } from "@/constants/zIndex";

export function PageDropdown() {
  const pages = usePages();
  const currentPageId = useCurrentPageId();
  const { switchPage, createPage, deletePage, renamePage } = useCanvasStore();
  const { addSnapshot } = useHistoryStore();

  const [isOpen, setIsOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const currentPage = pages.find((p: PageData) => p.id === currentPageId);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setEditingPageId(null);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // 편집 시작 시 input에 포커스
  useEffect(() => {
    if (editingPageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingPageId]);

  const handlePageClick = useCallback(
    (pageId: string) => {
      if (editingPageId) return; // 편집 중일 때는 클릭 무시
      if (pageId === currentPageId) {
        setIsOpen(false);
        return;
      }

      // 페이지 전환 전 현재 페이지 자동 저장
      const state = useCanvasStore.getState();
      if (state.objects.length > 0) {
        addSnapshot(
          currentPageId,
          state.objects as CanvasObject[],
          state.groups as GroupInfo[],
          "페이지 전환 전 자동 저장",
        );
      }

      switchPage(pageId);
      setIsOpen(false);
    },
    [switchPage, editingPageId, currentPageId, addSnapshot],
  );

  const handleCreatePage = useCallback(() => {
    createPage();
    setIsOpen(false);
  }, [createPage]);

  const handleStartEdit = useCallback(
    (e: React.MouseEvent, pageId: string, pageName: string) => {
      e.stopPropagation();
      setEditingPageId(pageId);
      setEditValue(pageName);
    },
    [],
  );

  const handleSaveEdit = useCallback(() => {
    if (editingPageId && editValue.trim()) {
      renamePage(editingPageId, editValue.trim());
    }
    setEditingPageId(null);
  }, [editingPageId, editValue, renamePage]);

  const handleCancelEdit = useCallback(() => {
    setEditingPageId(null);
    setEditValue("");
  }, []);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit],
  );

  const handleDeletePage = useCallback(
    (e: React.MouseEvent, pageId: string) => {
      e.stopPropagation();
      if (pages.length <= 1) return; // 마지막 페이지는 삭제 불가
      deletePage(pageId);
    },
    [pages.length, deletePage],
  );

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
          "text-xs font-medium text-gray-700",
          "transition-colors hover:bg-gray-100",
          "border border-transparent",
          isOpen && "border-gray-200 bg-gray-100",
        )}
      >
        <span className="max-w-[120px] truncate">
          {currentPage?.name ?? "페이지 선택"}
        </span>
        <ChevronDown
          size={14}
          className={cn("transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0"
            style={{ zIndex: Z_DROPDOWN_BACKDROP }}
            onClick={() => {
              setIsOpen(false);
              setEditingPageId(null);
            }}
          />

          {/* Dropdown Panel */}
          <div
            className={cn(
              "absolute top-full left-0 mt-1",
              "w-64 rounded-xl bg-white shadow-xl",
              "overflow-hidden border border-gray-200",
            )}
            style={{ zIndex: Z_DROPDOWN_CONTENT }}
          >
            {/* Page List */}
            <div className="max-h-64 overflow-y-auto py-1">
              {pages.map((page: PageData, index: number) => (
                <div
                  key={page.id}
                  onClick={() => handlePageClick(page.id)}
                  className={cn(
                    "mx-1 flex items-center gap-2 rounded-lg px-3 py-2",
                    "group cursor-pointer transition-colors",
                    page.id === currentPageId
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  {/* Page Number */}
                  <span
                    className={cn(
                      "h-5 w-5 flex-shrink-0 rounded text-xs font-medium",
                      "flex items-center justify-center",
                      page.id === currentPageId
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-600",
                    )}
                  >
                    {index + 1}
                  </span>

                  {/* Page Name */}
                  {editingPageId === page.id ? (
                    <Input
                      ref={editInputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 flex-1 px-2 py-0.5 text-sm"
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm">{page.name}</span>
                  )}

                  {/* Action Buttons */}
                  {editingPageId === page.id ? (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit();
                        }}
                        className="rounded p-1 transition-colors hover:bg-blue-100"
                        title="저장"
                      >
                        <Check size={14} className="text-blue-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        className="rounded p-1 transition-colors hover:bg-gray-100"
                        title="취소"
                      >
                        <X size={14} className="text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => handleStartEdit(e, page.id, page.name)}
                        className="rounded p-1 transition-colors hover:bg-gray-200"
                        title="이름 변경"
                      >
                        <Pencil size={14} className="text-gray-500" />
                      </button>
                      {pages.length > 1 && (
                        <button
                          onClick={(e) => handleDeletePage(e, page.id)}
                          className="rounded p-1 transition-colors hover:bg-red-100"
                          title="삭제"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Page Button */}
            <div className="border-t border-gray-100 p-1">
              <button
                onClick={handleCreatePage}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2",
                  "text-sm text-gray-600 transition-colors hover:bg-gray-50",
                )}
              >
                <Plus size={16} />
                <span>페이지 추가</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
