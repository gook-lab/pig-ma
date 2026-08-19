/**
 * Active Tool Context Hook - Progressive Disclosure Pattern
 *
 * 현재 활성 도구에 따라 적절한 컨텍스트를 반환합니다.
 * 도구가 비활성화되면 null을 반환하여 불필요한 구독을 방지합니다.
 *
 * @example
 * ```tsx
 * // 현재 도구가 pencil일 때만 설정 반환
 * const pencilSettings = useActiveToolContext('pencil');
 *
 * // 현재 도구 타입과 설정을 함께 반환
 * const { tool, settings } = useActiveToolWithSettings();
 * ```
 */

import { useMemo } from "react";
import { useCanvasStore } from "@/store";
import type { Tool } from "@/types";
import {
  usePencilContextSafe,
  useShapeContextSafe,
  useConnectorContextSafe,
  useStickyNoteContextSafe,
  type PencilContextValue,
  type ShapeContextValue,
  type ConnectorContextValue,
  type StickyNoteContextValue,
} from "@/contexts";

type ToolContextMap = {
  pencil: PencilContextValue | null;
  rectangle: ShapeContextValue | null;
  shape: ShapeContextValue | null;
  connector: ShapeContextValue | null;
  stickyNote: StickyNoteContextValue | null;
  select: null;
  hand: null;
  image: null;
  eraser: null;
  textBox: null;
};

/**
 * 특정 도구의 컨텍스트를 반환합니다.
 * 해당 도구가 활성화되어 있지 않으면 null을 반환합니다.
 */
export function useActiveToolContext<T extends keyof ToolContextMap>(
  targetTool: T,
): ToolContextMap[T] {
  const currentTool = useCanvasStore((s) => s.tool);

  // Context hooks (Safe versions that return null if not provided)
  const pencilContext = usePencilContextSafe();
  const shapeContext = useShapeContextSafe();
  const connectorContext = useConnectorContextSafe();
  const stickyNoteContext = useStickyNoteContextSafe();

  return useMemo(() => {
    // 현재 도구가 대상 도구와 일치하지 않으면 null 반환
    if (currentTool !== targetTool) {
      return null as ToolContextMap[T];
    }

    // 도구에 따라 적절한 컨텍스트 반환
    switch (targetTool) {
      case "pencil":
        return pencilContext as ToolContextMap[T];
      case "rectangle":
      case "shape":
        return shapeContext as ToolContextMap[T];
      case "connector":
        return connectorContext as ToolContextMap[T];
      case "stickyNote":
        return stickyNoteContext as ToolContextMap[T];
      default:
        return null as ToolContextMap[T];
    }
  }, [
    currentTool,
    targetTool,
    pencilContext,
    shapeContext,
    connectorContext,
    stickyNoteContext,
  ]);
}

/**
 * 현재 활성 도구와 해당 도구의 설정을 함께 반환합니다.
 */
export function useActiveToolWithSettings(): {
  tool: Tool;
  pencilSettings: PencilContextValue | null;
  shapeSettings: ShapeContextValue | null;
  connectorSettings: ConnectorContextValue | null;
  stickyNoteSettings: StickyNoteContextValue | null;
  isDrawingTool: boolean;
  isShapeTool: boolean;
} {
  const tool = useCanvasStore((s) => s.tool);

  const pencilContext = usePencilContextSafe();
  const shapeContext = useShapeContextSafe();
  const connectorContext = useConnectorContextSafe();
  const stickyNoteContext = useStickyNoteContextSafe();

  return useMemo(() => {
    const isDrawingTool = tool === "pencil";
    const isShapeTool = tool === "rectangle" || tool === "shape";

    return {
      tool,
      pencilSettings: isDrawingTool ? pencilContext : null,
      shapeSettings: isShapeTool ? shapeContext : null,
      connectorSettings: tool === "connector" ? connectorContext : null,
      stickyNoteSettings: tool === "stickyNote" ? stickyNoteContext : null,
      isDrawingTool,
      isShapeTool,
    };
  }, [tool, pencilContext, shapeContext, connectorContext, stickyNoteContext]);
}

/**
 * 도구별 컨텍스트 활성화 상태를 반환합니다.
 * UI에서 어떤 옵션을 표시할지 결정하는 데 유용합니다.
 */
export function useToolContextAvailability(): {
  hasPencilContext: boolean;
  hasShapeContext: boolean;
  hasConnectorContext: boolean;
  hasStickyNoteContext: boolean;
} {
  const pencilContext = usePencilContextSafe();
  const shapeContext = useShapeContextSafe();
  const connectorContext = useConnectorContextSafe();
  const stickyNoteContext = useStickyNoteContextSafe();

  return useMemo(
    () => ({
      hasPencilContext: pencilContext !== null,
      hasShapeContext: shapeContext !== null,
      hasConnectorContext: connectorContext !== null,
      hasStickyNoteContext: stickyNoteContext !== null,
    }),
    [pencilContext, shapeContext, connectorContext, stickyNoteContext],
  );
}
