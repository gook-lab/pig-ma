/**
 * Tool Contexts - Progressive Disclosure Pattern
 *
 * 도구별 컨텍스트를 분리하여 필요한 도구의 상태만 구독합니다.
 */

export {
  // Pencil
  PencilProvider,
  usePencilContext,
  usePencilContextSafe,
  type PencilContextValue,
  type PencilSettings,
  // Shape
  ShapeProvider,
  useShapeContext,
  useShapeContextSafe,
  type ShapeContextValue,
  type ShapeSettings,
  // Connector
  ConnectorProvider,
  useConnectorContext,
  useConnectorContextSafe,
  type ConnectorContextValue,
  type ConnectorSettings,
  // StickyNote
  StickyNoteProvider,
  useStickyNoteContext,
  useStickyNoteContextSafe,
  type StickyNoteContextValue,
  // Combined
  ToolProvider,
  type ToolProviderProps,
} from "./ToolContexts";
