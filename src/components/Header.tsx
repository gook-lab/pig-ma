import { useState } from "react";
import { Share2, LayoutTemplate } from "lucide-react";
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
  const hideUI = useCanvasStore((s) => s.hideUI);
  const showTemplatesPanel = useCanvasStore((s) => s.showTemplatesPanel);
  const setShowTemplatesPanel = useCanvasStore((s) => s.setShowTemplatesPanel);
  const isLocked = useCanvasStore((s) => s.isLocked);

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
              <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-600" />
              <ProjectNameEditor />
              <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-600" />
              <PageDropdown />
            </>
          )}
        </div>

        {/* Right - Search + File + Templates + Share */}
        {!hideUI && (
          <div className="pointer-events-auto flex items-center gap-2">
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
              title="Templates"
            >
              <LayoutTemplate size={18} />
              Templates
            </button>

            {/* Share Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className={cn(
                "flex h-12 items-center gap-2 px-4",
                "rounded-xl bg-violet-500 shadow-lg",
                "text-sm font-medium text-white",
                "transition-all hover:bg-violet-600",
                "active:scale-95",
              )}
            >
              <Share2 size={18} />
              공유
            </button>
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
