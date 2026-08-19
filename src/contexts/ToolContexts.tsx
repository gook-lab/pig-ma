/**
 * Tool Contexts - Progressive Disclosure Pattern
 *
 * 도구별 컨텍스트를 분리하여 필요한 도구의 상태만 구독합니다.
 * 이를 통해 도구 전환 시 불필요한 리렌더링을 방지합니다.
 *
 * @example
 * ```tsx
 * // 펜 도구가 활성화될 때만 PencilContext 사용
 * const { strokeColor, setStrokeColor } = usePencilContext();
 *
 * // 도형 도구가 활성화될 때만 ShapeContext 사용
 * const { fillColor, setFillColor } = useShapeContext();
 * ```
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { PathStyle, PenType } from "@/types";

// ============================================================================
// Pencil Context
// ============================================================================

export interface PencilContextValue {
  penType: PenType;
  strokeColor: string;
  strokeWidth: number;
  setPenType: (type: PenType) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  updateSettings: (settings: Partial<PencilSettings>) => void;
}

export interface PencilSettings {
  penType: PenType;
  strokeColor: string;
  strokeWidth: number;
}

const PencilContext = createContext<PencilContextValue | null>(null);

export function PencilProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings?: Partial<PencilSettings>;
}) {
  const [settings, setSettings] = useState<PencilSettings>({
    penType: initialSettings?.penType ?? "pen",
    strokeColor: initialSettings?.strokeColor ?? "#000000",
    strokeWidth: initialSettings?.strokeWidth ?? 2,
  });

  const setPenType = useCallback((type: PenType) => {
    setSettings((prev) => ({ ...prev, penType: type }));
  }, []);

  const setStrokeColor = useCallback((color: string) => {
    setSettings((prev) => ({ ...prev, strokeColor: color }));
  }, []);

  const setStrokeWidth = useCallback((width: number) => {
    setSettings((prev) => ({ ...prev, strokeWidth: width }));
  }, []);

  const updateSettings = useCallback((partial: Partial<PencilSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      ...settings,
      setPenType,
      setStrokeColor,
      setStrokeWidth,
      updateSettings,
    }),
    [settings, setPenType, setStrokeColor, setStrokeWidth, updateSettings],
  );

  return (
    <PencilContext.Provider value={value}>{children}</PencilContext.Provider>
  );
}

export function usePencilContext(): PencilContextValue {
  const context = useContext(PencilContext);
  if (!context) {
    throw new Error("usePencilContext must be used within a PencilProvider");
  }
  return context;
}

export function usePencilContextSafe(): PencilContextValue | null {
  return useContext(PencilContext);
}

// ============================================================================
// Shape Context
// ============================================================================

export interface ShapeContextValue {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  updateSettings: (settings: Partial<ShapeSettings>) => void;
}

export interface ShapeSettings {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

const ShapeContext = createContext<ShapeContextValue | null>(null);

export function ShapeProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings?: Partial<ShapeSettings>;
}) {
  const [settings, setSettings] = useState<ShapeSettings>({
    fillColor: initialSettings?.fillColor ?? "#ffffff",
    strokeColor: initialSettings?.strokeColor ?? "#374151",
    strokeWidth: initialSettings?.strokeWidth ?? 2,
  });

  const setFillColor = useCallback((color: string) => {
    setSettings((prev) => ({ ...prev, fillColor: color }));
  }, []);

  const setStrokeColor = useCallback((color: string) => {
    setSettings((prev) => ({ ...prev, strokeColor: color }));
  }, []);

  const setStrokeWidth = useCallback((width: number) => {
    setSettings((prev) => ({ ...prev, strokeWidth: width }));
  }, []);

  const updateSettings = useCallback((partial: Partial<ShapeSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      ...settings,
      setFillColor,
      setStrokeColor,
      setStrokeWidth,
      updateSettings,
    }),
    [settings, setFillColor, setStrokeColor, setStrokeWidth, updateSettings],
  );

  return (
    <ShapeContext.Provider value={value}>{children}</ShapeContext.Provider>
  );
}

export function useShapeContext(): ShapeContextValue {
  const context = useContext(ShapeContext);
  if (!context) {
    throw new Error("useShapeContext must be used within a ShapeProvider");
  }
  return context;
}

export function useShapeContextSafe(): ShapeContextValue | null {
  return useContext(ShapeContext);
}

// ============================================================================
// Connector Context
// ============================================================================

export interface ConnectorContextValue {
  pathStyle: PathStyle;
  strokeColor: string;
  strokeWidth: number;
  setPathStyle: (style: PathStyle) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  updateSettings: (settings: Partial<ConnectorSettings>) => void;
}

export interface ConnectorSettings {
  pathStyle: PathStyle;
  strokeColor: string;
  strokeWidth: number;
}

const ConnectorContext = createContext<ConnectorContextValue | null>(null);

export function ConnectorProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings?: Partial<ConnectorSettings>;
}) {
  const [settings, setSettings] = useState<ConnectorSettings>({
    pathStyle: initialSettings?.pathStyle ?? "straight",
    strokeColor: initialSettings?.strokeColor ?? "#374151",
    strokeWidth: initialSettings?.strokeWidth ?? 2,
  });

  const setPathStyle = useCallback((style: PathStyle) => {
    setSettings((prev) => ({ ...prev, pathStyle: style }));
  }, []);

  const setStrokeColor = useCallback((color: string) => {
    setSettings((prev) => ({ ...prev, strokeColor: color }));
  }, []);

  const setStrokeWidth = useCallback((width: number) => {
    setSettings((prev) => ({ ...prev, strokeWidth: width }));
  }, []);

  const updateSettings = useCallback((partial: Partial<ConnectorSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      ...settings,
      setPathStyle,
      setStrokeColor,
      setStrokeWidth,
      updateSettings,
    }),
    [settings, setPathStyle, setStrokeColor, setStrokeWidth, updateSettings],
  );

  return (
    <ConnectorContext.Provider value={value}>
      {children}
    </ConnectorContext.Provider>
  );
}

export function useConnectorContext(): ConnectorContextValue {
  const context = useContext(ConnectorContext);
  if (!context) {
    throw new Error(
      "useConnectorContext must be used within a ConnectorProvider",
    );
  }
  return context;
}

export function useConnectorContextSafe(): ConnectorContextValue | null {
  return useContext(ConnectorContext);
}

// ============================================================================
// StickyNote Context
// ============================================================================

export interface StickyNoteContextValue {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
}

const StickyNoteContext = createContext<StickyNoteContextValue | null>(null);

export function StickyNoteProvider({
  children,
  initialColor,
}: {
  children: ReactNode;
  initialColor?: string;
}) {
  const [backgroundColor, setBackgroundColorState] = useState(
    initialColor ?? "#fef08a",
  );

  const setBackgroundColor = useCallback((color: string) => {
    setBackgroundColorState(color);
  }, []);

  const value = useMemo(
    () => ({
      backgroundColor,
      setBackgroundColor,
    }),
    [backgroundColor, setBackgroundColor],
  );

  return (
    <StickyNoteContext.Provider value={value}>
      {children}
    </StickyNoteContext.Provider>
  );
}

export function useStickyNoteContext(): StickyNoteContextValue {
  const context = useContext(StickyNoteContext);
  if (!context) {
    throw new Error(
      "useStickyNoteContext must be used within a StickyNoteProvider",
    );
  }
  return context;
}

export function useStickyNoteContextSafe(): StickyNoteContextValue | null {
  return useContext(StickyNoteContext);
}

// ============================================================================
// Combined Tool Provider (Convenience wrapper)
// ============================================================================

export interface ToolProviderProps {
  children: ReactNode;
  pencilSettings?: Partial<PencilSettings>;
  shapeSettings?: Partial<ShapeSettings>;
  connectorSettings?: Partial<ConnectorSettings>;
  stickyNoteColor?: string;
}

/**
 * 모든 도구 컨텍스트를 한 번에 제공하는 래퍼
 * 개별 Provider를 사용하면 더 세밀한 제어가 가능합니다.
 */
export function ToolProvider({
  children,
  pencilSettings,
  shapeSettings,
  connectorSettings,
  stickyNoteColor,
}: ToolProviderProps) {
  return (
    <PencilProvider initialSettings={pencilSettings}>
      <ShapeProvider initialSettings={shapeSettings}>
        <ConnectorProvider initialSettings={connectorSettings}>
          <StickyNoteProvider initialColor={stickyNoteColor}>
            {children}
          </StickyNoteProvider>
        </ConnectorProvider>
      </ShapeProvider>
    </PencilProvider>
  );
}
