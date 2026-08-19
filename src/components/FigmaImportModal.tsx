import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Figma,
  AlertCircle,
  HelpCircle,
  Loader2,
  CheckCircle2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Z_MODAL_BACKDROP, Z_MODAL_CONTENT } from "@/constants/zIndex";
import {
  parseFigmaFileUrl,
  fetchFile,
  fetchImageUrls,
  renderNodes,
} from "@/figma/client";
import { importFigmaDocument } from "@/figma/mapper";
import {
  FigmaAuthError,
  FigmaNotFoundError,
  FigmaRateLimitError,
} from "@/figma/types";
import { useCanvasStore } from "@/store";
import type { CanvasObject, GroupInfo } from "@/types";
import type { PigmaShape } from "@/figma/types";

interface FigmaImportModalProps {
  onClose: () => void;
}

type ImportState =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | { status: "success"; count: number }
  | { status: "error"; message: string };

/**
 * Convert Figma imageTransform (2x3 affine matrix) to Konva crop params.
 * imageTransform = [[scaleX, 0, translateX], [0, scaleY, translateY]]
 * translateX/Y are normalized (0-1) offsets into the original image.
 * scaleX/Y represent how much of the image is visible (1 = full, 0.5 = half).
 */
/** Convert PigmaShape to CanvasObject for store insertion */
function pigmaShapeToCanvasObject(shape: PigmaShape): CanvasObject {
  return {
    id: shape.id,
    type: shape.type === "shape" ? "shape" : shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    rotation: shape.rotation ?? 0,
    opacity: shape.opacity ?? 1,
    fill: shape.fill,
    fillMode: shape.fillMode,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    text: shape.text,
    tiptapContent: shape.tiptapContent,
    fontSize: shape.fontSize,
    fontFamily: shape.fontFamily as CanvasObject["fontFamily"],
    textAlign: shape.textAlign,
    textColor: shape.textColor,
    fontWeight: shape.fontWeight,
    shapeVariant: shape.shapeVariant,
    backgroundColor: shape.backgroundColor,
    // Line/drawing specific
    points: shape.points,
    penType: shape.penType as CanvasObject["penType"],
    // Image specific
    src: shape.src,
    // Connector specific
    endX: shape.endX,
    endY: shape.endY,
    startMarker: shape.startMarker as CanvasObject["startMarker"],
    endMarker: shape.endMarker as CanvasObject["endMarker"],
    sourceId: shape.sourceId,
    targetId: shape.targetId,
    pathStyle: shape.pathStyle as CanvasObject["pathStyle"],
  };
}

export function FigmaImportModal({ onClose }: FigmaImportModalProps) {
  const [fileUrl, setFileUrl] = useState("");
  const [token, setToken] = useState("");
  const [importState, setImportState] = useState<ImportState>({
    status: "idle",
  });
  const [showHelp, setShowHelp] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const importingRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => urlInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const fileKey = fileUrl.trim() ? parseFigmaFileUrl(fileUrl) : null;

  const handleImport = useCallback(async () => {
    // Prevent double execution
    if (importingRef.current) return;
    importingRef.current = true;

    if (!fileKey) {
      setImportState({
        status: "error",
        message: "Please enter a valid Figma file URL",
      });
      importingRef.current = false;
      return;
    }
    if (!token.trim()) {
      setImportState({
        status: "error",
        message: "Please enter your Figma access token",
      });
      importingRef.current = false;
      return;
    }

    setImportState({ status: "loading", message: "Fetching Figma file..." });

    try {
      const file = await fetchFile(fileKey, token.trim());
      setImportState({ status: "loading", message: "Extracting shapes..." });

      const { shapes, groups } = importFigmaDocument(file.document);

      // Resolve image refs to URLs
      const imageShapes = shapes.filter(
        (s) => s.type === "image" && s.imageRef,
      );
      if (imageShapes.length > 0) {
        setImportState({ status: "loading", message: "Loading images..." });

        // Split into regular image refs and node render requests
        const regularRefs = imageShapes.filter(
          (s) => s.imageRef && !s.imageRef.startsWith("node:"),
        );
        const nodeRefs = imageShapes.filter((s) =>
          s.imageRef?.startsWith("node:"),
        );

        // Fetch regular image URLs
        if (regularRefs.length > 0) {
          const imageUrls = await fetchImageUrls(fileKey, token.trim());
          for (const shape of regularRefs) {
            if (shape.imageRef && imageUrls[shape.imageRef]) {
              shape.src = imageUrls[shape.imageRef];
            }
          }
        }

        // Render vector nodes as PNG
        if (nodeRefs.length > 0) {
          const nodeIds = nodeRefs.map((s) => s.imageRef!.replace("node:", ""));
          const rendered = await renderNodes(fileKey, nodeIds, token.trim());
          for (const shape of nodeRefs) {
            const nodeId = shape.imageRef!.replace("node:", "");
            if (rendered[nodeId]) {
              shape.src = rendered[nodeId];
            }
          }
        }
      }

      // Filter out images that couldn't be resolved
      const validShapes = shapes.filter((s) => s.type !== "image" || s.src);

      if (validShapes.length === 0) {
        setImportState({
          status: "error",
          message: "No importable shapes found in this file",
        });
        importingRef.current = false;
        return;
      }

      // Offset shapes relative to current viewport center
      const { viewport } = useCanvasStore.getState();
      const centerX = -viewport.x + window.innerWidth / 2 / viewport.zoom;
      const centerY = -viewport.y + window.innerHeight / 2 / viewport.zoom;

      // Scale factor: reduce by 25% to fit pig-ma canvas better
      const IMPORT_SCALE = 0.75;

      // Apply scale to all shapes first
      for (const shape of validShapes) {
        shape.x *= IMPORT_SCALE;
        shape.y *= IMPORT_SCALE;
        shape.width *= IMPORT_SCALE;
        shape.height *= IMPORT_SCALE;
        if (shape.fontSize) shape.fontSize *= IMPORT_SCALE;
        if (shape.strokeWidth) shape.strokeWidth *= IMPORT_SCALE;
        if (shape.endX != null) shape.endX *= IMPORT_SCALE;
        if (shape.endY != null) shape.endY *= IMPORT_SCALE;
        if (shape.points) {
          shape.points = shape.points.map((v) => v * IMPORT_SCALE);
        }
      }

      // Scale group customBounds
      for (const group of groups) {
        if (group.customBounds) {
          group.customBounds.x *= IMPORT_SCALE;
          group.customBounds.y *= IMPORT_SCALE;
          group.customBounds.width *= IMPORT_SCALE;
          group.customBounds.height *= IMPORT_SCALE;
        }
      }

      // Center the imported shapes group on screen
      const minX = Math.min(...validShapes.map((s) => s.x));
      const minY = Math.min(...validShapes.map((s) => s.y));
      const maxX = Math.max(...validShapes.map((s) => s.x + s.width));
      const maxY = Math.max(...validShapes.map((s) => s.y + s.height));
      const groupCenterX = (minX + maxX) / 2;
      const groupCenterY = (minY + maxY) / 2;
      const offsetX = centerX - groupCenterX;
      const offsetY = centerY - groupCenterY;

      // Build group membership lookup
      const shapeToGroup = new Map<string, string>();
      for (const group of groups) {
        for (const memberId of group.memberIds) {
          shapeToGroup.set(memberId, group.id);
        }
      }

      for (const shape of validShapes) {
        const groupId = shapeToGroup.get(shape.id);
        const obj = pigmaShapeToCanvasObject({
          ...shape,
          x: shape.x + offsetX,
          y: shape.y + offsetY,
          endX: shape.endX != null ? shape.endX + offsetX : undefined,
          endY: shape.endY != null ? shape.endY + offsetY : undefined,
        });
        if (groupId) {
          obj.groupId = groupId;
        }
        useCanvasStore.getState().addObject(obj);
      }

      // Add groups (SECTION → pig-ma groups)
      if (groups.length > 0) {
        const store = useCanvasStore.getState();
        const existingGroups = store.groups;
        const newGroups: GroupInfo[] = groups
          .filter((g) => g.memberIds.length >= 1 || g.customBounds) // sections with bounds or members
          .map((g) => ({
            id: g.id,
            name: g.name,
            fill: g.fill,
            stroke: g.stroke,
            customBounds: g.customBounds
              ? {
                  x: g.customBounds.x + offsetX,
                  y: g.customBounds.y + offsetY,
                  width: g.customBounds.width,
                  height: g.customBounds.height,
                }
              : undefined,
          }));

        if (newGroups.length > 0) {
          useCanvasStore.setState({
            groups: [...existingGroups, ...newGroups],
          });
        }
      }

      setImportState({ status: "success", count: validShapes.length });
      setTimeout(onClose, 1500);
    } catch (err) {
      if (err instanceof FigmaAuthError) {
        setImportState({ status: "error", message: err.message });
      } else if (err instanceof FigmaNotFoundError) {
        setImportState({
          status: "error",
          message: "File not found. Check the URL and permissions.",
        });
      } else if (err instanceof FigmaRateLimitError) {
        setImportState({
          status: "error",
          message: "Rate limited. Please wait a moment and try again.",
        });
      } else {
        setImportState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Unknown error occurred",
        });
      }
      importingRef.current = false;
    }
  }, [fileKey, token, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter" && importState.status !== "loading") {
        handleImport();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleImport, onClose, importState.status],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        style={{ zIndex: Z_MODAL_BACKDROP }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl"
        style={{ zIndex: Z_MODAL_CONTENT }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Figma className="h-5 w-5 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">
              Import from Figma
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Figma File URL */}
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Figma File URL
          </label>
          <Input
            ref={urlInputRef}
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://www.figma.com/design/..."
            className={cn(
              fileKey && "border-green-400",
              importState.status === "error" && !fileKey && "border-red-400",
            )}
          />
          {fileKey && (
            <p className="mt-1 text-xs text-green-600">
              File key: {fileKey.slice(0, 12)}...
            </p>
          )}

          {/* Access Token */}
          <label className="mt-4 mb-1.5 block text-sm font-medium text-gray-700">
            Personal Access Token
          </label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="figd_..."
          />

          {/* Status */}
          {importState.status === "error" && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{importState.message}</span>
            </div>
          )}
          {importState.status === "loading" && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{importState.message}</span>
            </div>
          )}
          {importState.status === "success" && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Imported {importState.count} shapes</span>
            </div>
          )}

          {/* Help */}
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>
              {showHelp ? "Hide help" : "How to get an access token?"}
            </span>
          </button>

          {showHelp && (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-gray-600">
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>
                  Go to{" "}
                  <span className="font-medium text-gray-800">
                    Figma Settings → Account → Personal access tokens
                  </span>
                </li>
                <li>Click &quot;Generate new token&quot;</li>
                <li>
                  Give it a description and click &quot;Generate token&quot;
                </li>
                <li>Copy the token (starts with &quot;figd_&quot;)</li>
              </ol>
              <p className="mt-2 border-t border-blue-100 pt-2 text-gray-500">
                Your token is only used for this import and is never stored.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={
              !fileKey || !token.trim() || importState.status === "loading"
            }
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white",
              fileKey && token.trim() && importState.status !== "loading"
                ? "bg-orange-500 hover:bg-orange-600"
                : "cursor-not-allowed bg-gray-300",
            )}
          >
            <Download className="h-4 w-4" />
            Import
          </button>
        </div>
      </div>
    </>
  );
}
