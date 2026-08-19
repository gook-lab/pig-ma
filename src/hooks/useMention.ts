import { useState, useCallback, useRef, useEffect } from "react";
import { filterUsers, type MentionUser } from "@/components/tiptap/MentionList";

interface UseMentionOptions {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  text: string;
  setText: (text: string) => void;
}

export function useMention({ inputRef, text, setText }: UseMentionOptions) {
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionAbove, setMentionAbove] = useState(false);
  const mentionStartRef = useRef<number | null>(null);

  const filteredUsers = filterUsers(mentionQuery);

  // Detect @ trigger in textarea
  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);

      const el = inputRef.current;
      if (!el) return;

      const cursorPos = el.selectionStart;
      // Find the last @ before cursor
      const textBeforeCursor = newText.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex >= 0) {
        const charBefore = lastAtIndex > 0 ? newText[lastAtIndex - 1] : " ";
        // @ must be at start or after whitespace
        if (lastAtIndex === 0 || /\s/.test(charBefore!)) {
          const query = textBeforeCursor.substring(lastAtIndex + 1);
          // No spaces in query (mention is a single word)
          if (!query.includes(" ")) {
            mentionStartRef.current = lastAtIndex;
            setMentionQuery(query);
            setMentionIndex(0);
            setShowMentionList(true);

            // Calculate dropdown position — show above if not enough space below
            const rect = el.getBoundingClientRect();
            const dropdownHeight = 200; // approximate max height
            const spaceBelow = window.innerHeight - rect.bottom;
            const above =
              spaceBelow < dropdownHeight && rect.top > dropdownHeight;
            setMentionAbove(above);
            setMentionPosition({
              top: above ? rect.top - 4 : rect.bottom + 4,
              left: rect.left,
            });
            return;
          }
        }
      }

      setShowMentionList(false);
      mentionStartRef.current = null;
    },
    [inputRef, setText],
  );

  // Select a mention user
  const selectMention = useCallback(
    (user: MentionUser) => {
      if (mentionStartRef.current === null) return;

      const el = inputRef.current;
      if (!el) return;

      const before = text.substring(0, mentionStartRef.current);
      const cursorPos = el.selectionStart;
      const after = text.substring(cursorPos);

      const newText = `${before}@${user.label} ${after}`;
      setText(newText);
      setShowMentionList(false);
      mentionStartRef.current = null;

      // Restore focus and cursor
      requestAnimationFrame(() => {
        const newCursorPos = before.length + user.label.length + 2; // @label + space
        el.focus();
        el.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [text, inputRef, setText],
  );

  // Handle keyboard navigation in mention list
  const handleMentionKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!showMentionList || filteredUsers.length === 0) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev >= filteredUsers.length - 1 ? 0 : prev + 1,
        );
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev <= 0 ? filteredUsers.length - 1 : prev - 1,
        );
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filteredUsers[mentionIndex]);
        return true;
      }
      if (e.key === "Escape") {
        setShowMentionList(false);
        mentionStartRef.current = null;
        return true;
      }
      return false;
    },
    [showMentionList, filteredUsers, mentionIndex, selectMention],
  );

  // Close on outside click
  useEffect(() => {
    if (!showMentionList) return;
    const handleClick = () => setShowMentionList(false);
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [showMentionList]);

  return {
    showMentionList,
    filteredUsers,
    mentionIndex,
    mentionPosition,
    mentionAbove,
    handleTextChange,
    handleMentionKeyDown,
    selectMention,
  };
}
