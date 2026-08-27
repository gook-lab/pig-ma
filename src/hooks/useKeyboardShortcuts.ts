import { useCallback, useEffect } from "react";
import { useCanvasStore, undo, redo } from "@/store";
import { useShortcutsStore, matchesBinding } from "@/hooks/useShortcuts";
import { useHistoryStore } from "@/hooks/useAutoSave";
import { getLastMousePosition } from "@/utils/mousePosition";
import { parseEmbedUrl } from "@/utils/embed";
import { createEmbed, createImage } from "@/utils/factory";
import type { ObjectType, ShortcutAction, Tool } from "@/types";
import toast from "react-hot-toast";

const TOOL_ACTIONS: ShortcutAction[] = [
  "select",
  "hand",
  "shape",
  "pencil",
  "eraser",
  "stickyNote",
  "connector",
  "textBox",
  "chart",
];

export function useKeyboardShortcuts() {
  const {
    selectedIds,
    deleteSelected,
    setTool,
    setSelectedIds,
    clearSelection,
    updateObject,
    addObject,
    objects,
    groups,
    editingTextId,
    isLocked,
    setLocked,
    setShowShapesPanel,
    copyObjects,
    pasteObjects,
    pasteAndReplace,
    bringToFront,
    sendToBack,
    lockObjects,
    unlockObjects,
    unlockAllObjects,
    toggleHideCaptions,
    toggleHideUI,
    viewport,
    groupSelected,
    ungroupSelected,
    updateGroup,
    activeEditor,
    setEditingTextId,
    setPendingTextInput,
    currentPageId,
    selectedTableCells,
    deleteSelectedTableCells,
    clearSelectedTableCells,
    editingTableCell,
  } = useCanvasStore();

  // Undo 핸들러 - Tiptap 편집 중이면 Tiptap 히스토리 우선
  //
  // ⚠️ useCallback 이 필요하다. 이 두 핸들러는 아래 keydown useEffect 의 의존성
  // 배열에 들어 있는데, 매 렌더 새 함수면 `===` 가 항상 실패해서 **렌더마다**
  // 리스너를 떼었다 다시 붙인다 (react-doctor/no-effect-with-fresh-deps).
  const handleUndo = useCallback(() => {
    if (editingTextId && activeEditor) {
      // Tiptap 히스토리가 있으면 사용
      if (activeEditor.can().undo()) {
        activeEditor.commands.undo();
        return;
      }
      // Tiptap 히스토리가 없으면 편집 종료 후 Zustand undo
      setEditingTextId(null);
    }
    undo();
  }, [editingTextId, activeEditor, setEditingTextId]);

  // Redo 핸들러 - Tiptap 편집 중이면 Tiptap 히스토리 우선
  const handleRedo = useCallback(() => {
    if (editingTextId && activeEditor) {
      // Tiptap 히스토리가 있으면 사용
      if (activeEditor.can().redo()) {
        activeEditor.commands.redo();
        return;
      }
      // Tiptap 히스토리가 없으면 편집 종료 후 Zustand redo
      setEditingTextId(null);
    }
    redo();
  }, [editingTextId, activeEditor, setEditingTextId]);

  // 선택된 객체들이 잠긴 그룹에 속해있는지 체크하는 헬퍼
  const isSelectionLocked = () => {
    const selectedObjs = objects.filter((obj) => selectedIds.includes(obj.id));
    // 개별 객체 잠금 체크
    if (selectedObjs.some((obj) => obj.locked)) return true;
    // 그룹 잠금 체크
    const groupIds = [
      ...new Set(selectedObjs.map((o) => o.groupId).filter(Boolean)),
    ];
    return groupIds.some((gid) => groups.find((g) => g.id === gid)?.locked);
  };

  // 잠긴 그룹 ID 찾기
  const getLockedGroupId = () => {
    const selectedObjs = objects.filter((obj) => selectedIds.includes(obj.id));
    const groupIds = [
      ...new Set(selectedObjs.map((o) => o.groupId).filter(Boolean)),
    ];
    for (const gid of groupIds) {
      const group = groups.find((g) => g.id === gid);
      if (group?.locked) return gid;
    }
    return null;
  };
  const { shortcuts, isCapturing } = useShortcutsStore();
  const { addSnapshot } = useHistoryStore();

  useEffect(() => {
    // Track toast shown state to avoid spam
    let koreanToastShown = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs or editing text
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (editingTextId) return;
      if (editingTableCell) return;
      if (isCapturing) return; // 키 캡처 모드 중에는 단축키 비활성화

      // Detect Korean input and show toast (check if key is Hangul character)
      const isKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.key);
      if (isKorean && !koreanToastShown) {
        koreanToastShown = true;
        toast("영문 키보드로 전환해주세요", {
          icon: "⌨️",
          duration: 2000,
          position: "bottom-center",
        });
        // Reset after delay to allow showing again
        setTimeout(() => {
          koreanToastShown = false;
        }, 3000);
        return;
      }

      // Cmd+L / Ctrl+L for lock toggle
      const isLKey = e.key.toLowerCase() === "l" || e.code === "KeyL";
      if (isLKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isLocked) {
          // Show unlock confirmation via custom event
          window.dispatchEvent(new CustomEvent("canvas-unlock-request"));
        } else {
          setLocked(true); // store에서 Hand Tool 전환 + 선택 해제 처리
        }
        return;
      }

      // Cmd+S / Ctrl+S for save
      const isSKey = e.key.toLowerCase() === "s" || e.code === "KeyS";
      if (isSKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (objects.length > 0) {
          addSnapshot(currentPageId, objects, groups, "수동 저장");
          toast.success("저장되었습니다", {
            duration: 2000,
            position: "bottom-center",
          });
        } else {
          toast("저장할 내용이 없습니다", {
            duration: 2000,
            position: "bottom-center",
            icon: "📝",
          });
        }
        return;
      }

      // ESC key - deselect if selected, otherwise switch to select tool
      if (e.key === "Escape") {
        e.preventDefault();
        // Clear table cell selection first
        if (selectedTableCells) {
          clearSelectedTableCells();
          return;
        }
        if (selectedIds.length > 0) {
          clearSelection();
        } else {
          setTool("select");
        }
        return;
      }

      // Cmd+A for select all
      const isAKey = e.key.toLowerCase() === "a" || e.code === "KeyA";
      if (isAKey && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        // Select all non-locked objects
        const selectableIds = objects
          .filter((obj) => !obj.locked)
          .map((obj) => obj.id);
        if (selectableIds.length > 0) {
          setSelectedIds(selectableIds);
          setTool("select");
        }
        return;
      }

      // When locked, only allow Hand tool (H)
      if (isLocked) {
        const isHKey = e.key.toLowerCase() === "h" || e.code === "KeyH";
        if (isHKey) {
          e.preventDefault();
          setTool("hand");
        }
        return;
      }

      // C key for caption - dispatch custom event for App.tsx to handle
      // Support both e.key and e.code for non-English layouts
      const isCKey = e.key.toLowerCase() === "c" || e.code === "KeyC";
      if (isCKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-caption-input"));
        return;
      }

      // Cmd+C for copy
      if (isCKey && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          if (isSelectionLocked()) {
            toast.error("잠긴 요소는 복사할 수 없습니다", {
              duration: 1500,
              position: "bottom-center",
            });
            return;
          }
          copyObjects();
          toast.success("복사되었습니다", {
            duration: 1500,
            position: "bottom-center",
          });
        }
        return;
      }

      // Cmd+V for paste
      const isVKey = e.key.toLowerCase() === "v" || e.code === "KeyV";
      if (isVKey && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const mousePos = getLastMousePosition();

        const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
        const MAX_IMAGE_DIM = 800; // 최대 표시 크기

        // Helper: 이미지 blob → 캔버스 리사이징 → 압축된 data URL
        const processImageBlob = (blob: Blob) => {
          if (blob.size > MAX_IMAGE_SIZE) {
            toast.error("이미지는 10MB 이하만 가능합니다", {
              duration: 1500,
              position: "bottom-center",
            });
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new window.Image();
            img.onload = () => {
              let width = img.width;
              let height = img.height;

              // 큰 이미지 → 캔버스 리사이징으로 압축
              let finalDataUrl = dataUrl;
              if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
                const ratio = MAX_IMAGE_DIM / Math.max(width, height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
                // canvas로 리사이즈하여 실제 파일 크기 줄이기
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(img, 0, 0, width, height);
                  finalDataUrl = canvas.toDataURL("image/png");
                }
              }

              const imageObj = createImage(
                mousePos.x - width / 2,
                mousePos.y - height / 2,
                finalDataUrl,
                width,
                height,
              );
              addObject(imageObj);
              setSelectedIds([imageObj.id]);
              toast.success("이미지가 붙여넣기되었습니다", {
                duration: 1500,
                position: "bottom-center",
              });
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(blob);
        };

        // Helper: 텍스트 클립보드에서 embed URL 파싱
        const tryEmbedUrl = () => {
          navigator.clipboard
            .readText()
            .then((text) => {
              const parsed = parseEmbedUrl(text.trim());
              if (parsed) {
                const embed = createEmbed(
                  mousePos.x,
                  mousePos.y,
                  parsed.url,
                  parsed.type,
                  parsed.metadata,
                );
                addObject(embed);
                setSelectedIds([embed.id]);
                toast.success(
                  `${parsed.type === "youtube" ? "YouTube" : "Figma"} 임베드가 추가되었습니다`,
                  {
                    duration: 1500,
                    position: "bottom-center",
                  },
                );
              } else {
                // 내부 클립보드도 확인
                const internalClipboard = useCanvasStore.getState().clipboard;
                if (internalClipboard.length > 0) {
                  pasteObjects(mousePos.x, mousePos.y);
                } else {
                  toast.error("붙여넣을 내용이 없습니다", {
                    duration: 1500,
                    position: "bottom-center",
                  });
                }
              }
            })
            .catch(() => {
              // 클립보드 접근 실패 시 내부 클립보드 시도
              const internalClipboard = useCanvasStore.getState().clipboard;
              if (internalClipboard.length > 0) {
                pasteObjects(mousePos.x, mousePos.y);
              } else {
                toast.error("붙여넣을 내용이 없습니다", {
                  duration: 1500,
                  position: "bottom-center",
                });
              }
            });
        };

        // 우선순위: 시스템 이미지 → 내부 클립보드 → embed URL → 에러
        // 시스템 클립보드에 이미지가 있으면 항상 이미지 우선
        navigator.clipboard
          .read()
          .then((items) => {
            let foundImage = false;
            for (const item of items) {
              const imageType = item.types.find((t) => t.startsWith("image/"));
              if (imageType) {
                foundImage = true;
                item.getType(imageType).then(processImageBlob);
                break;
              }
            }
            if (!foundImage) {
              // 이미지 없음 → 내부 클립보드 우선, 없으면 embed URL
              const internalClipboard = useCanvasStore.getState().clipboard;
              if (internalClipboard.length > 0) {
                pasteObjects(mousePos.x, mousePos.y);
              } else {
                tryEmbedUrl();
              }
            }
          })
          .catch(() => {
            // clipboard.read() 미지원 → 내부 클립보드 → embed URL
            const internalClipboard = useCanvasStore.getState().clipboard;
            if (internalClipboard.length > 0) {
              pasteObjects(mousePos.x, mousePos.y);
            } else {
              tryEmbedUrl();
            }
          });
        return;
      }

      // Shift+Cmd+R for paste and replace
      const isRKey = e.key.toLowerCase() === "r" || e.code === "KeyR";
      if (isRKey && (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (isSelectionLocked()) {
          toast.error("잠긴 요소는 교체할 수 없습니다", {
            duration: 1500,
            position: "bottom-center",
          });
          return;
        }
        const mousePos = getLastMousePosition();
        pasteAndReplace(mousePos.x, mousePos.y);
        return;
      }

      // ] for bring to front
      if (
        e.key === "]" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          if (isSelectionLocked()) {
            toast.error("잠긴 요소는 순서를 변경할 수 없습니다", {
              duration: 1500,
              position: "bottom-center",
            });
            return;
          }
          bringToFront();
        }
        return;
      }

      // [ for send to back
      if (
        e.key === "[" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          if (isSelectionLocked()) {
            toast.error("잠긴 요소는 순서를 변경할 수 없습니다", {
              duration: 1500,
              position: "bottom-center",
            });
            return;
          }
          sendToBack();
        }
        return;
      }

      // Shift+Cmd+L for lock/unlock selected objects (그룹 잠금 포함)
      if (isLKey && (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          const lockedGroupId = getLockedGroupId();
          if (lockedGroupId) {
            // 그룹 잠금 해제
            updateGroup(lockedGroupId, { locked: false });
            toast.success("섹션 잠금 해제되었습니다", {
              duration: 1500,
              position: "bottom-center",
            });
          } else {
            const selectedObjs = objects.filter((obj) =>
              selectedIds.includes(obj.id),
            );
            const allLocked = selectedObjs.every((obj) => obj.locked);
            if (allLocked) {
              unlockObjects();
              toast.success("잠금 해제되었습니다", {
                duration: 1500,
                position: "bottom-center",
              });
            } else {
              // 그룹에 속해있으면 그룹 전체 잠금
              const groupIds = [
                ...new Set(selectedObjs.map((o) => o.groupId).filter(Boolean)),
              ];
              if (groupIds.length === 1) {
                updateGroup(groupIds[0]!, { locked: true });
                toast.success("섹션이 잠금되었습니다", {
                  duration: 1500,
                  position: "bottom-center",
                });
              } else {
                lockObjects();
                toast.success("잠금되었습니다", {
                  duration: 1500,
                  position: "bottom-center",
                });
              }
            }
          }
        }
        return;
      }

      // Option+Shift+Cmd+L for unlock all objects
      if (isLKey && (e.metaKey || e.ctrlKey) && e.shiftKey && e.altKey) {
        e.preventDefault();
        unlockAllObjects();
        toast.success("모든 객체 잠금 해제", {
          duration: 1500,
          position: "bottom-center",
        });
        return;
      }

      // Cmd+/ for toggle UI
      if (
        e.key === "/" &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        toggleHideUI();
        return;
      }

      // Cmd+G for grouping
      const isGKey = e.key.toLowerCase() === "g" || e.code === "KeyG";
      if (isGKey && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (selectedIds.length >= 2) {
          e.preventDefault();
          if (isSelectionLocked()) {
            toast.error("잠긴 요소는 그룹화할 수 없습니다", {
              duration: 1500,
              position: "bottom-center",
            });
            return;
          }
          groupSelected();
          toast.success("그룹화 완료", {
            duration: 1500,
            position: "bottom-center",
          });
        }
        return;
      }

      // Cmd+Shift+G for ungrouping
      if (isGKey && (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          if (isSelectionLocked()) {
            toast.error("잠긴 요소는 그룹 해제할 수 없습니다", {
              duration: 1500,
              position: "bottom-center",
            });
            return;
          }
          ungroupSelected();
          toast.success("그룹 해제 완료", {
            duration: 1500,
            position: "bottom-center",
          });
        }
        return;
      }

      // Check if text-editable objects are selected (should ignore tool shortcuts)
      // Includes: stickyNote, textBox, shape, connectorLabel
      const TEXT_EDITABLE_TYPES: ObjectType[] = [
        "stickyNote",
        "textBox",
        "shape",
        "connectorLabel",
      ];

      const hasTextEditableSelected =
        selectedIds.length > 0 &&
        objects.some(
          (obj) =>
            selectedIds.includes(obj.id) &&
            TEXT_EDITABLE_TYPES.includes(obj.type),
        );

      // Check each shortcut
      for (const shortcut of shortcuts) {
        if (matchesBinding(e, shortcut.binding)) {
          e.preventDefault();

          // Handle action
          if (TOOL_ACTIONS.includes(shortcut.action)) {
            // Skip tool shortcuts when text-editable objects are selected
            if (hasTextEditableSelected) return;
            setTool(shortcut.action as Tool);
            // Open shapes panel when shape shortcut is triggered
            if (shortcut.action === "shape") {
              setShowShapesPanel(true);
            }
          } else if (shortcut.action === "delete") {
            // Table cell selection delete takes priority
            if (selectedTableCells) {
              deleteSelectedTableCells();
              return;
            }
            if (selectedIds.length > 0) {
              if (isSelectionLocked()) {
                toast.error("잠긴 요소는 삭제할 수 없습니다", {
                  duration: 1500,
                  position: "bottom-center",
                });
              } else {
                deleteSelected();
              }
            }
          } else if (shortcut.action === "undo") {
            handleUndo();
          } else if (shortcut.action === "redo") {
            handleRedo();
          }

          return;
        }
      }

      // Nudge with arrows (not in shortcuts config for simplicity)
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (selectedIds.length === 0) return;
        e.preventDefault();

        if (isSelectionLocked()) {
          toast.error("잠긴 요소는 이동할 수 없습니다", {
            duration: 1500,
            position: "bottom-center",
          });
          return;
        }

        const amount = e.shiftKey ? 10 : 1;
        const delta: { x?: number; y?: number } =
          {
            ArrowUp: { y: -amount },
            ArrowDown: { y: amount },
            ArrowLeft: { x: -amount },
            ArrowRight: { x: amount },
          }[e.key] ?? {};

        selectedIds.forEach((id) => {
          const obj = objects.find((o) => o.id === id);
          if (obj) {
            updateObject(id, {
              x: obj.x + (delta.x ?? 0),
              y: obj.y + (delta.y ?? 0),
            });
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedIds,
    deleteSelected,
    setTool,
    setSelectedIds,
    clearSelection,
    updateObject,
    addObject,
    objects,
    groups,
    shortcuts,
    editingTextId,
    isLocked,
    setLocked,
    addSnapshot,
    currentPageId,
    setShowShapesPanel,
    copyObjects,
    pasteObjects,
    pasteAndReplace,
    bringToFront,
    sendToBack,
    lockObjects,
    unlockObjects,
    unlockAllObjects,
    toggleHideCaptions,
    toggleHideUI,
    viewport,
    groupSelected,
    ungroupSelected,
    updateGroup,
    activeEditor,
    setEditingTextId,
    setPendingTextInput,
    handleUndo,
    handleRedo,
    selectedTableCells,
    deleteSelectedTableCells,
    clearSelectedTableCells,
    editingTableCell,
    isCapturing,
  ]);
}
