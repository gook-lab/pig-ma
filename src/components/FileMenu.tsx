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
  RotateCcw,
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
  getBackupInfo,
  restoreBackup,
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
      type="button"
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
export function FileMenu({ compact = false }: { compact?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showFigmaImport, setShowFigmaImport] = useState(false);
  const [showFigmaExport, setShowFigmaExport] = useState(false);
  const [showMermaidImport, setShowMermaidImport] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pigmaInputRef = useRef<HTMLInputElement>(null);
  const excalidrawInputRef = useRef<HTMLInputElement>(null);
  const isLocked = useCanvasStore((s) => s.isLocked);
  // 메뉴가 열릴 때만 백업 존재 여부 조회 (localStorage 접근 최소화)
  const backupInfo = showMenu ? getBackupInfo() : null;

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
      message: `“${file.projectName}” 프로젝트를 저장했습니다. (${file.pages.length}페이지)`,
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
        !window.confirm("파일을 열면 현재 프로젝트를 교체합니다. 계속할까요?")
      ) {
        return;
      }
      const { backedUp } = applyPigmaFile(file);
      const objectCount = file.pages.reduce(
        (sum, p) => sum + p.objects.length,
        0,
      );
      const dropped = file.droppedObjects ?? 0;
      const detail = [
        `${file.pages.length}페이지, 객체 ${objectCount}개`,
        dropped > 0 ? `손상된 객체 ${dropped}개 제외` : null,
        backedUp ? "이전 프로젝트 백업 완료" : null,
      ]
        .filter(Boolean)
        .join(". ");
      const notify = dropped > 0 ? toast.warning : toast.success;
      notify({
        title:
          dropped > 0
            ? "일부 항목을 제외하고 열었습니다"
            : "프로젝트를 열었습니다",
        message: `"${file.projectName}" — ${detail}`,
        duration: 3500,
      });
    } catch (err) {
      toast.error({
        title: "파일을 열지 못했습니다",
        message:
          err instanceof PigmaFileError
            ? err.message
            : "알 수 없는 오류가 발생했습니다",
      });
    }
  };

  const handleExportExcalidraw = () => {
    setShowMenu(false);
    const { data, exportedCount, skippedCount } = exportCanvasToExcalidraw();
    if (exportedCount === 0) {
      toast.warning({ message: "내보낼 객체가 없습니다" });
      return;
    }
    const projectName = useCanvasStore.getState().projectName;
    downloadExcalidrawFile(data, `${projectName}.excalidraw`);
    if (skippedCount > 0) {
      toast.warning({
        title: "지원하지 않는 객체를 제외했습니다",
        message: `객체 ${exportedCount}개를 내보내고 ${skippedCount}개를 제외했습니다`,
        duration: 3500,
      });
    } else {
      toast.success({
        message: `객체 ${exportedCount}개를 Excalidraw 파일로 내보냈습니다`,
      });
    }
  };

  const handleRestoreBackup = () => {
    setShowMenu(false);
    try {
      const file = restoreBackup();
      toast.success({
        title: "최근 백업을 복원했습니다",
        message: `“${file.projectName}” · 다시 복원하면 이전 상태로 돌아갑니다`,
        duration: 3000,
      });
    } catch (err) {
      toast.error({
        title: "백업을 복원하지 못했습니다",
        message:
          err instanceof PigmaFileError
            ? err.message
            : "알 수 없는 오류가 발생했습니다",
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
        title: "Excalidraw 파일을 가져왔습니다",
        message:
          skippedCount > 0
            ? `객체 ${importedCount}개 추가, ${skippedCount}개 제외`
            : `객체 ${importedCount}개를 추가했습니다`,
      });
    } catch (err) {
      toast.error({
        title: "Excalidraw 파일을 가져오지 못했습니다",
        message:
          err instanceof ExcalidrawImportError
            ? err.message
            : "알 수 없는 오류가 발생했습니다",
      });
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="파일"
          aria-expanded={showMenu}
          onClick={() => setShowMenu((prev) => !prev)}
          className={cn(
            compact
              ? "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-2 text-xs hover:bg-gray-50"
              : "flex h-12 items-center gap-2 px-3",
            !compact &&
              "rounded-xl border border-gray-200 bg-white shadow-lg dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
            "text-sm font-medium text-gray-700 dark:text-gray-800",
            "transition-all hover:bg-gray-50 dark:hover:bg-[#c8c9cc]",
            "active:scale-95",
            showMenu &&
              "border-gray-300 bg-gray-50 dark:border-[#b0b1b4] dark:bg-[#c8c9cc]",
          )}
        >
          <FolderDown size={18} aria-hidden="true" />
          {compact ? "파일" : "파일"}
          {!compact && (
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={cn("transition-transform", showMenu && "rotate-180")}
            />
          )}
        </button>

        {showMenu && (
          <div className="popover-enter absolute top-full right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            <MenuItem
              icon={FolderOpen}
              label="파일 열기"
              description=".pigma 프로젝트 파일을 엽니다"
              disabledWhenLocked
              isLocked={isLocked}
              onClick={() => {
                setShowMenu(false);
                pigmaInputRef.current?.click();
              }}
            />
            <MenuItem
              icon={FileDown}
              label="파일로 저장"
              description="프로젝트를 .pigma로 내려받습니다"
              isLocked={isLocked}
              onClick={handleSavePigma}
            />
            {backupInfo && (
              <MenuItem
                icon={RotateCcw}
                label="최근 백업 복원"
                description={`파일을 열기 전의 "${backupInfo.projectName}"`}
                disabledWhenLocked
                isLocked={isLocked}
                onClick={handleRestoreBackup}
              />
            )}
            <MenuItem
              icon={Download}
              label="Excalidraw 가져오기"
              description=".excalidraw 도형을 추가합니다"
              disabledWhenLocked
              isLocked={isLocked}
              onClick={() => {
                setShowMenu(false);
                excalidrawInputRef.current?.click();
              }}
            />
            <MenuItem
              icon={Upload}
              label="Excalidraw 내보내기"
              description="페이지를 .excalidraw로 저장합니다"
              isLocked={isLocked}
              onClick={handleExportExcalidraw}
            />
            <MenuItem
              icon={Workflow}
              label="Mermaid 가져오기"
              description="플로차트 정의를 붙여 넣습니다"
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
              label="Figma 가져오기"
              description="Figma 파일을 불러옵니다"
              disabledWhenLocked
              isLocked={isLocked}
              onClick={() => {
                setShowFigmaImport(true);
                setShowMenu(false);
              }}
            />
            <MenuItem
              icon={Upload}
              label="Figma 내보내기"
              description="SVG 또는 JSON으로 내보냅니다"
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
              label="이미지 내려받기"
              description="PNG, JPEG 또는 SVG로 저장합니다"
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
