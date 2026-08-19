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

// ============================================================================
// 자동 백업 — 프로젝트 교체 직전 스냅샷을 localStorage 에 보관
// ============================================================================

const BACKUP_STORAGE_KEY = "pigma-backup-before-open";

export interface PigmaBackupInfo {
  projectName: string;
  savedAt: string;
}

function safeLocalStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** 보관된 백업의 요약 정보. 없거나 손상됐으면 null */
export function getBackupInfo(): PigmaBackupInfo | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return null;
    const file = parsePigmaFile(raw);
    return { projectName: file.projectName, savedAt: file.exportedAt };
  } catch {
    return null;
  }
}

/**
 * 백업을 복원한다. applyPigmaFile 이 복원 직전 상태를 다시 백업하므로
 * 결과적으로 현재 프로젝트 ↔ 백업이 서로 교환된다 (재복원으로 되돌리기 가능).
 * 백업이 없으면 PigmaFileError.
 */
export function restoreBackup(): PigmaFile {
  const storage = safeLocalStorage();
  const raw = storage?.getItem(BACKUP_STORAGE_KEY);
  if (!raw) {
    throw new PigmaFileError("No backup found");
  }
  const file = parsePigmaFile(raw);
  applyPigmaFile(file);
  return file;
}

export interface ApplyPigmaResult {
  /** 교체 직전 프로젝트가 백업되었는지 (localStorage 용량 초과 등이면 false) */
  backedUp: boolean;
}

/**
 * PigmaFile 을 store 에 적용한다. 현재 프로젝트를 통째로 교체하며,
 * undo 히스토리도 초기화한다 (파일 열기를 undo 로 되돌릴 수 없음).
 * 교체 직전 프로젝트는 자동 백업된다 — restoreBackup() 으로 복구 가능.
 */
export function applyPigmaFile(file: PigmaFile): ApplyPigmaResult {
  const current =
    file.pages.find((p) => p.id === file.currentPageId) ?? file.pages[0];
  if (!current) {
    throw new PigmaFileError("File contains no pages");
  }

  // 교체 직전 상태 백업 (best-effort — 실패해도 열기는 진행)
  let backedUp = false;
  const storage = safeLocalStorage();
  if (storage) {
    try {
      storage.setItem(
        BACKUP_STORAGE_KEY,
        JSON.stringify(exportCurrentProject()),
      );
      backedUp = true;
    } catch {
      // 이미지가 많아 quota 초과 등 — 백업 없이 진행
    }
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
  return { backedUp };
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
