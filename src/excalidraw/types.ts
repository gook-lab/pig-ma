// ============================================================================
// Excalidraw 파일 포맷 타입
//
// .excalidraw 파일은 로컬 JSON — API 인증 없이 파싱만으로 import 가능.
// 스펙: https://docs.excalidraw.com/docs/codebase/json-schema
// 여기서는 import 에 필요한 필드만 느슨하게 정의한다 (알 수 없는 필드 무시).
// ============================================================================

export type ExcalidrawElementType =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "image"
  | "frame"
  | "magicframe"
  | "embeddable"
  | "iframe"
  | "selection";

export type ExcalidrawArrowhead =
  | "arrow"
  | "bar"
  | "dot"
  | "circle"
  | "circle_outline"
  | "triangle"
  | "triangle_outline"
  | "diamond"
  | "diamond_outline"
  | null;

export interface ExcalidrawBinding {
  elementId: string;
  focus?: number;
  gap?: number;
}

export interface ExcalidrawElement {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 라디안 */
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string; // "transparent" 가능
  fillStyle?: "solid" | "hachure" | "cross-hatch" | "zigzag";
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  /** 0~100 */
  opacity?: number;
  roundness?: { type: number; value?: number } | null;
  /** 안쪽이 outermost — 마지막 항목이 최상위 그룹 */
  groupIds?: string[];
  frameId?: string | null;
  isDeleted?: boolean;
  link?: string | null;
  locked?: boolean;
  // text
  text?: string;
  fontSize?: number;
  /** 1=hand-drawn, 2=normal, 3=code (신규 파일은 5~8) */
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: string;
  /** 바운드 텍스트 — 이 텍스트가 붙어 있는 컨테이너 요소 id */
  containerId?: string | null;
  // linear (arrow/line/freedraw) — (x,y) 기준 상대 좌표 [dx,dy] 쌍
  points?: [number, number][];
  startBinding?: ExcalidrawBinding | null;
  endBinding?: ExcalidrawBinding | null;
  startArrowhead?: ExcalidrawArrowhead;
  endArrowhead?: ExcalidrawArrowhead;
  /** 엘보우 화살표 (신규 버전) */
  elbowed?: boolean;
  // image
  fileId?: string | null;
  status?: string;
  // frame
  name?: string | null;
  // container → 바운드 텍스트 역참조
  boundElements?: { id: string; type: string }[] | null;
  // export 시 생성하는 메타 필드 (import 에서는 무시)
  seed?: number;
  version?: number;
  versionNonce?: number;
  updated?: number;
  roughness?: number;
}

export interface ExcalidrawBinaryFile {
  mimeType: string;
  /** data: URI */
  dataURL: string;
  id?: string;
}

export interface ExcalidrawData {
  type: "excalidraw";
  version: number;
  source?: string;
  elements: ExcalidrawElement[];
  appState?: Record<string, unknown>;
  files?: Record<string, ExcalidrawBinaryFile>;
}

export class ExcalidrawImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcalidrawImportError";
  }
}
