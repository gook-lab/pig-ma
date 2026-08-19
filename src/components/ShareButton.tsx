import { useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { ShareModal } from "./ShareModal";

export function ShareButton() {
  const [showModal, setShowModal] = useState(false);
  const isCaptionPanelOpen = useCanvasStore((s) => s.isCaptionPanelOpen);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={cn(
          "fixed top-4 z-[100]",
          "flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5",
          "text-sm font-medium text-white shadow-lg",
          "transition-all hover:bg-violet-600 hover:shadow-xl",
          "active:scale-95",
        )}
        style={{
          right: isCaptionPanelOpen ? "calc(256px + 32px)" : "16px", // 256px = w-64, 32px = gap
        }}
      >
        <Share2 size={18} />
        공유
      </button>

      <ShareModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
