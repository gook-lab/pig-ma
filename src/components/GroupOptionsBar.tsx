import { useState, useRef, useCallback } from "react";
import { Eye, EyeOff, Lock, Unlock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import { useGlobalCustomColors } from "@/hooks/useCustomColors";
import type { GroupInfo, LineStyle } from "@/types";

interface GroupOptionsBarProps {
  group: GroupInfo;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  onUpdate: (updates: Partial<GroupInfo>) => void;
}

// Color palettes
const FILL_COLORS = [
  "transparent",
  "#fef3c7", // yellow-100
  "#dcfce7", // green-100
  "#dbeafe", // blue-100
  "#fce7f3", // pink-100
  "#f3e8ff", // purple-100
  "#e0e7ff", // indigo-100
  "#fed7aa", // orange-100
];

// 17개 색상 + 커스텀 = 18개 (9열 x 2줄)
const STROKE_COLORS = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#d1d5db",
  "#fca5a5",
  "#fdba74",
  "#fde047",
  "#86efac",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
];

// Tag/Text colors - 8개 + 커스텀 = 9개 (1줄)
const TAG_COLORS = [
  "#000000",
  "#374151",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

export function GroupOptionsBar({
  group,
  position,
  onUpdate,
}: GroupOptionsBarProps) {
  const [activePanel, setActivePanel] = useState<
    "fill" | "stroke" | "name" | "tag" | null
  >(null);
  const [editingName, setEditingName] = useState(group.name);
  // 드롭다운 버튼 refs (화면 경계 체크용)
  const dropdownButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  // 드롭다운이 위로 열려야 하는지 여부
  const [dropdownAbove, setDropdownAbove] = useState(false);
  // 커스텀 컬러 피커 상태
  const [showCustomPicker, setShowCustomPicker] = useState<
    "fill" | "stroke" | "tag" | null
  >(null);
  // 커스텀 색상 히스토리
  const { customColors, addIfNotInPalette } = useGlobalCustomColors();

  const currentFill = group.fill ?? "transparent";
  const currentStroke = group.stroke ?? "transparent";
  const currentLineStyle = group.lineStyle ?? "solid";
  const currentTagColor = group.tagColor ?? "#374151";
  const isHidden = group.hidden ?? false;
  const isLocked = group.locked ?? false;

  const togglePanel = useCallback(
    (panel: "fill" | "stroke" | "name" | "tag") => {
      // 잠긴 경우 패널 열지 않음
      if (isLocked) return;
      // 경계 측정과 setDropdownAbove 는 업데이터 **밖**에서 한다.
      // React 는 업데이터를 두 번 이상 실행할 수 있어서, 안에 두면 중첩
      // setState 가 반복되거나 일관되지 않은 외부 상태를 읽는다.
      // 닫히는 경우에 계산해 둬도 해가 없다 — 열려 있을 때만 쓰이는 값이다.
      const buttonEl = dropdownButtonRefs.current[panel];
      if (buttonEl) {
        const rect = buttonEl.getBoundingClientRect();
        const dropdownHeight = 200; // 예상 드롭다운 높이
        const spaceBelow = window.innerHeight - rect.bottom;
        // 아래 공간이 부족하면 위로 표시
        setDropdownAbove(spaceBelow < dropdownHeight);
      }
      setActivePanel((prev) => (prev === panel ? null : panel));
    },
    [isLocked],
  );

  const handleFillChange = (color: string) => {
    onUpdate({ fill: color === "transparent" ? undefined : color });
    setActivePanel(null);
  };

  const handleStrokeChange = (color: string) => {
    onUpdate({ stroke: color === "transparent" ? undefined : color });
    setActivePanel(null);
  };

  const handleStrokeStyleChange = (style: LineStyle | "none") => {
    if (style === "none") {
      onUpdate({ stroke: undefined, lineStyle: "solid" });
    } else {
      if (!currentStroke || currentStroke === "transparent") {
        onUpdate({ stroke: "#6b7280", lineStyle: style });
      } else {
        onUpdate({ lineStyle: style });
      }
    }
  };

  const handleNameSubmit = () => {
    if (editingName.trim()) {
      onUpdate({ name: editingName.trim() });
    }
    setActivePanel(null);
  };

  const handleTagColorChange = (color: string) => {
    onUpdate({ tagColor: color });
    setActivePanel(null);
  };

  const isStrokeNone = !currentStroke || currentStroke === "transparent";

  // 섹션(Group)은 항상 상단에 옵션바 배치
  return (
    <div
      className="fixed z-[200]"
      style={{
        left: position.x,
        top: position.y,
        transform: getOptionsBarTransform({
          x: position.x,
          y: position.y,
          above: position.above ?? true,
          align: position.align ?? "center",
        }),
      }}
      // Prevent blur on editor when clicking options bar
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Main Options Bar */}
      <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
        {/* Section Name */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["name"] = el;
          }}
          onClick={() => togglePanel("name")}
          disabled={isLocked}
          className={cn(
            "flex min-w-[60px] items-center gap-1 rounded px-2 py-1.5 text-sm transition-all",
            isLocked
              ? "cursor-not-allowed text-gray-500"
              : "text-white hover:bg-gray-700",
            activePanel === "name" && "bg-gray-700",
          )}
          title={isLocked ? "잠금 해제 후 변경 가능" : "섹션명 변경"}
        >
          <Pencil className="h-3 w-3" />
          <span className="max-w-[80px] truncate">{group.name}</span>
        </button>

        {/* Tag Color */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["tag"] = el;
          }}
          onClick={() => togglePanel("tag")}
          disabled={isLocked}
          className={cn(
            "flex items-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "tag" && "bg-gray-700",
          )}
          title={isLocked ? "잠금 해제 후 변경 가능" : "태그 색상"}
        >
          <div
            className="h-4 w-6 rounded border border-gray-500"
            style={{ backgroundColor: currentTagColor }}
          />
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Fill Color */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["fill"] = el;
          }}
          onClick={() => togglePanel("fill")}
          disabled={isLocked}
          className={cn(
            "flex items-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "fill" && "bg-gray-700",
          )}
          title={isLocked ? "잠금 해제 후 변경 가능" : "배경색"}
        >
          <div
            className="h-6 w-6 rounded border-2 border-gray-500"
            style={{
              backgroundColor:
                currentFill === "transparent" ? "transparent" : currentFill,
              backgroundImage:
                currentFill === "transparent"
                  ? "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)"
                  : undefined,
              backgroundSize:
                currentFill === "transparent" ? "6px 6px" : undefined,
              backgroundPosition:
                currentFill === "transparent" ? "0 0, 3px 3px" : undefined,
            }}
          />
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Stroke/Border */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["stroke"] = el;
          }}
          onClick={() => togglePanel("stroke")}
          disabled={isLocked}
          className={cn(
            "flex items-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "stroke" && "bg-gray-700",
          )}
          title={isLocked ? "잠금 해제 후 변경 가능" : "테두리"}
        >
          <div className="flex h-6 w-6 items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect
                x="2"
                y="2"
                width="16"
                height="16"
                rx="4"
                stroke={isStrokeNone ? "#6b7280" : currentStroke}
                strokeWidth="2"
                strokeDasharray={
                  currentLineStyle === "dashed"
                    ? "4,2"
                    : currentLineStyle === "dotted"
                      ? "2,2"
                      : undefined
                }
              />
            </svg>
          </div>
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Hide/Show Toggle */}
        <button
          onClick={() => !isLocked && onUpdate({ hidden: !isHidden })}
          disabled={isLocked}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            isHidden && !isLocked && "bg-amber-600",
          )}
          title={
            isLocked ? "잠금 해제 후 변경 가능" : isHidden ? "표시" : "숨기기"
          }
        >
          {isHidden ? (
            <Eye className="h-4 w-4 text-white" />
          ) : (
            <EyeOff className="h-4 w-4 text-white" />
          )}
        </button>

        {/* Lock/Unlock Toggle - 항상 활성화 */}
        <button
          onClick={() => onUpdate({ locked: !isLocked })}
          className={cn(
            "rounded p-2 transition-all",
            "hover:bg-gray-700",
            isLocked && "bg-red-600",
          )}
          title={isLocked ? "잠금 해제" : "잠금"}
        >
          {isLocked ? (
            <Lock className="h-4 w-4 text-white" />
          ) : (
            <Unlock className="h-4 w-4 text-white" />
          )}
        </button>
      </div>

      {/* Dropdown Panels - 메인바 기준 절대 위치 (메인바 위치 고정) */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        style={{
          top: dropdownAbove ? "auto" : "100%",
          bottom: dropdownAbove ? "100%" : "auto",
          marginTop: dropdownAbove ? 0 : 8,
          marginBottom: dropdownAbove ? 8 : 0,
        }}
      >
        {/* Name Edit Panel */}
        {activePanel === "name" && (
          <div className="flex items-center gap-2 rounded-lg bg-gray-800 p-2 shadow-lg">
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
              className="w-36 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
              placeholder="섹션명 입력"
              autoFocus
            />
            <button
              onClick={handleNameSubmit}
              className="rounded bg-violet-600 px-3 py-1 text-xs whitespace-nowrap text-white hover:bg-violet-700"
            >
              확인
            </button>
          </div>
        )}

        {/* Fill Panel */}
        {activePanel === "fill" && (
          <>
            <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
              {/* Custom colors history */}
              {customColors.length > 0 && (
                <div className="mb-2 border-b border-gray-700 pb-2">
                  <div className="mb-1.5 text-xs text-gray-400">최근 사용</div>
                  <div className="flex gap-1.5">
                    {customColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleFillChange(color)}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-transform",
                          currentFill.toLowerCase() === color.toLowerCase()
                            ? "scale-110 border-white"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1">
                {FILL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleFillChange(color)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      currentFill === color
                        ? "scale-110 border-white"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{
                      backgroundColor:
                        color === "transparent" ? "transparent" : color,
                      backgroundImage:
                        color === "transparent"
                          ? "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)"
                          : undefined,
                      backgroundSize:
                        color === "transparent" ? "6px 6px" : undefined,
                      backgroundPosition:
                        color === "transparent" ? "0 0, 3px 3px" : undefined,
                    }}
                    title={color === "transparent" ? "Transparent" : color}
                  />
                ))}
                {/* Custom color picker */}
                <CustomColorButton
                  onClick={() =>
                    setShowCustomPicker(
                      showCustomPicker === "fill" ? null : "fill",
                    )
                  }
                  isActive={showCustomPicker === "fill"}
                />
              </div>
              {/* Custom Color Picker Popup */}
              {showCustomPicker === "fill" && (
                <ColorPickerPopup
                  currentColor={
                    currentFill === "transparent" ? "#ffffff" : currentFill
                  }
                  onApply={(color) => {
                    handleFillChange(color);
                    addIfNotInPalette(color, FILL_COLORS);
                  }}
                  onClose={() => setShowCustomPicker(null)}
                />
              )}
            </div>
          </>
        )}

        {/* Stroke Panel */}
        {activePanel === "stroke" && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Stroke Style Tabs */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => handleStrokeStyleChange("solid")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm whitespace-nowrap transition-all",
                  !isStrokeNone && currentLineStyle === "solid"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <svg width="16" height="2" viewBox="0 0 16 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                Solid
              </button>
              <button
                onClick={() => handleStrokeStyleChange("dashed")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm whitespace-nowrap transition-all",
                  !isStrokeNone && currentLineStyle === "dashed"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <svg width="16" height="2" viewBox="0 0 16 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                  />
                </svg>
                Dashed
              </button>
              <button
                onClick={() => handleStrokeStyleChange("none")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm whitespace-nowrap transition-all",
                  isStrokeNone
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                None
              </button>
            </div>
            {/* Color Grid */}
            {!isStrokeNone && (
              <>
                {/* Custom colors history */}
                {customColors.length > 0 && (
                  <div className="mb-2 border-b border-gray-700 pb-2">
                    <div className="mb-1.5 text-xs text-gray-400">
                      최근 사용
                    </div>
                    <div className="flex gap-1.5">
                      {customColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleStrokeChange(color)}
                          className={cn(
                            "h-6 w-6 rounded-full border-2 transition-transform",
                            currentStroke.toLowerCase() === color.toLowerCase()
                              ? "scale-110 border-white"
                              : "border-transparent hover:scale-105",
                          )}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-9 gap-1.5">
                  {STROKE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleStrokeChange(color)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        currentStroke === color
                          ? "scale-110 border-white"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {/* Custom color picker */}
                  <CustomColorButton
                    onClick={() =>
                      setShowCustomPicker(
                        showCustomPicker === "stroke" ? null : "stroke",
                      )
                    }
                    isActive={showCustomPicker === "stroke"}
                  />
                </div>
              </>
            )}
            {/* Custom Color Picker Popup */}
            {showCustomPicker === "stroke" && (
              <ColorPickerPopup
                currentColor={currentStroke || "#6b7280"}
                onApply={(color) => {
                  handleStrokeChange(color);
                  addIfNotInPalette(color, STROKE_COLORS);
                }}
                onClose={() => setShowCustomPicker(null)}
              />
            )}
          </div>
        )}

        {/* Tag Color Panel */}
        {activePanel === "tag" && (
          <>
            <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
              {/* Custom colors history */}
              {customColors.length > 0 && (
                <div className="mb-2 border-b border-gray-700 pb-2">
                  <div className="mb-1.5 text-xs text-gray-400">최근 사용</div>
                  <div className="flex gap-1.5">
                    {customColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleTagColorChange(color)}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-transform",
                          currentTagColor.toLowerCase() === color.toLowerCase()
                            ? "scale-110 border-white"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleTagColorChange(color)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      currentTagColor === color
                        ? "scale-110 border-white"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                {/* Custom color picker */}
                <CustomColorButton
                  onClick={() =>
                    setShowCustomPicker(
                      showCustomPicker === "tag" ? null : "tag",
                    )
                  }
                  isActive={showCustomPicker === "tag"}
                />
              </div>
              {/* Custom Color Picker Popup */}
              {showCustomPicker === "tag" && (
                <ColorPickerPopup
                  currentColor={currentTagColor}
                  onApply={(color) => {
                    handleTagColorChange(color);
                    addIfNotInPalette(color, TAG_COLORS);
                  }}
                  onClose={() => setShowCustomPicker(null)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
