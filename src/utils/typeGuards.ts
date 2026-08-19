import type { CanvasObject, ObjectType } from "@/types";

// ============================================================================
// Type Predicate Functions (TypeScript narrowing support)
// ============================================================================

/**
 * Shape 타입 체크
 */
export function isShape(
  obj: CanvasObject,
): obj is CanvasObject & { type: "shape" } {
  return obj.type === "shape";
}

/**
 * Rectangle variant 체크 (shape + shapeVariant: "rectangle")
 */
export function isRectangle(obj: CanvasObject): boolean {
  return obj.type === "shape" && obj.shapeVariant === "rectangle";
}

/**
 * Connector 타입 체크
 */
export function isConnector(
  obj: CanvasObject,
): obj is CanvasObject & { type: "connector" } {
  return obj.type === "connector";
}

/**
 * ConnectorLabel 타입 체크
 * @deprecated connector.props.label로 통합 예정
 */
export function isConnectorLabel(
  obj: CanvasObject,
): obj is CanvasObject & { type: "connectorLabel" } {
  return obj.type === "connectorLabel";
}

/**
 * TextBox 타입 체크
 */
export function isTextBox(
  obj: CanvasObject,
): obj is CanvasObject & { type: "textBox" } {
  return obj.type === "textBox";
}

/**
 * StickyNote 타입 체크
 */
export function isStickyNote(
  obj: CanvasObject,
): obj is CanvasObject & { type: "stickyNote" } {
  return obj.type === "stickyNote";
}

/**
 * Line 타입 체크 (펜 드로잉)
 */
export function isLine(
  obj: CanvasObject,
): obj is CanvasObject & { type: "line" } {
  return obj.type === "line";
}

/**
 * Image 타입 체크
 */
export function isImage(
  obj: CanvasObject,
): obj is CanvasObject & { type: "image" } {
  return obj.type === "image";
}

/**
 * Table 타입 체크
 */
export function isTable(
  obj: CanvasObject,
): obj is CanvasObject & { type: "table" } {
  return obj.type === "table";
}

/**
 * CodeBlock 타입 체크
 */
export function isCodeBlock(
  obj: CanvasObject,
): obj is CanvasObject & { type: "codeBlock" } {
  return obj.type === "codeBlock";
}

// ============================================================================
// Feature-based Type Guards
// ============================================================================

/**
 * 텍스트 콘텐츠를 가진 객체인지 체크
 */
export function hasTextContent(obj: CanvasObject): boolean {
  return obj.tiptapContent !== undefined || obj.text !== undefined;
}

/**
 * 크기(width, height)를 가진 객체인지 체크
 */
export function hasBounds(
  obj: CanvasObject,
): obj is CanvasObject & { width: number; height: number } {
  return obj.width !== undefined && obj.height !== undefined;
}

/**
 * 텍스트 편집 가능한 타입인지 체크
 */
export function isTextEditable(obj: CanvasObject): boolean {
  return (
    obj.type === "stickyNote" ||
    obj.type === "textBox" ||
    obj.type === "shape" ||
    obj.type === "connectorLabel"
  );
}

/**
 * 선택 가능한 타입인지 체크
 */
export function isSelectable(obj: CanvasObject): boolean {
  // line은 펜 드로잉이라 선택 불가
  return obj.type !== "line";
}

// ============================================================================
// Type-based Helpers
// ============================================================================

/**
 * 타입에 따른 기본 크기 반환
 */
export function getDefaultSize(type: ObjectType): {
  width: number;
  height: number;
} {
  switch (type) {
    case "stickyNote":
      return { width: 200, height: 200 };
    case "textBox":
      return { width: 200, height: 40 };
    case "table":
      return { width: 240, height: 80 };
    case "shape":
      return { width: 100, height: 80 };
    case "image":
      return { width: 200, height: 200 };
    default:
      return { width: 100, height: 100 };
  }
}

/**
 * 객체의 실제 바운딩 박스 반환
 */
export function getObjectBounds(obj: CanvasObject) {
  const defaultSize = getDefaultSize(obj.type);
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width ?? defaultSize.width,
    height: obj.height ?? defaultSize.height,
  };
}
