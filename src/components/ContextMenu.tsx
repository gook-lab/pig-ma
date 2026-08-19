import { memo, useEffect, useRef } from "react";
import {
  Copy,
  ClipboardPaste,
  Replace,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  Lock,
  Unlock,
  MessageCircle,
  Eye,
  EyeOff,
  MessageSquare,
  Group,
  Ungroup,
  LayoutTemplate,
  Rows3,
  Columns3,
  PanelLeftOpen,
  PanelRightOpen,
  PanelTopOpen,
  PanelBottomOpen,
} from "lucide-react";
import { useCanvasStore } from "@/store";
import { cn } from "@/lib/utils";
import { getCellAtPosition } from "@/utils/table";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  hasSelection: boolean;
  canvasPosition: { x: number; y: number }; // 캔버스 좌표
  clickedObjectId: string | null; // 우클릭한 객체 ID (잠긴 객체 포함)
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  danger,
}: MenuItemProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
        disabled
          ? "cursor-not-allowed text-gray-500"
          : danger
            ? "text-red-400 hover:bg-red-500/20"
            : "text-gray-200 hover:bg-gray-700",
      )}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span className="w-4">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="ml-4 text-xs text-gray-500">{shortcut}</span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-gray-700" />;
}

export const ContextMenu = memo(function ContextMenu({
  x,
  y,
  onClose,
  hasSelection,
  canvasPosition,
  clickedObjectId,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    objects,
    selectedIds,
    clipboard,
    hideCaptions,
    hideUI,
    groups,
    copyObjects,
    pasteObjects,
    pasteAndReplace,
    deleteSelected,
    bringToFront,
    sendToBack,
    lockObjects,
    unlockObjects,
    unlockAllObjects,
    updateObject,
    updateGroup,
    toggleHideCaptions,
    toggleHideUI,
    groupSelected,
    ungroupSelected,
    saveGroupAsTemplate,
    deleteTableRow,
    deleteTableColumn,
    addTableRow,
    addTableColumn,
  } = useCanvasStore();

  // 선택된 객체들이 잠겨있는지 확인 (객체 잠금 + 그룹 잠금)
  const selectedObjects = objects.filter((obj) => selectedIds.includes(obj.id));

  // 선택된 객체들이 속한 그룹들 + __group: 가상 선택 마커에서 추출한 그룹
  const virtualGroupIds = selectedIds
    .filter((id) => id.startsWith("__group:"))
    .map((id) => id.replace("__group:", ""));
  const selectedGroupIds = [
    ...new Set([
      ...selectedObjects.map((o) => o.groupId).filter(Boolean),
      ...virtualGroupIds,
    ]),
  ];
  const selectedGroupObjects = groups.filter((g) =>
    selectedGroupIds.includes(g.id),
  );

  // 그룹 잠금 여부 체크
  const isInLockedGroup = selectedGroupObjects.some((g) => g.locked);
  const lockedGroupId = selectedGroupObjects.find((g) => g.locked)?.id;

  // 전체 잠금 상태 (객체 잠금 또는 그룹 잠금)
  const allLocked =
    selectedObjects.length > 0 &&
    (selectedObjects.every((obj) => obj.locked) || isInLockedGroup);
  const anyLocked =
    objects.some((obj) => obj.locked) || groups.some((g) => g.locked);

  // 그룹화 관련 상태
  const canGroup = selectedIds.length >= 2;
  // 선택된 모든 객체가 동일한 그룹에 완전히 속해있는지 확인
  const allInSameGroup =
    virtualGroupIds.length === 1 ||
    (selectedObjects.length > 0 &&
      selectedObjects.every(
        (obj) => obj.groupId && obj.groupId === selectedObjects[0]?.groupId,
      ));
  // 혼합 선택 (그룹 요소 + 개별 요소가 섞여있는 경우)
  const isMixedSelection =
    selectedObjects.some((obj) => obj.groupId) &&
    selectedObjects.some((obj) => !obj.groupId);

  // 클릭된 객체가 잠긴 상태인지 확인 (선택되지 않은 경우)
  const clickedObject = clickedObjectId
    ? objects.find((obj) => obj.id === clickedObjectId)
    : null;
  const clickedObjectGroup = clickedObject?.groupId
    ? groups.find((g) => g.id === clickedObject.groupId)
    : null;
  const isClickedObjectLocked =
    (clickedObject?.locked || clickedObjectGroup?.locked) &&
    !selectedIds.includes(clickedObjectId ?? "");

  // 테이블 선택 여부 확인
  const selectedTable =
    selectedIds.length === 1
      ? objects.find((o) => o.id === selectedIds[0] && o.type === "table")
      : null;
  const tableData = selectedTable?.tableData;
  const isTableLocked = selectedTable?.locked === true;
  const canDeleteTableRow = tableData && tableData.rowCount > 1;
  const canDeleteTableColumn = tableData && tableData.colCount > 1;

  // 테이블 셀 클릭 위치 계산
  const clickedCell =
    selectedTable && tableData
      ? (() => {
          // 테이블 내 로컬 좌표 계산
          const localX = canvasPosition.x - selectedTable.x;
          const localY = canvasPosition.y - selectedTable.y;
          return getCellAtPosition(tableData, localX, localY);
        })()
      : null;

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // 메뉴 위치 조정 (화면 밖으로 나가지 않도록)
  const adjustedPosition = {
    x: Math.min(x, window.innerWidth - 220),
    y: Math.min(y, window.innerHeight - 400),
  };

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const cmdKey = isMac ? "⌘" : "Ctrl+";

  const handleCopy = () => {
    copyObjects();
    onClose();
  };

  const handlePaste = () => {
    pasteObjects(canvasPosition.x, canvasPosition.y);
    onClose();
  };

  const handlePasteAndReplace = () => {
    pasteAndReplace(canvasPosition.x, canvasPosition.y);
    onClose();
  };

  const handleDelete = () => {
    deleteSelected();
    onClose();
  };

  const handleBringToFront = () => {
    bringToFront();
    onClose();
  };

  const handleSendToBack = () => {
    sendToBack();
    onClose();
  };

  const handleLock = () => {
    if (allLocked) {
      // 잠금 해제
      if (lockedGroupId) {
        updateGroup(lockedGroupId, { locked: false });
      } else {
        unlockObjects();
      }
    } else {
      // 잠금 - 그룹에 속해있으면 그룹 전체 잠금
      if (selectedGroupIds.length === 1 && selectedGroupIds[0]) {
        updateGroup(selectedGroupIds[0], { locked: true });
      } else {
        lockObjects();
      }
    }
    onClose();
  };

  const handleUnlockAll = () => {
    unlockAllObjects();
    onClose();
  };

  const handleUnlockClickedObject = () => {
    if (clickedObjectId) {
      // 그룹 잠금인 경우 그룹 해제
      if (clickedObjectGroup?.locked) {
        updateGroup(clickedObjectGroup.id, { locked: false });
      } else {
        updateObject(clickedObjectId, { locked: false });
      }
    }
    onClose();
  };

  // 잠긴 그룹 해제 (선택된 객체가 속한 그룹)
  const handleUnlockGroup = () => {
    if (lockedGroupId) {
      updateGroup(lockedGroupId, { locked: false });
    }
    onClose();
  };

  const handleCursorChat = () => {
    // 커서 채팅 시작 (기존 / 단축키 동작과 동일)
    const event = new KeyboardEvent("keydown", { key: "/" });
    window.dispatchEvent(event);
    onClose();
  };

  const handleToggleCaptions = () => {
    toggleHideCaptions();
    onClose();
  };

  const handleToggleUI = () => {
    toggleHideUI();
    onClose();
  };

  const handleGroup = () => {
    groupSelected();
    onClose();
  };

  const handleUngroup = () => {
    ungroupSelected();
    onClose();
  };

  const handleSaveAsTemplate = () => {
    if (selectedGroupIds.length === 1 && selectedGroupIds[0]) {
      saveGroupAsTemplate(selectedGroupIds[0]);
    }
    onClose();
  };

  const handleDeleteTableRow = () => {
    if (selectedTable && tableData && canDeleteTableRow) {
      deleteTableRow(selectedTable.id, tableData.rowCount - 1);
    }
    onClose();
  };

  const handleDeleteTableColumn = () => {
    if (selectedTable && tableData && canDeleteTableColumn) {
      deleteTableColumn(selectedTable.id, tableData.colCount - 1);
    }
    onClose();
  };

  const handleAddColumnLeft = () => {
    if (selectedTable && clickedCell) {
      // 현재 열 왼쪽에 추가 = 현재 열 인덱스 - 1 (afterIndex)
      addTableColumn(selectedTable.id, clickedCell.col - 1);
    }
    onClose();
  };

  const handleAddColumnRight = () => {
    if (selectedTable && clickedCell) {
      // 현재 열 오른쪽에 추가 = 현재 열 인덱스 (afterIndex)
      addTableColumn(selectedTable.id, clickedCell.col);
    }
    onClose();
  };

  const handleAddRowAbove = () => {
    if (selectedTable && clickedCell) {
      // 현재 행 위에 추가 = 현재 행 인덱스 - 1 (afterIndex)
      addTableRow(selectedTable.id, clickedCell.row - 1);
    }
    onClose();
  };

  const handleAddRowBelow = () => {
    if (selectedTable && clickedCell) {
      // 현재 행 아래에 추가 = 현재 행 인덱스 (afterIndex)
      addTableRow(selectedTable.id, clickedCell.row);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[200px] overflow-hidden rounded-lg bg-gray-800 py-1 shadow-xl"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {hasSelection ? (
        // 선택된 객체가 있을 때 메뉴
        isTableLocked ? (
          // 잠긴 테이블인 경우: 잠금 해제만 표시
          <MenuItem
            icon={<Unlock size={14} />}
            label="잠금 해제"
            shortcut={`⇧${cmdKey}L`}
            onClick={handleLock}
          />
        ) : isInLockedGroup ? (
          // 잠긴 그룹에 속한 객체인 경우: 잠금 해제만 활성화
          <>
            <MenuItem
              icon={<Copy size={14} />}
              label="복사"
              shortcut={`${cmdKey}C`}
              onClick={handleCopy}
              disabled
            />
            <MenuItem
              icon={<ClipboardPaste size={14} />}
              label="붙여넣기"
              shortcut={`${cmdKey}V`}
              onClick={handlePaste}
              disabled
            />
            <MenuItem
              icon={<Replace size={14} />}
              label="붙여넣어 교체"
              shortcut={`⇧${cmdKey}R`}
              onClick={handlePasteAndReplace}
              disabled
            />

            <MenuDivider />

            <MenuItem
              icon={<Trash2 size={14} />}
              label="삭제"
              shortcut="⌫"
              onClick={handleDelete}
              disabled
              danger
            />

            <MenuDivider />

            <MenuItem
              icon={<ArrowUpToLine size={14} />}
              label="맨 앞으로 가져오기"
              shortcut="]"
              onClick={handleBringToFront}
              disabled
            />
            <MenuItem
              icon={<ArrowDownToLine size={14} />}
              label="맨 뒤로 보내기"
              shortcut="["
              onClick={handleSendToBack}
              disabled
            />

            <MenuDivider />

            {/* 잠금 해제만 활성화 */}
            <MenuItem
              icon={<Unlock size={14} />}
              label="섹션 잠금 해제"
              shortcut={`⇧${cmdKey}L`}
              onClick={handleUnlockGroup}
            />

            <MenuDivider />

            <MenuItem
              icon={<Ungroup size={14} />}
              label="그룹 해제"
              shortcut={`⇧${cmdKey}G`}
              onClick={handleUngroup}
              disabled
            />
          </>
        ) : (
          // 일반 선택 메뉴
          <>
            <MenuItem
              icon={<Copy size={14} />}
              label="복사"
              shortcut={`${cmdKey}C`}
              onClick={handleCopy}
              disabled={allLocked}
            />
            <MenuItem
              icon={<ClipboardPaste size={14} />}
              label="붙여넣기"
              shortcut={`${cmdKey}V`}
              onClick={handlePaste}
              disabled={clipboard.length === 0}
            />
            <MenuItem
              icon={<Replace size={14} />}
              label="붙여넣어 교체"
              shortcut={`⇧${cmdKey}R`}
              onClick={handlePasteAndReplace}
              disabled={clipboard.length === 0 || allLocked}
            />

            <MenuDivider />

            <MenuItem
              icon={<Trash2 size={14} />}
              label="삭제"
              shortcut="⌫"
              onClick={handleDelete}
              disabled={allLocked}
              danger
            />

            {/* 테이블 행/열 추가/삭제 메뉴 */}
            {selectedTable && clickedCell && (
              <>
                <MenuDivider />
                <MenuItem
                  icon={<PanelLeftOpen size={14} />}
                  label="왼쪽에 열 추가"
                  onClick={handleAddColumnLeft}
                  disabled={allLocked}
                />
                <MenuItem
                  icon={<PanelRightOpen size={14} />}
                  label="오른쪽에 열 추가"
                  onClick={handleAddColumnRight}
                  disabled={allLocked}
                />
                <MenuItem
                  icon={<PanelTopOpen size={14} />}
                  label="위에 행 추가"
                  onClick={handleAddRowAbove}
                  disabled={allLocked}
                />
                <MenuItem
                  icon={<PanelBottomOpen size={14} />}
                  label="아래에 행 추가"
                  onClick={handleAddRowBelow}
                  disabled={allLocked}
                />
                <MenuDivider />
                <MenuItem
                  icon={<Rows3 size={14} />}
                  label="마지막 행 삭제"
                  onClick={handleDeleteTableRow}
                  disabled={!canDeleteTableRow || allLocked}
                />
                <MenuItem
                  icon={<Columns3 size={14} />}
                  label="마지막 열 삭제"
                  onClick={handleDeleteTableColumn}
                  disabled={!canDeleteTableColumn || allLocked}
                />
              </>
            )}
            {/* 테이블 선택되었지만 셀 외부 클릭 시 */}
            {selectedTable && !clickedCell && (
              <>
                <MenuDivider />
                <MenuItem
                  icon={<Rows3 size={14} />}
                  label="마지막 행 삭제"
                  onClick={handleDeleteTableRow}
                  disabled={!canDeleteTableRow || allLocked}
                />
                <MenuItem
                  icon={<Columns3 size={14} />}
                  label="마지막 열 삭제"
                  onClick={handleDeleteTableColumn}
                  disabled={!canDeleteTableColumn || allLocked}
                />
              </>
            )}

            <MenuDivider />

            <MenuItem
              icon={<ArrowUpToLine size={14} />}
              label="맨 앞으로 가져오기"
              shortcut="]"
              onClick={handleBringToFront}
              disabled={allLocked}
            />
            <MenuItem
              icon={<ArrowDownToLine size={14} />}
              label="맨 뒤로 보내기"
              shortcut="["
              onClick={handleSendToBack}
              disabled={allLocked}
            />

            <MenuDivider />

            {/* 잠금 (혼합 선택이 아닐 때만) */}
            {!isMixedSelection && (
              <MenuItem
                icon={allLocked ? <Unlock size={14} /> : <Lock size={14} />}
                label={allLocked ? "잠금 해제" : "잠금"}
                shortcut={`⇧${cmdKey}L`}
                onClick={handleLock}
              />
            )}

            <MenuDivider />

            {/* 그룹화 (2개 이상 선택 시, 모두 같은 그룹이 아닐 때) */}
            {canGroup && !allInSameGroup && (
              <MenuItem
                icon={<Group size={14} />}
                label="그룹화"
                shortcut={`${cmdKey}G`}
                onClick={handleGroup}
                disabled={allLocked}
              />
            )}

            {/* 그룹 해제 (모두 같은 그룹에 속한 경우만) */}
            {allInSameGroup && (
              <MenuItem
                icon={<Ungroup size={14} />}
                label="그룹 해제"
                shortcut={`⇧${cmdKey}G`}
                onClick={handleUngroup}
                disabled={allLocked}
              />
            )}

            {/* 템플릿 만들기 (그룹/섹션 선택 시) */}
            {allInSameGroup && selectedGroupIds.length === 1 && (
              <>
                <MenuDivider />
                <MenuItem
                  icon={<LayoutTemplate size={14} />}
                  label="템플릿 만들기"
                  onClick={handleSaveAsTemplate}
                  disabled={allLocked}
                />
              </>
            )}
          </>
        )
      ) : isClickedObjectLocked ? (
        // 잠긴 객체를 우클릭했을 때 메뉴
        <MenuItem
          icon={<Unlock size={14} />}
          label="잠금 해제"
          onClick={handleUnlockClickedObject}
        />
      ) : (
        // 선택된 객체가 없을 때 메뉴 (캔버스 우클릭)
        <>
          <MenuItem
            icon={<ClipboardPaste size={14} />}
            label="붙여넣기"
            shortcut={`${cmdKey}V`}
            onClick={handlePaste}
            disabled={clipboard.length === 0}
          />

          {anyLocked && (
            <>
              <MenuDivider />
              <MenuItem
                icon={<Unlock size={14} />}
                label="모든 개체 잠금 해제"
                shortcut={`⌥⇧${cmdKey}L`}
                onClick={handleUnlockAll}
              />
            </>
          )}

          <MenuDivider />

          <MenuItem
            icon={<MessageCircle size={14} />}
            label="커서 채팅"
            shortcut="/"
            onClick={handleCursorChat}
          />

          <MenuDivider />

          <MenuItem
            icon={hideUI ? <Eye size={14} /> : <EyeOff size={14} />}
            label={hideUI ? "UI 표시" : "UI 숨기기"}
            shortcut={`${cmdKey}/`}
            onClick={handleToggleUI}
          />
          <MenuItem
            icon={
              hideCaptions ? <MessageSquare size={14} /> : <EyeOff size={14} />
            }
            label={hideCaptions ? "댓글 표시" : "댓글 숨기기"}
            shortcut={`${cmdKey}C`}
            onClick={handleToggleCaptions}
          />
        </>
      )}
    </div>
  );
});
