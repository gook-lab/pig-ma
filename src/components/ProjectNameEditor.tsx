import { useState, useRef, useEffect, useCallback } from "react";
import { useCanvasStore, useProjectName } from "@/store";
import type { CanvasState } from "@/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface CanvasActions {
  renameProject: (name: string) => void;
}

export function ProjectNameEditor() {
  const projectName = useProjectName();
  const renameProject = useCanvasStore(
    (s: CanvasState & CanvasActions) => s.renameProject,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  // 편집 시작 시 input에 포커스
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 외부에서 projectName이 변경되면 editValue도 업데이트
  useEffect(() => {
    if (!isEditing) {
      setEditValue(projectName);
    }
  }, [projectName, isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== projectName) {
      renameProject(trimmed);
    } else {
      setEditValue(projectName);
    }
    setIsEditing(false);
  }, [editValue, projectName, renameProject]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditValue(projectName);
        setIsEditing(false);
      }
    },
    [handleSave, projectName],
  );

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-7 max-w-[200px] min-w-[80px] border-b border-gray-300 bg-transparent px-1 py-0.5",
          "text-xs font-medium text-gray-700",
        )}
        style={{ width: `${Math.max(80, editValue.length * 8)}px` }}
      />
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "text-xs font-medium text-gray-700",
        "hover:bg-gray-100 hover:text-gray-900",
        "rounded px-1.5 py-0.5",
        "cursor-pointer transition-colors",
        "max-w-[200px] truncate",
      )}
      title="프로젝트 이름 변경"
    >
      {projectName}
    </button>
  );
}
