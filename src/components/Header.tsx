import { useEffect, useRef, useState } from "react";
import { Share2, LayoutTemplate, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShareModal } from "./ShareModal";
import { FileMenu } from "./FileMenu";
import { ExportPanel } from "./ExportPanel";
import { ProjectNameEditor } from "./ProjectNameEditor";
import { PageDropdown } from "./PageDropdown";
import { LogoMenu } from "./LogoMenu";
import { SearchPanel } from "./SearchPanel";
import { SettingsMenu } from "./SettingsMenu";
import { Z_HEADER } from "@/constants/zIndex";
import { useCanvasStore } from "@/store";

export function Header() {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hideUI = useCanvasStore((s) => s.hideUI);
  const showTemplatesPanel = useCanvasStore((s) => s.showTemplatesPanel);
  const setShowTemplatesPanel = useCanvasStore((s) => s.setShowTemplatesPanel);
  const isLocked = useCanvasStore((s) => s.isLocked);

  useEffect(() => {
    if (!showMobileMenu) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setShowMobileMenu(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [showMobileMenu]);

  return (
    <>
      <header
        className="pointer-events-none fixed top-4 right-4 left-4 flex items-center justify-between"
        style={{ zIndex: Z_HEADER }}
      >
        {/* Left - Navigation Bar */}
        <div
          className={cn(
            "pointer-events-auto flex h-12 items-center gap-1 px-3",
            "rounded-xl border border-gray-200 bg-white shadow-lg",
            "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
          )}
        >
          <LogoMenu />

          {!hideUI && (
            <>
              <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-gray-600" />
              <div className="hidden sm:block">
                <ProjectNameEditor />
              </div>
              <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-gray-600" />
              <PageDropdown />
            </>
          )}
        </div>

        {/* Right - Search + File + Templates + Share */}
        {!hideUI && (
          <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
            <SearchPanel />

            <FileMenu />

            <SettingsMenu />

            {/* Templates Button */}
            <button
              onClick={() => {
                if (isLocked) return;
                setShowTemplatesPanel(!showTemplatesPanel);
              }}
              className={cn(
                "flex h-12 items-center gap-2 px-3",
                "rounded-xl border border-gray-200 bg-white shadow-lg",
                "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
                "text-sm font-medium text-gray-700 dark:text-gray-800",
                "transition-all hover:bg-gray-50 dark:hover:bg-[#c8c9cc]",
                "active:scale-95",
                isLocked && "cursor-not-allowed opacity-40",
                !isLocked &&
                  showTemplatesPanel &&
                  "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
              )}
              disabled={isLocked}
              type="button"
              aria-label="템플릿"
              aria-pressed={showTemplatesPanel}
              title="템플릿"
            >
              <LayoutTemplate size={18} aria-hidden="true" />
              템플릿
            </button>

            {/* Share Button */}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              aria-label="공유"
              className={cn(
                "flex h-12 items-center gap-2 px-4",
                "rounded-xl bg-violet-500 shadow-lg",
                "text-sm font-medium text-white",
                "transition-all hover:bg-violet-600",
                "active:scale-95",
              )}
            >
              <Share2 size={18} aria-hidden="true" />
              공유
            </button>
          </div>
        )}

        {!hideUI && (
          <div className="pointer-events-auto flex items-center gap-2 sm:hidden">
            <SearchPanel mobile />
            <div className="relative" ref={mobileMenuRef}>
              <button
                type="button"
                aria-label="더보기 메뉴"
                aria-expanded={showMobileMenu}
                onClick={() => setShowMobileMenu((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-lg transition-colors hover:bg-gray-50 dark:border-[#c0c1c4] dark:bg-[#d6d7da]"
              >
                <MoreHorizontal size={20} aria-hidden="true" />
              </button>

              {showMobileMenu && (
                <div className="absolute top-full right-0 mt-2 grid w-44 grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-[#c0c1c4] dark:bg-[#d6d7da]">
                  <FileMenu compact />
                  <SettingsMenu compact />
                  <button
                    type="button"
                    disabled={isLocked}
                    aria-label="템플릿"
                    aria-pressed={showTemplatesPanel}
                    onClick={() => {
                      if (isLocked) return;
                      setShowTemplatesPanel(!showTemplatesPanel);
                      setShowMobileMenu(false);
                    }}
                    className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <LayoutTemplate size={18} aria-hidden="true" />
                    템플릿
                  </button>
                  <button
                    type="button"
                    aria-label="공유"
                    onClick={() => {
                      setShowShareModal(true);
                      setShowMobileMenu(false);
                    }}
                    className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg bg-violet-500 text-xs text-white hover:bg-violet-600"
                  >
                    <Share2 size={18} aria-hidden="true" />
                    공유
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hidden ExportPanel — event 구동이라 hideUI 와 무관하게 항상 마운트 */}
      <ExportPanel />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </>
  );
}
