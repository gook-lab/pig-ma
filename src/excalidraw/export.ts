import Konva from "konva";
import type { JSONContent } from "@tiptap/core";
import type { CanvasObject, GroupInfo, MarkerStyle } from "@/types";
import { useCanvasStore } from "@/store";
import type {
  ExcalidrawArrowhead,
  ExcalidrawBinaryFile,
  ExcalidrawData,
  ExcalidrawElement,
} from "./types";

// ============================================================================
// pig-ma → Excalidraw 내보내기
//
// chart / codeBlock / table / embed 는 Excalidraw 에 대응 요소가 없어 스킵한다
// (래스터화 export 는 후속 작업 — skippedCount 로 집계).
// ============================================================================

const DEG_TO_RAD = Math.PI / 180;

export interface ExcalidrawExportResult {
  data: ExcalidrawData;
  exportedCount: number;
  /** 대응 요소가 없어 건너뛴 객체 수 */
  skippedCount: number;
}

function randInt(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** 모든 요소에 공통으로 필요한 Excalidraw 메타 필드 */
function elementMeta(): Partial<ExcalidrawElement> {
  return {
    seed: randInt(),
    version: 1,
    versionNonce: randInt(),
    updated: Date.now(),
    isDeleted: false,
    roughness: 0, // pig-ma 도형은 클린 스타일 — 손그림 흔들림 없음
  };
}

/** pig-ma MarkerStyle → Excalidraw arrowhead */
function toArrowhead(marker: MarkerStyle | undefined): ExcalidrawArrowhead {
  switch (marker) {
    case "arrow":
      return "arrow";
    case "filledArrow":
      return "triangle";
    case "circle":
      return "dot";
    case "diamond":
      return "diamond";
    case "none":
    default:
      return null;
  }
}

/** tiptapContent 트리에서 plain text 추출 (문단 사이 개행) */
export function extractPlainText(content: JSONContent | undefined): string {
  if (!content) return "";
  const lines: string[] = [];

  function walkBlock(node: JSONContent): void {
    if (node.type === "text") {
      // 최상위가 text 인 경우는 없지만 방어적으로 처리
      lines.push(node.text ?? "");
      return;
    }
    const inline = collectInline(node);
    if (node.type === "paragraph") {
      lines.push(inline);
      return;
    }
    for (const child of node.content ?? []) {
      walkBlock(child);
    }
  }

  function collectInline(node: JSONContent): string {
    let text = "";
    for (const child of node.content ?? []) {
      if (child.type === "text") text += child.text ?? "";
      else if (child.type === "mention")
        text += `@${(child.attrs?.label as string) ?? ""}`;
      else text += collectInline(child);
    }
    return text;
  }

  for (const child of content.content ?? []) {
    walkBlock(child);
  }
  return lines.join("\n");
}

/** 객체의 표시 텍스트 (tiptapContent 우선, text 폴백) */
function objectText(obj: CanvasObject): string {
  if (obj.tiptapContent) {
    const extracted = extractPlainText(obj.tiptapContent);
    if (extracted.trim().length > 0) return extracted;
  }
  return obj.text ?? "";
}

/** 컨테이너에 붙는 바운드 텍스트 요소 생성 */
function boundTextElement(
  container: ExcalidrawElement,
  text: string,
  obj: CanvasObject,
): ExcalidrawElement {
  const fontSize = obj.fontSize ?? 16;
  return {
    id: `${container.id}-text`,
    type: "text",
    x: container.x + 8,
    y: container.y + container.height / 2 - fontSize * 0.625,
    width: Math.max(container.width - 16, 10),
    height: fontSize * 1.25,
    angle: 0,
    text,
    fontSize,
    fontFamily: 2, // normal
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: obj.textColor ?? "#1e1e1e",
    opacity: 100,
    containerId: container.id,
    groupIds: [],
    ...elementMeta(),
  };
}

function toExcalidrawShapeType(
  obj: CanvasObject,
): "rectangle" | "ellipse" | "diamond" {
  switch (obj.shapeVariant) {
    case "circle":
    case "ellipse":
      return "ellipse";
    case "diamond":
    case "flowDecision":
      return "diamond";
    default:
      return "rectangle";
  }
}

/** 공통 좌표/스타일 필드 */
function baseElement(obj: CanvasObject): Partial<ExcalidrawElement> {
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width ?? 100,
    height: obj.height ?? 100,
    angle: (obj.rotation ?? 0) * DEG_TO_RAD,
    opacity: Math.round((obj.opacity ?? 1) * 100),
    strokeColor: obj.stroke ?? "#1e1e1e",
    strokeWidth: obj.strokeWidth ?? 1,
    strokeStyle: obj.lineStyle ?? "solid",
    fillStyle: "solid",
    locked: obj.locked ?? false,
    ...elementMeta(),
  };
}

/** data: URL 에서 mimeType 추출 */
function dataUrlMimeType(dataUrl: string): string {
  const match = /^data:([^;,]+)/.exec(dataUrl);
  return match?.[1] ?? "image/png";
}

export interface ConvertToExcalidrawOptions {
  /**
   * 대응 요소가 없는 타입(chart/codeBlock/table/embed)을 PNG 로 캡처한다.
   * data: URL 을 반환하면 image 요소로 export, null 이면 스킵.
   */
  rasterize?: (obj: CanvasObject) => string | null;
}

/**
 * pig-ma objects/groups 를 Excalidraw 데이터로 변환한다.
 */
export function convertToExcalidraw(
  objects: CanvasObject[],
  groups: GroupInfo[],
  options?: ConvertToExcalidrawOptions,
): ExcalidrawExportResult {
  const elements: ExcalidrawElement[] = [];
  const files: Record<string, ExcalidrawBinaryFile> = {};
  const elementById = new Map<string, ExcalidrawElement>();
  let skippedCount = 0;

  // customBounds 그룹 → frame, 그 외 그룹 → groupIds 로 표현
  const frameGroupIds = new Set<string>();
  for (const group of groups) {
    if (!group.customBounds) continue;
    const frame: ExcalidrawElement = {
      id: group.id,
      type: "frame",
      x: group.customBounds.x,
      y: group.customBounds.y,
      width: group.customBounds.width,
      height: group.customBounds.height,
      angle: 0,
      name: group.name,
      opacity: 100,
      groupIds: [],
      ...elementMeta(),
    };
    elements.push(frame);
    elementById.set(group.id, frame);
    frameGroupIds.add(group.id);
  }

  /** 그룹 소속 → frameId 또는 groupIds */
  function membership(obj: CanvasObject): Partial<ExcalidrawElement> {
    if (!obj.groupId) return { groupIds: [] };
    if (frameGroupIds.has(obj.groupId)) {
      return { groupIds: [], frameId: obj.groupId };
    }
    return { groupIds: [obj.groupId] };
  }

  for (const obj of objects) {
    let el: ExcalidrawElement | null = null;
    let boundText: ExcalidrawElement | null = null;

    switch (obj.type) {
      case "shape": {
        const type = toExcalidrawShapeType(obj);
        el = {
          id: obj.id,
          type,
          ...baseElement(obj),
          backgroundColor:
            obj.fillMode === "transparent" || obj.fillMode === "nofill"
              ? "transparent"
              : (obj.fill ?? "transparent"),
          roundness:
            type === "rectangle" &&
            (obj.shapeVariant === "roundedRect" ||
              obj.shapeVariant === "flowTerminal")
              ? { type: 3 }
              : null,
        } as ExcalidrawElement;
        const text = objectText(obj);
        if (text) boundText = boundTextElement(el, text, obj);
        break;
      }

      case "stickyNote": {
        const bg = obj.backgroundColor ?? "#fef08a";
        el = {
          id: obj.id,
          type: "rectangle",
          ...baseElement(obj),
          strokeColor: bg,
          backgroundColor: bg,
          roundness: null,
        } as ExcalidrawElement;
        const text = objectText(obj);
        if (text) boundText = boundTextElement(el, text, obj);
        break;
      }

      case "textBox": {
        const fontSize = obj.fontSize ?? 16;
        el = {
          id: obj.id,
          type: "text",
          ...baseElement(obj),
          text: objectText(obj),
          fontSize,
          fontFamily: 2,
          textAlign: obj.textAlign ?? "left",
          strokeColor: obj.textColor ?? "#1e1e1e",
          backgroundColor: "transparent",
        } as ExcalidrawElement;
        break;
      }

      case "line": {
        const flat = obj.points ?? [];
        const pts: [number, number][] = [];
        for (let i = 0; i + 1 < flat.length; i += 2) {
          pts.push([flat[i]!, flat[i + 1]!]);
        }
        if (pts.length < 2) {
          skippedCount++;
          continue;
        }
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        el = {
          id: obj.id,
          type: "freedraw",
          ...baseElement(obj),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
          points: pts,
          backgroundColor: "transparent",
        } as ExcalidrawElement;
        break;
      }

      case "connector": {
        const endX = obj.endX ?? obj.x;
        const endY = obj.endY ?? obj.y;
        el = {
          id: obj.id,
          type: "arrow",
          ...baseElement(obj),
          x: obj.x,
          y: obj.y,
          width: Math.abs(endX - obj.x),
          height: Math.abs(endY - obj.y),
          angle: 0,
          points: [
            [0, 0],
            [endX - obj.x, endY - obj.y],
          ],
          startArrowhead: toArrowhead(obj.startMarker ?? "none"),
          endArrowhead: toArrowhead(obj.endMarker ?? "arrow"),
          elbowed: obj.pathStyle === "elbowed" || undefined,
          backgroundColor: "transparent",
        } as ExcalidrawElement;
        if (obj.label) {
          boundText = boundTextElement(el, obj.label, obj);
        }
        break;
      }

      case "image": {
        if (!obj.src?.startsWith("data:")) {
          // 외부 URL 이미지는 Excalidraw files 로 넣을 수 없음
          skippedCount++;
          continue;
        }
        const fileId = obj.id;
        files[fileId] = {
          id: fileId,
          mimeType: dataUrlMimeType(obj.src),
          dataURL: obj.src,
        };
        el = {
          id: obj.id,
          type: "image",
          ...baseElement(obj),
          fileId,
          status: "saved",
          backgroundColor: "transparent",
        } as ExcalidrawElement;
        break;
      }

      case "chart":
      case "codeBlock":
      case "table":
      case "embed": {
        // 대응 요소 없음 — 래스터라이저가 있으면 PNG image 로 export
        const dataUrl = options?.rasterize?.(obj) ?? null;
        if (!dataUrl?.startsWith("data:")) {
          skippedCount++;
          continue;
        }
        const fileId = obj.id;
        files[fileId] = {
          id: fileId,
          mimeType: dataUrlMimeType(dataUrl),
          dataURL: dataUrl,
        };
        el = {
          id: obj.id,
          type: "image",
          ...baseElement(obj),
          fileId,
          status: "saved",
          backgroundColor: "transparent",
        } as ExcalidrawElement;
        break;
      }

      default:
        // connectorLabel 등 — 대응 요소 없음
        skippedCount++;
        continue;
    }

    Object.assign(el, membership(obj));
    elements.push(el);
    elementById.set(obj.id, el);
    if (boundText) {
      elements.push(boundText);
      el.boundElements = [
        ...(el.boundElements ?? []),
        { id: boundText.id, type: "text" },
      ];
    }
  }

  // 커넥터 바인딩 복원 (양쪽 요소가 모두 export 된 경우만, __group: 가상 ID 제외)
  for (const obj of objects) {
    if (obj.type !== "connector") continue;
    const arrow = elementById.get(obj.id);
    if (!arrow) continue;

    for (const [key, side] of [
      ["sourceId", "startBinding"],
      ["targetId", "endBinding"],
    ] as const) {
      const boundId = obj[key];
      if (!boundId || boundId.startsWith("__group:")) continue;
      const bound = elementById.get(boundId);
      if (!bound) continue;
      arrow[side] = { elementId: boundId, focus: 0, gap: 4 };
      bound.boundElements = [
        ...(bound.boundElements ?? []),
        { id: obj.id, type: "arrow" },
      ];
    }
  }

  const exportedCount = objects.length - skippedCount;
  return {
    data: {
      type: "excalidraw",
      version: 2,
      source: "pig-ma",
      elements,
      appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
      files,
    },
    exportedCount,
    skippedCount,
  };
}

// ============================================================================
// Store 연동 / 다운로드
// ============================================================================

/**
 * Konva 스테이지에서 객체 노드를 PNG data URL 로 캡처한다.
 * 뷰포트 가상화로 노드가 렌더링되지 않은 경우 null (스킵으로 집계됨).
 */
function rasterizeWithKonva(obj: CanvasObject): string | null {
  const stage = Konva.stages[0];
  if (!stage) return null;
  const node = stage.findOne(`#${obj.id}`);
  if (!node) return null;
  try {
    return node.toDataURL({ pixelRatio: 2 });
  } catch {
    // 외부 이미지의 canvas taint 등 — 캡처 실패 시 스킵
    return null;
  }
}

/** 현재 캔버스(현재 페이지)를 Excalidraw 데이터로 내보낸다 */
export function exportCanvasToExcalidraw(): ExcalidrawExportResult {
  const { objects, groups } = useCanvasStore.getState();
  return convertToExcalidraw(objects, groups, {
    rasterize: rasterizeWithKonva,
  });
}

/** ExcalidrawData 를 .excalidraw 파일로 다운로드한다 */
export function downloadExcalidrawFile(
  data: ExcalidrawData,
  filename?: string,
): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? "canvas.excalidraw";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
