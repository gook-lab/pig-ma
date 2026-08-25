import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  Key,
  Loader2,
  AlertCircle,
  Scan,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { Z_SIDE_PANEL } from "@/constants/zIndex";
import type { AIProvider } from "@/types";

const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: "Gemini (free)",
  claude: "Claude",
};

const PROVIDER_KEY_HINTS: Record<AIProvider, string> = {
  gemini: "Get free key at ai.google.dev",
  claude: "Get key at console.anthropic.com",
};

const EXAMPLE_PROMPTS = [
  "Login flow with email verification",
  "E-commerce checkout process",
  "Organization chart for a startup",
  "REST API architecture diagram",
  "User registration sequence",
  "Database schema for a blog",
];

export function AIPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const aiProvider = useCanvasStore((s) => s.aiProvider);
  const aiApiKey = useCanvasStore((s) => s.aiApiKey);
  const aiLoading = useCanvasStore((s) => s.aiLoading);
  const aiError = useCanvasStore((s) => s.aiError);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const setAIProvider = useCanvasStore((s) => s.setAIProvider);
  const setAIApiKey = useCanvasStore((s) => s.setAIApiKey);
  const generateDiagram = useCanvasStore((s) => s.generateDiagram);
  const analyzeSelection = useCanvasStore((s) => s.analyzeSelection);
  const clearAIError = useCanvasStore((s) => s.clearAIError);

  const hasKey = !!aiApiKey;
  const hasSelection = selectedIds.length > 0;

  // 패널 열릴 때 포커스
  useEffect(() => {
    if (isOpen && hasKey && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, hasKey]);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim() || aiLoading) return;
    generateDiagram(prompt.trim());
    setPrompt("");
  }, [prompt, aiLoading, generateDiagram]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      }
      e.stopPropagation();
    },
    [handleGenerate],
  );

  const handleSaveKey = useCallback(() => {
    if (!keyInput.trim()) return;
    setAIApiKey(keyInput.trim());
    setKeyInput("");
    setShowKeyInput(false);
  }, [keyInput, setAIApiKey]);

  const handleProviderChange = useCallback(
    (provider: AIProvider) => {
      setAIProvider(provider);
      setShowProviderMenu(false);
      // 프로바이더 바꾸면 키 초기화
      setAIApiKey(null);
    },
    [setAIProvider, setAIApiKey],
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-20 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-violet-700 active:scale-95"
        style={{ zIndex: Z_SIDE_PANEL }}
        title="AI Diagram Generator"
      >
        <Sparkles className="h-4 w-4" />
        AI
      </button>
    );
  }

  return (
    <div
      className="popover-enter fixed right-4 bottom-20 flex w-80 flex-col rounded-xl bg-gray-800 shadow-2xl"
      style={{ zIndex: Z_SIDE_PANEL }}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-white">AI Generate</span>
        </div>
        <button
          onClick={() => {
            setIsOpen(false);
            clearAIError();
          }}
          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Provider Selector */}
      <div className="border-b border-gray-700 px-4 py-2">
        <div className="relative">
          <button
            onClick={() => setShowProviderMenu(!showProviderMenu)}
            className="flex w-full items-center justify-between rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-600"
          >
            <span>{PROVIDER_LABELS[aiProvider]}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showProviderMenu && (
            <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-lg bg-gray-700 py-1 shadow-lg">
              {(["gemini", "claude"] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={cn(
                    "flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-600",
                    aiProvider === p ? "text-violet-400" : "text-gray-300",
                  )}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* API Key Section */}
      {!hasKey && (
        <div className="border-b border-gray-700 px-4 py-3">
          {!showKeyInput ? (
            <button
              onClick={() => setShowKeyInput(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-600 px-3 py-2.5 text-xs text-gray-400 transition-colors hover:border-violet-500 hover:text-violet-400"
            >
              <Key className="h-3.5 w-3.5" />
              <div className="text-left">
                <div>Set API key</div>
                <div className="mt-0.5 text-[10px] text-gray-500">
                  {PROVIDER_KEY_HINTS[aiProvider]}
                </div>
              </div>
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveKey();
                  e.stopPropagation();
                }}
                placeholder="Paste your API key..."
                className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                autoFocus
              />
              <button
                onClick={handleSaveKey}
                disabled={!keyInput.trim()}
                className="rounded bg-violet-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {aiError && (
        <div className="flex items-start gap-2 border-b border-gray-700 px-4 py-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
          <div className="flex-1 text-xs text-red-400">{aiError}</div>
          <button
            onClick={clearAIError}
            className="text-gray-500 hover:text-gray-300"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col gap-3 p-4">
        {/* Prompt Input */}
        <div className="relative">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasKey
                ? "Describe a diagram... (e.g. login flow)"
                : "Set API key above to start"
            }
            disabled={!hasKey || aiLoading}
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 pr-10 text-sm text-white placeholder-gray-500 transition-colors outline-none focus:border-violet-500 disabled:opacity-50"
          />
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || !hasKey || aiLoading}
            className="absolute right-2 bottom-2 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-600 hover:text-white disabled:opacity-30"
            title="Generate (Enter)"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Example Prompts */}
        {hasKey && !prompt && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.slice(0, 4).map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-full bg-gray-700 px-2.5 py-1 text-[10px] text-gray-400 transition-colors hover:bg-gray-600 hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Analyze Selection */}
        {hasKey && hasSelection && (
          <button
            onClick={() => analyzeSelection()}
            disabled={aiLoading}
            className="flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-300 transition-colors hover:border-violet-500 hover:text-violet-400 disabled:opacity-50"
          >
            <Scan className="h-3.5 w-3.5" />
            Analyze selected ({selectedIds.length} objects)
          </button>
        )}

        {/* Loading State */}
        {aiLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
            Generating diagram...
          </div>
        )}
      </div>

      {/* Footer — Key status */}
      {hasKey && (
        <div className="flex items-center justify-between border-t border-gray-700 px-4 py-2">
          <span className="text-[10px] text-gray-500">
            {PROVIDER_LABELS[aiProvider]} connected
          </span>
          <button
            onClick={() => {
              setAIApiKey(null);
              setShowKeyInput(false);
            }}
            className="text-[10px] text-gray-500 hover:text-red-400"
          >
            Remove key
          </button>
        </div>
      )}
    </div>
  );
}
