import type { PageData } from "@/types";
import { useCanvasStore } from "@/store";
import { generateUUID } from "@/utils/uuid";
import { getInitialCanvasBounds } from "@/store/slices/core";

// ============================================================================
// .pigma 파일 포맷
//
// 프로젝트 전체(모든 페이지)를 JSON 하나로 직렬화하는 네이티브 파일 포맷.
// localStorage persist 와 별개로, 파일 단위 저장/열기/공유의 기준점이 된다.
// Excalidraw 등 외부 포맷 변환도 이 구조를 canonical 로 사용한다.
// ============================================================================

/** 스키마 변경 시 증가. 열기 시 이 값보다 큰 파일은 거부한다. */
export const PIGMA_FILE_VERSION = 1;

export const PIGMA_FILE_EXTENSION = ".pigma";

export interface PigmaFile {
  type: "pigma";
  version: number;
  exportedAt: string;
  projectName: string;
  pages: PageData[];
  currentPageId: string;
}

export class PigmaFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PigmaFileError";
  }
}

// ============================================================================
// 직렬화 (pure)
// ============================================================================

interface BuildPigmaFileInput {
  projectName: string;
  pages: PageData[];
  currentPageId: string;
  /** 현재 페이지의 라이브 상태 — pages 배열은 페이지 전환 시점 기준이라 stale 할 수 있음 */
  live: Pick<
    PageData,
    "objects" | "groups" | "captions" | "viewport" | "canvasBounds"
  >;
}

/**
 * 프로젝트 상태를 PigmaFile 로 직렬화한다.
 * switchPage 와 동일하게, 현재 페이지 항목에 라이브 상태를 반영한 뒤 내보낸다.
 */
export function buildPigmaFile(input: BuildPigmaFileInput): PigmaFile {
  const now = new Date().toISOString();
  const pages = input.pages.map((p) =>
    p.id === input.currentPageId ? { ...p, ...input.live, updatedAt: now } : p,
  );
  return {
    type: "pigma",
    version: PIGMA_FILE_VERSION,
    exportedAt: now,
    projectName: input.projectName,
    pages,
    currentPageId: input.currentPageId,
  };
}

// ============================================================================
// 파싱/검증 (pure)
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCanvasBounds(value: unknown): value is PageData["canvasBounds"] {
  return (
    isRecord(value) &&
    typeof value.minX === "number" &&
    typeof value.minY === "number" &&
    typeof value.maxX === "number" &&
    typeof value.maxY === "number"
  );
}

/** 페이지 필수 필드를 검증하고, 누락된 부가 필드는 기본값으로 채운다 */
function normalizePage(raw: unknown, index: number): PageData {
  if (!isRecord(raw)) {
    throw new PigmaFileError(`Invalid page at index ${index}`);
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new PigmaFileError(`Page at index ${index} is missing an id`);
  }
  if (!Array.isArray(raw.objects)) {
    throw new PigmaFileError(`Page "${raw.id}" is missing an objects array`);
  }
  const now = new Date().toISOString();
  const viewport = isRecord(raw.viewport)
    ? (raw.viewport as PageData["viewport"])
    : { x: 0, y: 0, zoom: 1 };
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : `페이지 ${index + 1}`,
    objects: raw.objects as PageData["objects"],
    groups: Array.isArray(raw.groups) ? (raw.groups as PageData["groups"]) : [],
    captions: Array.isArray(raw.captions)
      ? (raw.captions as PageData["captions"])
      : [],
    viewport,
    canvasBounds: isCanvasBounds(raw.canvasBounds)
      ? raw.canvasBounds
      : getInitialCanvasBounds(),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

/**
 * .pigma JSON 문자열을 파싱/검증한다.
 * 실패 시 PigmaFileError 를 던진다 (사용자에게 그대로 보여줄 수 있는 메시지).
 */
export function parsePigmaFile(json: string): PigmaFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new PigmaFileError("Not a valid JSON file");
  }
  if (!isRecord(data) || data.type !== "pigma") {
    throw new PigmaFileError("Not a .pigma file (missing type marker)");
  }
  if (typeof data.version !== "number" || data.version > PIGMA_FILE_VERSION) {
    throw new PigmaFileError(
      `Unsupported file version (${String(data.version)}). Please update the app.`,
    );
  }
  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    throw new PigmaFileError("File contains no pages");
  }

  const pages = data.pages.map(normalizePage);
  const firstPage = pages[0];
  if (!firstPage) {
    throw new PigmaFileError("File contains no pages");
  }
  const currentPageId =
    typeof data.currentPageId === "string" &&
    pages.some((p) => p.id === data.currentPageId)
      ? data.currentPageId
      : firstPage.id;

  return {
    type: "pigma",
    version: data.version,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : "",
    projectName:
      typeof data.projectName === "string" && data.projectName.length > 0
        ? data.projectName
        : "새 프로젝트",
    pages,
    currentPageId,
  };
}

// ============================================================================
// Store 연동 / 브라우저 I/O
// ============================================================================

/** 현재 store 상태를 PigmaFile 로 직렬화한다 */
export function exportCurrentProject(): PigmaFile {
  const s = useCanvasStore.getState();
  return buildPigmaFile({
    projectName: s.projectName,
    pages: s.pages,
    currentPageId: s.currentPageId,
    live: {
      objects: s.objects,
      groups: s.groups,
      captions: s.captions,
      viewport: s.viewport,
      canvasBounds: s.canvasBounds,
    },
  });
}

/**
 * PigmaFile 을 store 에 적용한다. 현재 프로젝트를 통째로 교체하며,
 * undo 히스토리도 초기화한다 (파일 열기를 undo 로 되돌릴 수 없음).
 */
export function applyPigmaFile(file: PigmaFile): void {
  const current =
    file.pages.find((p) => p.id === file.currentPageId) ?? file.pages[0];
  if (!current) {
    throw new PigmaFileError("File contains no pages");
  }

  useCanvasStore.setState({
    projectId: generateUUID(),
    projectName: file.projectName,
    pages: file.pages,
    currentPageId: current.id,
    objects: current.objects,
    groups: current.groups,
    captions: current.captions,
    viewport: current.viewport,
    canvasBounds: current.canvasBounds,
    selectedIds: [],
    editingTextId: null,
  });
  useCanvasStore.temporal.getState().clear();
}

/** PigmaFile 을 .pigma 파일로 다운로드한다 */
export function downloadPigmaFile(file: PigmaFile, filename?: string): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `${file.projectName}${PIGMA_FILE_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** File(Blob) 을 읽어 파싱된 PigmaFile 을 반환한다. 실패 시 PigmaFileError */
export async function readPigmaFile(fileBlob: File): Promise<PigmaFile> {
  const text = await fileBlob.text();
  return parsePigmaFile(text);
}
