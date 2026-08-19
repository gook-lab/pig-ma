import { useState, useRef, useEffect } from "react";
import { X, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Z_MODAL_BACKDROP, Z_MODAL_CONTENT } from "@/constants/zIndex";
import { importMermaidToCanvas, MermaidImportError } from "@/mermaid";
import toast from "@/utils/toast";

interface MermaidImportModalProps {
  onClose: () => void;
}

const PLACEHOLDER = `flowchart TD
  A[Start] --> B{Is it working?}
  B -->|Yes| C[Ship it]
  B -->|No| D[Debug]
  D --> B`;

export function MermaidImportModal({ onClose }: MermaidImportModalProps) {
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleImport = () => {
    if (!source.trim()) {
      setError("Paste a Mermaid flowchart first");
      return;
    }
    try {
      const { nodeCount, edgeCount } = importMermaidToCanvas(source);
      toast.success({
        title: "Diagram imported",
        message: `${nodeCount} node(s), ${edgeCount} connector(s) added`,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof MermaidImportError
          ? err.message
          : "Failed to import diagram",
      );
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: Z_MODAL_BACKDROP }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
        style={{ zIndex: Z_MODAL_CONTENT }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow size={20} className="text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Import Mermaid
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-500">
          Paste a flowchart definition. Nodes and connectors are created on the
          canvas.
        </p>

        <textarea
          ref={textareaRef}
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setError(null);
          }}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className={cn(
            "h-56 w-full resize-none rounded-lg border p-3 font-mono text-sm",
            "outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200",
            error ? "border-red-400" : "border-gray-300",
          )}
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600"
          >
            Import
          </button>
        </div>
      </div>
    </>
  );
}
