import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { Toaster } from "react-hot-toast";
import { Agentation } from "agentation";
import { Canvas } from "@/components/Canvas";
import { Toolbar } from "@/components/Toolbar";
import { PencilPopover } from "@/components/PencilPopover";
import { StickyNoteEditor } from "@/components/StickyNoteEditor";
import { ConnectorEditor } from "@/components/ConnectorEditor";
import { ConnectorLabelEditor } from "@/components/ConnectorLabelEditor";
import { ShapeEditor } from "@/components/ShapeEditor";
import { ChartEditor } from "@/components/ChartEditor";
import { CodeBlockEditor } from "@/components/CodeBlockEditor";
import { EmbedEditor } from "@/components/EmbedEditor";
import { LineEditor } from "@/components/LineEditor";
import { TextBoxEditor } from "@/components/TextBoxEditor";
import { EmptyCanvasGuide } from "@/components/EmptyCanvasGuide";
import { CanvasScrollbars } from "@/components/CanvasScrollbars";
import { Minimap } from "@/components/Minimap";
import { FloatingUtilityBar } from "@/components/FloatingUtilityBar";
import { LockedObjectsPanel } from "@/components/LockedObjectsPanel";
import { UnlockConfirmDialog } from "@/components/UnlockConfirmDialog";
import { LockOverlay } from "@/components/LockOverlay";
import { CursorChat } from "@/components/CursorChat";
import { CaptionInput } from "@/components/captions/CaptionInput";
import { CaptionPopup } from "@/components/captions/CaptionPopup";
import { CaptionPanel } from "@/components/captions/CaptionPanel";
import { Header } from "@/components/Header";
import { GroupEditor } from "@/components/GroupEditor";
import { MultiSelectEditor } from "@/components/MultiSelectEditor";
import { MultiSelectIndicator } from "@/components/MultiSelectIndicator";
import { MentionPanel } from "@/components/MentionPanel";
import { AIPanel } from "@/components/AIPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useImageDrop } from "@/hooks/useImageDrop";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useCanvasStore } from "@/store";

const isAIEnabled = import.meta.env.VITE_ENABLE_AI === "true";
const TemplatesPanel = lazy(() =>
  import("@/components/TemplatesPanel").then((module) => ({
    default: module.TemplatesPanel,
  })),
);
const ShapesPanel = lazy(() =>
  import("@/components/ShapesPanel").then((module) => ({
    default: module.ShapesPanel,
  })),
);

function PanelLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="fixed top-1/2 right-4 z-40 -translate-y-1/2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg"
    >
      {label} 불러오는 중…
    </div>
  );
}

function App() {
  useKeyboardShortcuts();
  useAutoSave();
  const { handleDrop } = useImageDrop();

  // Get store state for CanvasScrollbars and Minimap
  const objects = useCanvasStore((s) => s.objects);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  const hideUI = useCanvasStore((s) => s.hideUI);
  const showTemplatesPanel = useCanvasStore((s) => s.showTemplatesPanel);
  const showShapesPanel = useCanvasStore((s) => s.showShapesPanel);

  // Track stage size for scrollbar calculation
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Cursor chat state
  const [cursorChatPosition, setCursorChatPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });

  // Caption input state
  const [captionInputPosition, setCaptionInputPosition] = useState<{
    screen: { x: number; y: number };
    canvas: { x: number; y: number };
  } | null>(null);
  const isLocked = useCanvasStore((s) => s.isLocked);
  const [showMentionPanel, setShowMentionPanel] = useState(false);

  // Listen for mention panel toggle event
  useEffect(() => {
    const handler = () => setShowMentionPanel((prev) => !prev);
    window.addEventListener("toggle-mention-panel", handler);
    return () => window.removeEventListener("toggle-mention-panel", handler);
  }, []);

  // Caption popup state
  const captions = useCanvasStore((s) => s.captions);
  const activeCaptionId = useCanvasStore((s) => s.activeCaptionId);
  const setActiveCaptionId = useCanvasStore((s) => s.setActiveCaptionId);

  // Get active caption and its screen position
  const activeCaption = captions.find((c) => c.id === activeCaptionId);
  const activeCaptionScreenPosition = activeCaption
    ? {
        x: activeCaption.x * viewport.zoom + viewport.x + 30,
        y: activeCaption.y * viewport.zoom + viewport.y,
      }
    : null;
  const activeCaptionIndex = activeCaption
    ? captions.findIndex((c) => c.id === activeCaptionId) + 1
    : 0;

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Handle `/` key for cursor chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs or editing text
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (editingTextId) return;
      if (isLocked) return; // Ignore when locked

      // Support both e.key and e.code for non-English layouts
      // Skip if Cmd+/ or Ctrl+/ (toggle UI shortcut)
      const isSlashKey = e.key === "/" || e.code === "Slash";
      if (isSlashKey && !e.metaKey && !e.ctrlKey) {
        if (cursorChatPosition) return; // Already showing chat
        e.preventDefault();
        // Show chat bubble at current mouse position (offset a bit to the right of cursor)
        setCursorChatPosition({
          x: mousePositionRef.current.x + 20,
          y: mousePositionRef.current.y - 15,
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingTextId, cursorChatPosition, isLocked]);

  // Handle caption input from C key (via custom event from useKeyboardShortcuts)
  useEffect(() => {
    const handleOpenCaption = () => {
      if (captionInputPosition) return; // Already showing caption input
      // Convert screen position to canvas position
      const screenX = mousePositionRef.current.x;
      const screenY = mousePositionRef.current.y;
      const canvasX = (screenX - viewport.x) / viewport.zoom;
      const canvasY = (screenY - viewport.y) / viewport.zoom;
      setCaptionInputPosition({
        screen: { x: screenX + 20, y: screenY - 15 },
        canvas: { x: canvasX, y: canvasY },
      });
    };
    window.addEventListener("open-caption-input", handleOpenCaption);
    return () =>
      window.removeEventListener("open-caption-input", handleOpenCaption);
  }, [captionInputPosition, viewport]);

  // Update stage size on window resize
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle viewport change from scrollbars
  const handleScrollbarViewportChange = useCallback(
    (x: number, y: number) => {
      setViewport({ x, y });
    },
    [setViewport],
  );

  // Setup drag and drop
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDrop]);

  return (
    <div className="bg-canvas h-screen w-screen overflow-hidden">
      <Canvas />
      <Toolbar />
      <MultiSelectIndicator />
      <Header />
      <EmptyCanvasGuide />
      <PencilPopover />
      <StickyNoteEditor />
      <ConnectorEditor />
      <ConnectorLabelEditor />
      <ShapeEditor />
      <ChartEditor />
      <CodeBlockEditor />
      <EmbedEditor />
      <LineEditor />
      <TextBoxEditor />
      <GroupEditor />
      <MultiSelectEditor />
      {showShapesPanel && (
        <Suspense fallback={<PanelLoading label="도형" />}>
          <ShapesPanel />
        </Suspense>
      )}
      {showTemplatesPanel && (
        <Suspense fallback={<PanelLoading label="템플릿" />}>
          <TemplatesPanel />
        </Suspense>
      )}
      <CanvasScrollbars
        objects={objects}
        viewport={viewport}
        stageSize={stageSize}
        onViewportChange={handleScrollbarViewportChange}
      />
      <Minimap
        objects={objects}
        viewport={viewport}
        stageSize={stageSize}
        onViewportChange={handleScrollbarViewportChange}
        onZoomChange={(zoom) => setViewport({ zoom })}
        hideUI={hideUI}
      />
      <FloatingUtilityBar />
      <LockedObjectsPanel />
      <CaptionPanel />
      {showMentionPanel && (
        <MentionPanel onClose={() => setShowMentionPanel(false)} />
      )}
      {isAIEnabled && <AIPanel />}
      <UnlockConfirmDialog />
      <LockOverlay />
      {cursorChatPosition && (
        <CursorChat
          initialPosition={cursorChatPosition}
          onClose={() => setCursorChatPosition(null)}
        />
      )}
      {captionInputPosition && (
        <CaptionInput
          position={captionInputPosition.screen}
          canvasPosition={captionInputPosition.canvas}
          onClose={() => setCaptionInputPosition(null)}
        />
      )}
      {activeCaption && activeCaptionScreenPosition && (
        <CaptionPopup
          caption={activeCaption}
          index={activeCaptionIndex}
          position={activeCaptionScreenPosition}
          onClose={() => setActiveCaptionId(null)}
        />
      )}
      <Toaster
        toastOptions={{
          style: {
            background: "#1f2937",
            color: "#f9fafb",
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "14px",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#f9fafb",
            },
          },
        }}
      />
      {import.meta.env.DEV && <Agentation endpoint="http://localhost:4747" />}
    </div>
  );
}

export default App;
