import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  MoreHorizontal,
  Check,
  Trash2,
  Send,
  Smile,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { CaptionMessage } from "./CaptionMessage";
import { EmojiPicker } from "./EmojiPicker";
import { MentionDropdown } from "./MentionDropdown";
import { MentionTextarea } from "./MentionTextarea";
import { generateUUID } from "@/utils/uuid";
import { useMention } from "@/hooks/useMention";
import type { CaptionThread, CommentAttachment } from "@/types";

interface CaptionPopupProps {
  caption: CaptionThread;
  index: number;
  position: { x: number; y: number };
  onClose: () => void;
}

const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB

export function CaptionPopup({
  caption,
  index,
  position,
  onClose,
}: CaptionPopupProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const mention = useMention({
    inputRef,
    text: replyText,
    setText: setReplyText,
  });
  const currentUser = useCanvasStore((s) => s.currentUser);
  const addReply = useCanvasStore((s) => s.addReply);
  const deleteCaption = useCanvasStore((s) => s.deleteCaption);
  const deleteMessage = useCanvasStore((s) => s.deleteMessage);
  const resolveCaption = useCanvasStore((s) => s.resolveCaption);
  const unresolveCaption = useCanvasStore((s) => s.unresolveCaption);
  const markAsRead = useCanvasStore((s) => s.markAsRead);

  // Mark as read on mount
  useEffect(() => {
    if (!caption.isRead) {
      markAsRead(caption.id);
    }
  }, [caption.id, caption.isRead, markAsRead]);

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
    const popup = popupRef.current;
    if (popup) {
      popup.addEventListener("paste", handlePaste as EventListener);
      return () =>
        popup.removeEventListener("paste", handlePaste as EventListener);
    }
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

  const handleSubmitReply = () => {
    const trimmedText = replyText.trim();
    if (!trimmedText && attachments.length === 0) return;

    addReply(
      caption.id,
      trimmedText,
      attachments.length > 0 ? attachments : undefined,
    );
    setReplyText("");
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 한글 입력 중(composition)에는 Enter 무시
    if (e.nativeEvent.isComposing || isComposing) return;

    // 멘션 드롭다운이 열려있으면 먼저 처리
    if (mention.handleMentionKeyDown(e)) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitReply();
    }
  };

  const handleResolveToggle = () => {
    if (caption.isResolved) {
      unresolveCaption(caption.id);
    } else {
      resolveCaption(caption.id);
    }
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (confirm("이 댓글 스레드를 삭제하시겠습니까?")) {
      deleteCaption(caption.id);
      onClose();
    }
    setShowMenu(false);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (confirm("이 메시지를 삭제하시겠습니까?")) {
      deleteMessage(caption.id, messageId);
    }
  };

  // Calculate popup position to stay within viewport
  const getAdjustedPosition = () => {
    const popupWidth = 360;
    const popupHeight = 400;
    const padding = 20;

    let x = position.x;
    let y = position.y;

    // Adjust for right edge
    if (x + popupWidth > window.innerWidth - padding) {
      x = window.innerWidth - popupWidth - padding;
    }

    // Adjust for bottom edge
    if (y + popupHeight > window.innerHeight - padding) {
      y = position.y - popupHeight - 40;
    }

    // Ensure not off left or top edge
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    return { x, y };
  };

  const adjustedPosition = getAdjustedPosition();

  return (
    <>
      {/* Backdrop to handle click outside */}
      <div className="fixed inset-0 z-[150]" onClick={onClose} />

      <div
        ref={popupRef}
        className="pointer-events-auto fixed z-[151] flex max-h-[80vh] w-[360px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white",
                caption.isResolved ? "bg-green-500" : "bg-violet-500",
              )}
            >
              {index}
            </div>
            <span className="text-sm font-semibold text-gray-800">
              댓글 {caption.isResolved && "(해결됨)"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Resolve button */}
            <button
              onClick={handleResolveToggle}
              className={cn(
                "rounded p-1.5 transition-colors",
                caption.isResolved
                  ? "text-green-500 hover:bg-green-50"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
              )}
              title={caption.isResolved ? "해결 취소" : "해결로 표시"}
            >
              <Check size={18} />
            </button>

            {/* More menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <MoreHorizontal size={18} />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute top-full right-0 z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={handleDelete}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      스레드 삭제
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {caption.messages.map((message) => (
            <CaptionMessage
              key={message.id}
              message={message}
              isAuthor={message.authorId === currentUser.id}
              onDelete={() => handleDeleteMessage(message.id)}
            />
          ))}
        </div>

        {/* Reply input */}
        <div className="border-t border-gray-200 bg-gray-50 p-3">
          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="group relative">
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-12 w-12 rounded object-cover"
                  />
                  <button
                    onClick={() => removeAttachment(attachment.id)}
                    className="absolute -top-1 -right-1 rounded-full bg-red-500 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <MentionTextarea
              ref={inputRef}
              value={replyText}
              onChange={(v) => mention.handleTextChange(v)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="답글 작성... (@로 멘션)"
              className={cn(
                "h-20 w-full resize-none rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-800 outline-none",
                "placeholder:text-gray-400",
                "focus:border-transparent focus:ring-2 focus:ring-violet-500",
              )}
            />
          </div>

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

          <div className="mt-2 flex items-center justify-between">
            <div className="relative flex gap-1">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={cn(
                  "rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600",
                  showEmojiPicker && "bg-gray-200 text-gray-600",
                )}
                title="이모지"
              >
                <Smile size={18} />
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={(emoji) => setReplyText((prev) => prev + emoji)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
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
              onClick={handleSubmitReply}
              disabled={!replyText.trim() && attachments.length === 0}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                replyText.trim() || attachments.length > 0
                  ? "bg-violet-500 text-white hover:bg-violet-600"
                  : "cursor-not-allowed bg-gray-200 text-gray-400",
              )}
            >
              <Send size={14} />
              전송
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
