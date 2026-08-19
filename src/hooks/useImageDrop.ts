import { useCallback } from "react";
import { useCanvasStore } from "@/store";
import { createImage } from "@/utils/factory";
import {
  readPigmaFile,
  applyPigmaFile,
  PigmaFileError,
  PIGMA_FILE_EXTENSION,
} from "@/utils/pigmaFile";
import { importExcalidrawToCanvas, ExcalidrawImportError } from "@/excalidraw";
import toast from "@/utils/toast";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// .pigma 드롭 열기 — Header 의 "Open file" 과 동일한 UX (교체 확인 포함)
async function openDroppedPigmaFile(fileBlob: File): Promise<void> {
  try {
    const file = await readPigmaFile(fileBlob);
    const state = useCanvasStore.getState();
    const hasContent =
      state.objects.length > 0 || state.pages.some((p) => p.objects.length > 0);
    // 파괴적 동작(프로젝트 교체)이라 confirm 은 유지한다
    if (
      hasContent &&
      !window.confirm(
        "Opening a file will replace the current project. Continue?",
      )
    ) {
      return;
    }
    applyPigmaFile(file);
    toast.success({
      message: file.projectName
        ? `Opened "${file.projectName}"`
        : "Project opened",
    });
  } catch (err) {
    toast.error({
      message:
        err instanceof PigmaFileError ? err.message : "Failed to open file",
    });
  }
}

export function useImageDrop() {
  const { addObject, setTool, viewport } = useCanvasStore();

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();

      const file = e.dataTransfer?.files[0];
      if (!file) return;

      // .pigma 프로젝트 파일 드롭 → 열기 (이미지 드롭과 분기)
      if (file.name.toLowerCase().endsWith(PIGMA_FILE_EXTENSION)) {
        void openDroppedPigmaFile(file);
        return;
      }

      // .excalidraw 드롭 → 현재 캔버스에 추가 (교체가 아니라서 confirm 불필요)
      if (file.name.toLowerCase().endsWith(".excalidraw")) {
        void file
          .text()
          .then((text) => {
            const summary = importExcalidrawToCanvas(text);
            toast.success({
              message:
                summary.skippedCount > 0
                  ? `Imported ${summary.importedCount} objects (${summary.skippedCount} skipped)`
                  : `Imported ${summary.importedCount} objects`,
            });
          })
          .catch((err) => {
            toast.error({
              message:
                err instanceof ExcalidrawImportError
                  ? err.message
                  : "Failed to import Excalidraw file",
            });
          });
        return;
      }

      if (!file.type.startsWith("image/")) return;

      if (file.size > MAX_SIZE) {
        toast.error({ message: "Images must be 10MB or smaller" });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          // Scale down if needed
          let width = img.width;
          let height = img.height;
          const maxDim = 400;
          if (width > maxDim || height > maxDim) {
            const ratio = maxDim / Math.max(width, height);
            width *= ratio;
            height *= ratio;
          }

          // Calculate center position in canvas coordinates
          const centerX =
            (window.innerWidth / 2 - viewport.x) / viewport.zoom - width / 2;
          const centerY =
            (window.innerHeight / 2 - viewport.y) / viewport.zoom - height / 2;

          addObject(createImage(centerX, centerY, src, width, height));
          setTool("select");
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    },
    [addObject, setTool, viewport],
  );

  return { handleDrop };
}
