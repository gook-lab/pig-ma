import type {
  CanvasObject,
  GroupInfo,
  MarkerStyle,
  PathStyle,
  ShapeVariant,
} from "@/types";
import type {
  ExcalidrawArrowhead,
  ExcalidrawData,
  ExcalidrawElement,
} from "./types";
import { ExcalidrawImportError } from "./types";

// ============================================================================
// Excalidraw → pig-ma 변환
// ============================================================================

export interface ExcalidrawImportResult {
  objects: CanvasObject[];
  groups: GroupInfo[];
  /** 지원하지 않아 건너뛴 요소 수 */
  skippedCount: number;
}

const RAD_TO_DEG = 180 / Math.PI;

/** Excalidraw arrowhead → pig-ma MarkerStyle */
function toMarker(
  arrowhead: ExcalidrawArrowhead | undefined,
  fallback: MarkerStyle,
): MarkerStyle {
  if (arrowhead === undefined) return fallback;
  switch (arrowhead) {
    case null:
      return "none";
    case "arrow":
    case "bar":
      return "arrow";
    case "triangle":
    case "triangle_outline":
      return "filledArrow";
    case "dot":
    case "circle":
    case "circle_outline":
      return "circle";
    case "diamond":
    case "diamond_outline":
      return "diamond";
    default:
      return fallback;
  }
}

function toPathStyle(el: ExcalidrawElement): PathStyle {
  if (el.elbowed) return "elbowed";
  // 다점(꺾인) 화살표는 중간점을 보존할 수 없으므로 curved 로 근사
  if ((el.points?.length ?? 0) > 2) return "curved";
  return "straight";
}

/** 공통 스타일 필드 변환 */
function baseStyle(el: ExcalidrawElement): Partial<CanvasObject> {
  return {
    rotation: (el.angle ?? 0) * RAD_TO_DEG,
    opacity: (el.opacity ?? 100) / 100,
    stroke: el.strokeColor,
    strokeWidth: el.strokeWidth,
    lineStyle: el.strokeStyle,
    locked: el.locked || undefined,
  };
}

/** 도형 fill — "transparent" 는 fillMode 로 표현 */
function fillStyle(el: ExcalidrawElement): Partial<CanvasObject> {
  if (!el.backgroundColor || el.backgroundColor === "transparent") {
    return { fillMode: "transparent" };
  }
  // hachure/cross-hatch 등 손그림 패턴은 solid 로 근사
  return { fill: el.backgroundColor, fillMode: "fill" };
}

function toShapeVariant(el: ExcalidrawElement): ShapeVariant {
  switch (el.type) {
    case "ellipse":
      return "ellipse";
    case "diamond":
      return "diamond";
    default:
      return el.roundness ? "roundedRect" : "rectangle";
  }
}

/** points [dx,dy][] → flat [dx,dy,...] */
function flattenPoints(points: [number, number][] | undefined): number[] {
  const flat: number[] = [];
  for (const p of points ?? []) {
    flat.push(p[0] ?? 0, p[1] ?? 0);
  }
  return flat;
}

/** 바운드 텍스트를 컨테이너에 병합할 때 쓰는 텍스트 스타일 */
function boundTextStyle(textEl: ExcalidrawElement): Partial<CanvasObject> {
  return {
    text: textEl.text,
    fontSize: textEl.fontSize,
    textColor: textEl.strokeColor,
    textAlign: textEl.textAlign,
    fontWeight: undefined,
  };
}

/**
 * Excalidraw 데이터를 pig-ma objects/groups 로 변환한다.
 * 좌표는 Excalidraw 원본 그대로 유지 — 뷰포트 배치는 import.ts 에서 수행.
 */
export function convertExcalidraw(
  data: ExcalidrawData,
): ExcalidrawImportResult {
  const elements = data.elements.filter((el) => !el.isDeleted);
  const files = data.files ?? {};

  // 바운드 텍스트 수집: containerId 가 살아있는 요소를 가리키는 text
  const elementIds = new Set(elements.map((el) => el.id));
  const boundTextByContainer = new Map<string, ExcalidrawElement>();
  for (const el of elements) {
    if (
      el.type === "text" &&
      el.containerId &&
      elementIds.has(el.containerId)
    ) {
      boundTextByContainer.set(el.containerId, el);
    }
  }

  const objects: CanvasObject[] = [];
  const groups: GroupInfo[] = [];
  const groupNames = new Map<string, string>(); // groupId → name (frame 이름 등)
  let skippedCount = 0;

  // frame 먼저 그룹으로 등록 (멤버는 frameId 로 연결)
  for (const el of elements) {
    if (el.type === "frame" || el.type === "magicframe") {
      groups.push({
        id: el.id,
        name: el.name ?? "Frame",
        customBounds: {
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
        },
      });
      groupNames.set(el.id, el.name ?? "Frame");
    }
  }

  const knownGroupIds = new Set(groups.map((g) => g.id));

  /** 요소의 소속 그룹 결정: frame 우선, 없으면 최상위 groupId */
  function resolveGroupId(el: ExcalidrawElement): string | undefined {
    if (el.frameId && knownGroupIds.has(el.frameId)) return el.frameId;
    const outermost = el.groupIds?.[el.groupIds.length - 1];
    if (!outermost) return undefined;
    if (!knownGroupIds.has(outermost)) {
      groups.push({ id: outermost, name: "Group" });
      knownGroupIds.add(outermost);
    }
    return outermost;
  }

  for (const el of elements) {
    // frame 은 위에서 그룹으로 처리됨
    if (el.type === "frame" || el.type === "magicframe") continue;
    // 바운드 텍스트는 컨테이너에 병합되므로 개별 객체로 만들지 않음
    if (
      el.type === "text" &&
      el.containerId &&
      elementIds.has(el.containerId)
    ) {
      continue;
    }

    const obj = convertElement(el, boundTextByContainer, files, elementIds);
    if (!obj) {
      skippedCount++;
      continue;
    }
    const groupId = resolveGroupId(el);
    if (groupId) obj.groupId = groupId;
    objects.push(obj);
  }

  // 멤버가 하나도 없는 groupIds 기반 그룹은 제거 (frame 은 빈 상태도 유지)
  const usedGroupIds = new Set(objects.map((o) => o.groupId).filter(Boolean));
  const finalGroups = groups.filter(
    (g) => g.customBounds || usedGroupIds.has(g.id),
  );

  return { objects, groups: finalGroups, skippedCount };
}

/** 단일 요소 변환. 지원하지 않는 타입이면 null */
function convertElement(
  el: ExcalidrawElement,
  boundTextByContainer: Map<string, ExcalidrawElement>,
  files: NonNullable<ExcalidrawData["files"]>,
  elementIds: Set<string>,
): CanvasObject | null {
  const boundText = boundTextByContainer.get(el.id);

  switch (el.type) {
    case "rectangle":
    case "ellipse":
    case "diamond":
      return {
        id: el.id,
        type: "shape",
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        shapeVariant: toShapeVariant(el),
        ...baseStyle(el),
        ...fillStyle(el),
        ...(boundText ? boundTextStyle(boundText) : {}),
        rotation: (el.angle ?? 0) * RAD_TO_DEG,
        opacity: (el.opacity ?? 100) / 100,
      };

    case "text":
      return {
        id: el.id,
        type: "textBox",
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        text: el.text ?? "",
        fontSize: el.fontSize,
        textColor: el.strokeColor,
        textAlign: el.textAlign,
        rotation: (el.angle ?? 0) * RAD_TO_DEG,
        opacity: (el.opacity ?? 100) / 100,
      };

    case "freedraw":
      return {
        id: el.id,
        type: "line",
        x: el.x,
        y: el.y,
        points: flattenPoints(el.points),
        penType: "pen",
        ...baseStyle(el),
        rotation: (el.angle ?? 0) * RAD_TO_DEG,
        opacity: (el.opacity ?? 100) / 100,
      };

    case "line": {
      const pts = el.points ?? [];
      // 2점 직선은 standalone 커넥터로 (마커 없음), 다점은 폴리라인으로
      if (pts.length === 2) {
        return convertLinear(el, elementIds, "none", boundText);
      }
      return {
        id: el.id,
        type: "line",
        x: el.x,
        y: el.y,
        points: flattenPoints(el.points),
        penType: "pen",
        ...baseStyle(el),
        rotation: (el.angle ?? 0) * RAD_TO_DEG,
        opacity: (el.opacity ?? 100) / 100,
      };
    }

    case "arrow":
      return convertLinear(el, elementIds, "arrow", boundText);

    case "image": {
      const file = el.fileId ? files[el.fileId] : undefined;
      if (!file?.dataURL) return null;
      return {
        id: el.id,
        type: "image",
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        src: file.dataURL,
        rotation: (el.angle ?? 0) * RAD_TO_DEG,
        opacity: (el.opacity ?? 100) / 100,
      };
    }

    default:
      return null;
  }
}

/** arrow/line(2점) → pig-ma connector. 바운드 텍스트는 커넥터 라벨로 */
function convertLinear(
  el: ExcalidrawElement,
  elementIds: Set<string>,
  defaultEndMarker: MarkerStyle,
  boundText?: ExcalidrawElement,
): CanvasObject {
  const pts = el.points ?? [];
  const first = pts[0] ?? [0, 0];
  const last = pts[pts.length - 1] ?? [el.width, el.height];

  const sourceId =
    el.startBinding && elementIds.has(el.startBinding.elementId)
      ? el.startBinding.elementId
      : undefined;
  const targetId =
    el.endBinding && elementIds.has(el.endBinding.elementId)
      ? el.endBinding.elementId
      : undefined;

  return {
    id: el.id,
    type: "connector",
    x: el.x + (first[0] ?? 0),
    y: el.y + (first[1] ?? 0),
    endX: el.x + (last[0] ?? 0),
    endY: el.y + (last[1] ?? 0),
    sourceId,
    targetId,
    pathStyle: toPathStyle(el),
    startMarker: toMarker(el.startArrowhead, "none"),
    endMarker: toMarker(el.endArrowhead, defaultEndMarker),
    label: boundText?.text,
    ...baseStyle(el),
    rotation: 0, // 커넥터는 절대 좌표 기반 — 회전은 끝점에 반영되지 않아 무시
    opacity: (el.opacity ?? 100) / 100,
  };
}

// ============================================================================
// 파싱/검증
// ============================================================================

/**
 * .excalidraw JSON 문자열을 파싱/검증한다.
 * 실패 시 ExcalidrawImportError (사용자에게 그대로 보여줄 수 있는 메시지).
 */
export function parseExcalidrawFile(json: string): ExcalidrawData {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ExcalidrawImportError("Not a valid JSON file");
  }
  if (
    typeof data !== "object" ||
    data === null ||
    (data as Record<string, unknown>).type !== "excalidraw"
  ) {
    throw new ExcalidrawImportError(
      "Not an Excalidraw file (missing type marker)",
    );
  }
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.elements)) {
    throw new ExcalidrawImportError("File has no elements array");
  }
  return {
    type: "excalidraw",
    version: typeof record.version === "number" ? record.version : 2,
    source: typeof record.source === "string" ? record.source : undefined,
    elements: record.elements as ExcalidrawData["elements"],
    files:
      typeof record.files === "object" && record.files !== null
        ? (record.files as ExcalidrawData["files"])
        : {},
  };
}
