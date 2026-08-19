import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  type ComponentType,
} from "react";
import {
  Figma,
  Upload,
  FolderDown,
  FolderOpen,
  FileDown,
  Download,
  ChevronDown,
  Image,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FigmaImportModal } from "./FigmaImportModal";
import { FigmaExportModal } from "./FigmaExportModal";
import { MermaidImportModal } from "./MermaidImportModal";
import { useCanvasStore } from "@/store";
import {
  exportCurrentProject,
  downloadPigmaFile,
  readPigmaFile,
  applyPigmaFile,
  PigmaFileError,
  PIGMA_FILE_EXTENSION,
} from "@/utils/pigmaFile";
import {
  importExcalidrawToCanvas,
  exportCanvasToExcalidraw,
  downloadExcalidrawFile,
  ExcalidrawImportError,
} from "@/excalidraw";
import toast from "@/utils/toast";

interface MenuItemProps {
  icon: ComponentType<{ size?: number | string }>;
  label: string;
  description: string;
  onClick: () => void;
  /** 캔버스 잠금 시 비활성화 여부 (기본 false) */
  disabledWhenLocked?: boolean;
  isLocked: boolean;
}

function MenuItem({
  icon: Icon,
  label,
  description,
  onClick,
  disabledWhenLocked = false,
  isLocked,
}: MenuItemProps) {
  const disabled = disabledWhenLocked && isLocked;
  return (
    <button
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "text-gray-700 hover:bg-gray-50",
      )}
    >
      <Icon size={16} />
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-[11px] text-gray-400">{description}</div>
      </div>
    </button>
  );
}

/**
 * Header 의 File 드롭다운 — 파일 열기/저장, Excalidraw/Figma import/export,
 * 이미지 다운로드. 숨김 file input 과 Figma 모달까지 이 컴포넌트가 소유한다.
 */
export function FileMenu() {
  const [showMenu, setShowMenu] = useState(false);
  const [showFigmaImport, setShowFigmaImport] = useState(false);
  const [showFigmaExport, setShowFigmaExport] = useState(false);
  const [showMermaidImport, setShowMermaidImport] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pigmaInputRef = useRef<HTMLInputElement>(null);
  const excalidrawInputRef = useRef<HTMLInputElement>(null);
  const isLocked = useCanvasStore((s) => s.isLocked);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleSavePigma = () => {
    setShowMenu(false);
    const file = exportCurrentProject();
    downloadPigmaFile(file);
    toast.success({
      message: `Saved "${file.projectName}" (${file.pages.length} page${file.pages.length > 1 ? "s" : ""})`,
    });
  };

  const handleOpenPigmaChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const fileBlob = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!fileBlob) return;
    try {
      const file = await readPigmaFile(fileBlob);
      const state = useCanvasStore.getState();
      const hasContent =
        state.objects.length > 0 ||
        state.pages.some((p) => p.objects.length > 0);
      if (
        hasContent &&
        !window.confirm(
          "Opening a file will replace the current project. Continue?",
        )
      ) {
        return;
      }
      applyPigmaFile(file);
      const objectCount = file.pages.reduce(
        (sum, p) => sum + p.objects.length,
        0,
      );
      toast.success({
        title: "Project opened",
        message: `"${file.projectName}" — ${file.pages.length} page(s), ${objectCount} object(s)`,
      });
    } catch (err) {
      toast.error({
        title: "Failed to open file",
        message: err instanceof PigmaFileError ? err.message : "Unknown error",
      });
    }
  };

  const handleExportExcalidraw = () => {
    setShowMenu(false);
    const { data, exportedCount, skippedCount } = exportCanvasToExcalidraw();
    if (exportedCount === 0) {
      toast.warning({ message: "Nothing to export" });
      return;
    }
    const projectName = useCanvasStore.getState().projectName;
    downloadExcalidrawFile(data, `${projectName}.excalidraw`);
    if (skippedCount > 0) {
      toast.warning({
        title: "Exported with skips",
        message: `${exportedCount} exported, ${skippedCount} unsupported object(s) skipped`,
        duration: 3500,
      });
    } else {
      toast.success({
        message: `Exported ${exportedCount} object(s) to .excalidraw`,
      });
    }
  };

  const handleImportExcalidrawChange = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const fileBlob = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!fileBlob) return;
    try {
      const text = await fileBlob.text();
      const { importedCount, skippedCount } = importExcalidrawToCanvas(text);
      toast.success({
        title: "Excalidraw imported",
        message:
          skippedCount > 0
            ? `${importedCount} object(s) added, ${skippedCount} skipped`
            : `${importedCount} object(s) added`,
      });
    } catch (err) {
      toast.error({
        title: "Failed to import Excalidraw",
        message:
          err instanceof ExcalidrawImportError ? err.message : "Unknown error",
      });
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu((prev) => !prev)}
          className={cn(
            "flex h-12 items-center gap-2 px-3",
            "rounded-xl border border-gray-200 bg-white shadow-lg",
            "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
            "text-sm font-medium text-gray-700 dark:text-gray-800",
            "transition-all hover:bg-gray-50 dark:hover:bg-[#c8c9cc]",
            "active:scale-95",
            showMenu &&
              "border-gray-300 bg-gray-50 dark:border-[#b0b1b4] dark:bg-[#c8c9cc]",
          )}
        >
          <FolderDown size={18} />
          File
          <ChevronDown
            size={14}
            className={cn("transition-transform", showMenu && "rotate-180")}
          />
        </button>

        {showMenu && (
          <div className="popover-enter absolute top-full right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            <MenuItem
              icon={FolderOpen}
              label="Open file"
              description="Open a .pigma project file"
              disabledWhenLocked
              isLocked={isLocked}
              onClick={() => {
                setShowMenu(false);
                pigmaInputRef.current?.click();
              }}
            />
            <MenuItem
              icon={FileDown}
              label="Save as file"
              description="Download project as .pigma"
              isLocked={isLocked}
              onClick={handleSavePigma}
            />
            <MenuItem
              icon={Download}
              label="Import Excalidraw"
              description="Add shapes from .excalidraw"
              disabledWhenLocked
              isLocked={isLocked}
              onClick={() => {
                setShowMenu(false);
                excalidrawInputRef.current?.click();
              }}
            />
            <MenuItem
              icon={Upload}
              label="Export Excalidraw"
              description="Download page as .excalidraw"
              isLocked={isLocked}
              onClick={handleExportExcalidraw}
            />
            <MenuItem
              icon={Workflow}
              label="Import Mermaid"
              description="Paste a flowchart definition"
              disabledWhenLocked
              isLocked={isLocked}
              onClick={() => {
                setShowMermaidImport(true);
                setShowMenu(false);
              }}
            />

            <div className="mx-3 my-1 h-px bg-gray-100" />

            <MenuItem
              icon={Figma}
              label="Figma Import"
              description="Import from Figma file"
              disabledWhenLocked
              isLocked={isLocked}
              onClick={() => {
                setShowFigmaImport(true);
                setShowMenu(false);
              }}
            />
            <MenuItem
              icon={Upload}
              label="Figma Export"
              description="Export to Figma (SVG / JSON)"
              disabledWhenLocked
              isLocked={isLocked}
              onClick={() => {
                setShowFigmaExport(true);
                setShowMenu(false);
              }}
            />

            <div className="mx-3 my-1 h-px bg-gray-100" />

            <MenuItem
              icon={Image}
              label="Download image"
              description="PNG, JPEG, PDF"
              isLocked={isLocked}
              onClick={() => {
                setShowMenu(false);
                window.dispatchEvent(new CustomEvent("open-export-panel"));
              }}
            />
          </div>
        )}
      </div>

      {/* Hidden file input for opening .pigma files */}
      <input
        ref={pigmaInputRef}
        type="file"
        accept={`${PIGMA_FILE_EXTENSION},application/json`}
        className="hidden"
        onChange={handleOpenPigmaChange}
      />

      {/* Hidden file input for importing .excalidraw files */}
      <input
        ref={excalidrawInputRef}
        type="file"
        accept=".excalidraw,application/json"
        className="hidden"
        onChange={handleImportExcalidrawChange}
      />

      {showFigmaImport && (
        <FigmaImportModal onClose={() => setShowFigmaImport(false)} />
      )}
      {showFigmaExport && (
        <FigmaExportModal onClose={() => setShowFigmaExport(false)} />
      )}
      {showMermaidImport && (
        <MermaidImportModal onClose={() => setShowMermaidImport(false)} />
      )}
    </>
  );
}
