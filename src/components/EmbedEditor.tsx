import { useCallback, useMemo, useState } from "react";
import { useCanvasStore } from "@/store";
import { EmbedOptionsBar } from "./EmbedOptionsBar";
import { EmbedUrlModal } from "./EmbedUrlModal";
import { calculateOptionsBarPosition } from "@/utils/optionsBar";
import { parseEmbedUrl } from "@/utils/embed";
import type { CanvasObject } from "@/types";

const OPTIONS_BAR_HEIGHT = 50;

export function EmbedEditor() {
  const objects = useCanvasStore((s) => s.objects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const viewport = useCanvasStore((s) => s.viewport);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const deleteObjects = useCanvasStore((s) => s.deleteObjects);
  const isLocked = useCanvasStore((s) => s.isLocked);

  const [showUrlModal, setShowUrlModal] = useState(false);

  // Find if a single embed is selected
  const selectedEmbed = useMemo(() => {
    if (selectedIds.length !== 1) return undefined;
    const obj = objects.find((o) => o.id === selectedIds[0]);
    return obj?.type === "embed" ? obj : undefined;
  }, [objects, selectedIds]);

  // Calculate the position for the options bar
  const getBarPosition = useCallback(() => {
    if (!selectedEmbed)
      return { x: 0, y: 0, above: false, align: "center" as const };

    return calculateOptionsBarPosition({
      element: {
        x: selectedEmbed.x,
        y: selectedEmbed.y,
        width: selectedEmbed.width ?? 480,
        height: selectedEmbed.height ?? 270,
      },
      viewport,
      barHeight: OPTIONS_BAR_HEIGHT,
      barWidth: 340,
    });
  }, [selectedEmbed, viewport]);

  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      if (selectedEmbed) {
        updateObject(selectedEmbed.id, updates);
      }
    },
    [selectedEmbed, updateObject],
  );

  const handleDelete = useCallback(() => {
    if (selectedEmbed) {
      deleteObjects([selectedEmbed.id]);
    }
  }, [selectedEmbed, deleteObjects]);

  const handleReplaceUrl = useCallback(() => {
    setShowUrlModal(true);
  }, []);

  const handleUrlSubmit = useCallback(
    (url: string) => {
      if (!selectedEmbed) return;

      const parsed = parseEmbedUrl(url);
      if (parsed) {
        updateObject(selectedEmbed.id, {
          embedUrl: parsed.url,
          embedType: parsed.type,
          embedMetadata: parsed.metadata,
          isPlaying: false, // Reset playing state
        });
      }
      setShowUrlModal(false);
    },
    [selectedEmbed, updateObject],
  );

  const handleCloseModal = useCallback(() => {
    setShowUrlModal(false);
  }, []);

  // Don't show options bar when canvas is locked
  if (isLocked) return null;

  // Don't show options bar if no embed is selected
  if (!selectedEmbed) return null;

  // Don't show options bar if embed is locked
  if (selectedEmbed.locked) return null;

  const position = getBarPosition();

  return (
    <>
      <EmbedOptionsBar
        shape={selectedEmbed}
        position={position}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onReplaceUrl={handleReplaceUrl}
      />

      {showUrlModal && (
        <EmbedUrlModal
          initialUrl={selectedEmbed.embedUrl ?? ""}
          onSubmit={handleUrlSubmit}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
