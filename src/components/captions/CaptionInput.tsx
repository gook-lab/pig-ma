import { useState, useEffect, useRef, useCallback } from "react";
import { Smile, Image, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { EmojiPicker } from "./EmojiPicker";
import { MentionDropdown } from "./MentionDropdown";
import { MentionTextarea } from "./MentionTextarea";
import { generateUUID } from "@/utils/uuid";
import { useMention } from "@/hooks/useMention";
import type { CommentAttachment } from "@/types";

interface CaptionInputProps {
  position: { x: number; y: number };
  canvasPosition: { x: number; y: number }; // 캔버스 좌표
  onClose: () => void;
}

const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB

export function CaptionInput({
  position,
  canvasPosition,
  onClose,
}: CaptionInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mention = useMention({ inputRef, text, setText });
  const addCaption = useCanvasStore((s) => s.addCaption);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle paste for images
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageFile(file);
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleImageFile = (file: File) => {
    if (file.size > MAX_IMAGE_SIZE) {
      alert("이미지 크기는 1MB 이하여야 합니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const newAttachment: CommentAttachment = {
        id: generateUUID(),
        type: "image",
        url: reader.result as string,
        name: file.name,
      };
      setAttachments((prev) => [...prev, newAttachment]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = () => {
    const trimmedText = text.trim();
    if (!trimmedText && attachments.length === 0) return;

    addCaption(
      canvasPosition.x,
      canvasPosition.y,
      trimmedText,
      attachments.length > 0 ? attachments : undefined,
    );
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    // 한글 입력 중(composition)에는 Enter 무시
    if (e.nativeEvent.isComposing || isComposing) return;

    // 멘션 드롭다운 처리
    if (mention.handleMentionKeyDown(e)) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="pointer-events-auto fixed z-[200]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="relative">
        {/* Comment bubble tail */}
        <div
          className="absolute top-4 -left-2 h-0 w-0"
          style={{
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderRight: "10px solid white",
          }}
        />
        {/* Comment input container */}
        <div className="w-80 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">댓글 추가</span>
            <button
              onClick={onClose}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>

          {/* Text input */}
          <MentionTextarea
            ref={inputRef}
            value={text}
            onChange={(v) => mention.handleTextChange(v)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder="댓글을 입력하세요... (@로 멘션)"
            className={cn(
              "h-20 w-full resize-none rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-800 outline-none",
              "placeholder:text-gray-400",
              "focus:border-transparent focus:ring-2 focus:ring-violet-500",
            )}
          />

          {/* Mention dropdown */}
          {mention.showMentionList && (
            <MentionDropdown
              users={mention.filteredUsers}
              selectedIndex={mention.mentionIndex}
              position={mention.mentionPosition}
              above={mention.mentionAbove}
              onSelect={mention.selectMention}
            />
          )}

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="group relative">
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-16 w-16 rounded border border-gray-200 object-cover"
                  />
                  <button
                    onClick={() => removeAttachment(attachment.id)}
                    className="absolute -top-1 -right-1 rounded-full bg-red-500 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between">
            <div className="relative flex gap-1">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={cn(
                  "rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600",
                  showEmojiPicker && "bg-gray-100 text-gray-600",
                )}
                title="이모지"
              >
                <Smile size={18} />
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={(emoji) => setText((prev) => prev + emoji)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="이미지 첨부"
              >
                <Image size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() && attachments.length === 0}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                text.trim() || attachments.length > 0
                  ? "bg-violet-500 text-white hover:bg-violet-600"
                  : "cursor-not-allowed bg-gray-200 text-gray-400",
              )}
            >
              <Send size={14} />
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
