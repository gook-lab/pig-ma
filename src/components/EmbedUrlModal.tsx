import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  X,
  Youtube,
  Figma,
  AlertCircle,
  HelpCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { parseEmbedUrl } from "@/utils/embed";
import { Z_MODAL_BACKDROP, Z_MODAL_CONTENT } from "@/constants/zIndex";

interface EmbedUrlModalProps {
  initialUrl?: string;
  onSubmit: (url: string) => void;
  onClose: () => void;
}

export function EmbedUrlModal({
  initialUrl = "",
  onSubmit,
  onClose,
}: EmbedUrlModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Validate URL as user types
  const validateUrl = useCallback((value: string) => {
    if (!value.trim()) {
      setError(null);
      return;
    }

    const parsed = parseEmbedUrl(value);
    if (!parsed) {
      setError("Please enter a valid YouTube, Figma, or Notion URL");
    } else {
      setError(null);
    }
  }, []);

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setUrl(value);
      validateUrl(value);
    },
    [validateUrl],
  );

  const handleSubmit = useCallback(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Please enter a URL");
      return;
    }

    const parsed = parseEmbedUrl(trimmedUrl);
    if (!parsed) {
      setError("Please enter a valid YouTube, Figma, or Notion URL");
      return;
    }

    onSubmit(trimmedUrl);
  }, [url, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  // Detect URL type for preview
  const parsedUrl = url.trim() ? parseEmbedUrl(url) : null;

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
        className="fixed top-1/2 left-1/2 w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl"
        style={{ zIndex: Z_MODAL_CONTENT }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">Embed URL</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Supported services */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span>Supported:</span>
            <div className="flex items-center gap-1">
              <Youtube className="h-4 w-4 text-red-500" />
              <span>YouTube</span>
            </div>
            <div className="flex items-center gap-1">
              <Figma className="h-4 w-4 text-orange-500" />
              <span>Figma</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4 text-gray-700" />
              <span>Notion</span>
            </div>
          </div>

          {/* URL input */}
          <div className="relative">
            <Input
              ref={inputRef}
              type="url"
              value={url}
              onChange={handleUrlChange}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube, Figma, or Notion URL..."
              className={cn(
                "pr-10",
                error &&
                  "border-red-400 focus:border-red-500 focus:ring-red-500",
              )}
            />
            {parsedUrl && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {parsedUrl.type === "youtube" ? (
                  <Youtube className="h-4 w-4 text-red-500" />
                ) : parsedUrl.type === "figma" ? (
                  <Figma className="h-4 w-4 text-orange-500" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-700" />
                )}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-2 flex items-center gap-1 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* URL preview */}
          {parsedUrl && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-sm">
                {parsedUrl.type === "youtube" ? (
                  <>
                    <div className="flex h-6 items-center rounded bg-red-500 px-2 text-xs font-semibold text-white">
                      YouTube
                    </div>
                    <span className="text-gray-600">
                      {parsedUrl.metadata.videoId
                        ? `Video ID: ${parsedUrl.metadata.videoId}`
                        : "Video detected"}
                      {parsedUrl.metadata.startTime
                        ? ` (starts at ${parsedUrl.metadata.startTime}s)`
                        : ""}
                    </span>
                  </>
                ) : parsedUrl.type === "figma" ? (
                  <>
                    <div className="flex h-6 items-center rounded bg-orange-500 px-2 text-xs font-semibold text-white">
                      Figma
                    </div>
                    <span className="text-gray-600">
                      {parsedUrl.metadata.fileName ||
                        parsedUrl.metadata.fileKey?.slice(0, 10) + "..."}
                      {parsedUrl.metadata.figmaType
                        ? ` (${parsedUrl.metadata.figmaType})`
                        : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-6 items-center rounded bg-gray-800 px-2 text-xs font-semibold text-white">
                      Notion
                    </div>
                    <span className="text-gray-600">
                      {parsedUrl.metadata.pageName || "Notion Page"}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Help toggle */}
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>{showHelp ? "Hide help" : "How to get the URL?"}</span>
          </button>

          {/* Help content */}
          {showHelp && (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-gray-600">
              <div className="mb-2 font-medium text-gray-700">
                Supported URL formats:
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center gap-1 font-medium text-red-600">
                    <Youtube className="h-3 w-3" />
                    YouTube
                  </div>
                  <ul className="ml-4 mt-1 list-disc text-gray-500">
                    <li>youtube.com/watch?v=...</li>
                    <li>youtu.be/...</li>
                    <li>youtube.com/shorts/...</li>
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-1 font-medium text-orange-600">
                    <Figma className="h-3 w-3" />
                    Figma
                  </div>
                  <ul className="ml-4 mt-1 list-disc text-gray-500">
                    <li>figma.com/design/... (Design file)</li>
                    <li>figma.com/board/... (FigJam)</li>
                    <li>figma.com/proto/... (Prototype)</li>
                  </ul>
                  <div className="mt-1 text-gray-400">
                    * Team pages (/files/team/...) are not supported
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 font-medium text-gray-700">
                    <FileText className="h-3 w-3" />
                    Notion
                  </div>
                  <ul className="ml-4 mt-1 list-disc text-gray-500">
                    <li>notion.so/Page-Name-...</li>
                    <li>notion.site/Page-Name-...</li>
                  </ul>
                  <div className="mt-1 text-gray-400">
                    * Page must be shared publicly
                  </div>
                </div>
              </div>
              <div className="mt-2 border-t border-blue-100 pt-2 text-gray-500">
                <span className="font-medium">Tip:</span> Open the file in your
                browser and copy the URL from the address bar.
              </div>
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
            onClick={handleSubmit}
            disabled={!parsedUrl}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium text-white",
              parsedUrl
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-300",
            )}
          >
            Embed
          </button>
        </div>
      </div>
    </>
  );
}
