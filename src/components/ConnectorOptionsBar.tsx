import { useState, useMemo, useRef, useCallback } from "react";
import { Minus, Diamond, Circle as CircleIcon, Type } from "lucide-react";

// Custom open arrow icon (matches actual rendered marker - chevron shape)
const OpenArrowIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="9,6 15,12 9,18" />
  </svg>
);

// Custom filled triangle arrow icon (matches actual rendered marker)
const FilledArrowIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <polygon points="8,6 18,12 8,18" />
  </svg>
);
import { cn } from "@/lib/utils";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import { useGlobalCustomColors } from "@/hooks/useCustomColors";
import type { CanvasObject, MarkerStyle, LineStyle, PathStyle } from "@/types";

interface ConnectorOptionsBarProps {
  connector: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  startPoint: { x: number; y: number }; // 실제 시작점 좌표
  endPoint: { x: number; y: number }; // 실제 끝점 좌표
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onStartTextEdit: () => void;
}

const MARKER_OPTIONS: {
  id: MarkerStyle;
  icon: React.ElementType;
  label: string;
}[] = [
  { id: "none", icon: Minus, label: "None" },
  { id: "arrow", icon: OpenArrowIcon, label: "Arrow" },
  { id: "filledArrow", icon: FilledArrowIcon, label: "Filled" },
  { id: "diamond", icon: Diamond, label: "Diamond" },
  { id: "circle", icon: CircleIcon, label: "Circle" },
];

const LINE_STYLE_OPTIONS: { id: LineStyle; label: string; dash: number[] }[] = [
  { id: "solid", label: "Solid", dash: [] },
  { id: "dashed", label: "Dashed", dash: [10, 5] },
  { id: "dotted", label: "Dotted", dash: [2, 4] },
];

const STROKE_WIDTH_OPTIONS: { id: number; label: string }[] = [
  { id: 1, label: "1px" },
  { id: 2, label: "2px" },
  { id: 4, label: "4px" },
];

// Custom SVG Icons for path styles
const StraightLineIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    className="text-white"
  >
    <path
      fill="currentColor"
      fillOpacity=".9"
      fillRule="evenodd"
      d="M23.59.146c.195.196.195.512 0 .708L.854 23.59c-.196.195-.512.195-.708 0-.195-.195-.195-.512 0-.707L22.883.146c.195-.195.512-.195.707 0"
      clipRule="evenodd"
    />
  </svg>
);

const StraightArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    className="text-white"
  >
    <path
      fill="currentColor"
      fillOpacity=".9"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth="0.5"
      d="M16.92 0c-.275 0-.5.224-.5.5 0 .276.225.5.5.5h5.11L.146 22.883c-.195.196-.195.512 0 .707.196.196.512.196.708 0L22.737 1.707v5.109c0 .276.224.5.5.5.276 0 .5-.224.5-.5V.497c-.002-.275-.225-.497-.5-.497z"
      clipRule="evenodd"
    />
  </svg>
);

const ElbowSharpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="22"
    viewBox="0 0 22 26"
    className="text-white"
  >
    <path
      fill="currentColor"
      fillOpacity=".9"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth="0.3"
      d="M17.236.646c.196-.195.512-.195.707 0l3.7 3.7c.412.412.412 1.079 0 1.49l-3.7 3.7c-.195.195-.511.195-.707 0-.195-.195-.195-.512 0-.707l3.237-3.237h-6.06c-1.556 0-2.818 1.262-2.818 2.818v13.272c0 2.109-1.709 3.818-3.818 3.818H1c-.276 0-.5-.224-.5-.5 0-.276.224-.5.5-.5h6.777c1.557 0 2.818-1.262 2.818-2.818V8.41c0-2.109 1.71-3.818 3.818-3.818h6.062l-3.239-3.238c-.195-.196-.195-.512 0-.708Z"
      clipRule="evenodd"
    />
  </svg>
);

const ElbowRoundedIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="22"
    viewBox="0 0 25 26"
    className="text-white"
  >
    <path
      fill="currentColor"
      d="M19.598.594c-.225-.161-.537-.11-.698.115-.16.224-.11.537.115.697zm4.147 3.585.29-.407zm.103.942-.378-.328zm-4.009 3.86c-.18.208-.158.524.05.705.209.18.525.158.706-.05zM1 24.5c-.276 0-.5.224-.5.5 0 .276.224.5.5.5zM19.015 1.406l4.438 3.18.583-.814L19.598.594zm4.455 3.387L19.839 8.98l.756.656 3.63-4.188zm-.017-.208c.017.012.04.042.046.094.006.053-.01.093-.03.114l.756.655c.428-.493.35-1.29-.19-1.676zM1 25.5c3.66 0 5.942-1.316 7.526-3.318 1.548-1.955 2.412-4.552 3.32-7.02.924-2.51 1.898-4.916 3.635-6.708 1.712-1.765 4.21-2.976 8.282-2.976v-1c-4.297 0-7.07 1.29-9 3.28-1.903 1.963-2.937 4.562-3.855 7.058-.933 2.537-1.742 4.946-3.166 6.745C6.356 23.313 4.37 24.5 1 24.5z"
    />
  </svg>
);

// Path style options with combined pathStyle + elbowCornerStyle
interface PathStyleOption {
  id: string;
  pathStyle: PathStyle;
  elbowCornerStyle?: "sharp" | "rounded";
  setArrow?: boolean; // 화살표 자동 설정 여부
  clearMarkers?: boolean; // 마커 제거 여부 (직선)
  icon: React.FC;
  label: string;
}

const PATH_STYLE_OPTIONS: PathStyleOption[] = [
  {
    id: "straight",
    pathStyle: "straight",
    clearMarkers: true, // 마커 제거 (직선)
    icon: StraightLineIcon,
    label: "Straight",
  },
  {
    id: "straightArrow",
    pathStyle: "straight",
    setArrow: true, // 끝 화살표 설정
    icon: StraightArrowIcon,
    label: "Arrow",
  },
  {
    id: "elbowedSharp",
    pathStyle: "elbowed",
    elbowCornerStyle: "sharp",
    icon: ElbowSharpIcon,
    label: "Elbow Sharp",
  },
  {
    id: "elbowedRounded",
    pathStyle: "elbowed",
    elbowCornerStyle: "rounded",
    icon: ElbowRoundedIcon,
    label: "Elbow Rounded",
  },
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

export function ConnectorOptionsBar({
  connector,
  position,
  startPoint: _startPoint,
  endPoint: _endPoint,
  onUpdate,
  onStartTextEdit,
}: ConnectorOptionsBarProps) {
  const [showStartMarker, setShowStartMarker] = useState(false);
  const [showEndMarker, setShowEndMarker] = useState(false);
  const [showLineStyle, setShowLineStyle] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showPathStyle, setShowPathStyle] = useState(false);
  // 드롭다운 버튼 refs (화면 경계 체크용)
  const dropdownButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  // 드롭다운이 위로 열려야 하는지 여부
  const [dropdownAbove, setDropdownAbove] = useState(false);
  // 커스텀 컬러 피커 상태
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  // 커스텀 색상 히스토리
  const { customColors, addIfNotInPalette } = useGlobalCustomColors();

  const currentStartMarker = connector.startMarker ?? "none";
  const currentEndMarker = connector.endMarker ?? "arrow";
  const currentLineStyle = connector.lineStyle ?? "solid";
  const currentStrokeWidth = connector.strokeWidth ?? 2;
  const currentPathStyle = connector.pathStyle ?? "straight";
  const currentElbowCornerStyle = connector.elbowCornerStyle ?? "sharp";

  // 현재 선택된 path style option ID 계산
  const currentPathOptionId = useMemo(() => {
    if (currentPathStyle === "elbowed") {
      return currentElbowCornerStyle === "rounded"
        ? "elbowedRounded"
        : "elbowedSharp";
    }
    // straight인 경우, 화살표가 있으면 straightArrow
    if (
      currentPathStyle === "straight" &&
      currentEndMarker !== "none" &&
      currentStartMarker === "none"
    ) {
      return "straightArrow";
    }
    return "straight";
  }, [
    currentPathStyle,
    currentElbowCornerStyle,
    currentEndMarker,
    currentStartMarker,
  ]);

  const closeAllDropdowns = useCallback(() => {
    setShowStartMarker(false);
    setShowEndMarker(false);
    setShowLineStyle(false);
    setShowColorPalette(false);
    setShowPathStyle(false);
  }, []);

  // 드롭다운 열기 시 화면 경계 체크
  const openDropdown = useCallback(
    (panel: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      closeAllDropdowns();
      const buttonEl = dropdownButtonRefs.current[panel];
      if (buttonEl) {
        const rect = buttonEl.getBoundingClientRect();
        const dropdownHeight = 150; // 예상 드롭다운 높이
        const spaceBelow = window.innerHeight - rect.bottom;
        setDropdownAbove(spaceBelow < dropdownHeight);
      }
      setter(true);
    },
    [closeAllDropdowns],
  );

  return (
    <div
      className="fixed z-[200]"
      style={{
        left: position.x,
        top: position.y,
        transform: getOptionsBarTransform({
          x: position.x,
          y: position.y,
          above: position.above ?? false,
          align: position.align ?? "center",
        }),
      }}
      // Prevent blur on editor when clicking options bar
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Main Options Bar */}
      <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
        {/* Color indicator */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["colorPalette"] = el;
          }}
          onClick={() => {
            if (showColorPalette) {
              setShowColorPalette(false);
            } else {
              openDropdown("colorPalette", setShowColorPalette);
            }
          }}
          className={cn(
            "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
            showColorPalette ? "border-white" : "border-gray-600",
          )}
          style={{ backgroundColor: connector.stroke ?? "#374151" }}
          title="색상"
        />

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Text */}
        {/* Text button - only show when no label exists */}
        {!connector.labelTextBoxId && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeAllDropdowns();
                onStartTextEdit();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn("rounded p-2 transition-all", "hover:bg-gray-700")}
              title="Add Text"
            >
              <Type className="h-5 w-5 text-white" />
            </button>

            <div className="mx-1 h-6 w-px bg-gray-600" />
          </>
        )}

        {/* Start Marker */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["startMarker"] = el;
          }}
          onClick={() => {
            if (showStartMarker) {
              setShowStartMarker(false);
            } else {
              openDropdown("startMarker", setShowStartMarker);
            }
          }}
          className={cn(
            "flex items-center gap-1 rounded p-2 transition-all",
            "hover:bg-gray-700",
            showStartMarker && "bg-gray-700",
          )}
          title="Start Marker"
        >
          {(() => {
            const MarkerIcon =
              MARKER_OPTIONS.find((m) => m.id === currentStartMarker)?.icon ??
              Minus;
            return (
              <div className="relative">
                <MarkerIcon className="h-4 w-4 text-white" />
                <span className="absolute -top-1 -right-1 text-[8px] font-bold text-white/80">
                  S
                </span>
              </div>
            );
          })()}
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        {/* End Marker */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["endMarker"] = el;
          }}
          onClick={() => {
            if (showEndMarker) {
              setShowEndMarker(false);
            } else {
              openDropdown("endMarker", setShowEndMarker);
            }
          }}
          className={cn(
            "flex items-center gap-1 rounded p-2 transition-all",
            "hover:bg-gray-700",
            showEndMarker && "bg-gray-700",
          )}
          title="End Marker"
        >
          {(() => {
            const MarkerIcon =
              MARKER_OPTIONS.find((m) => m.id === currentEndMarker)?.icon ??
              OpenArrowIcon;
            return (
              <div className="relative">
                <MarkerIcon className="h-4 w-4 text-white" />
                <span className="absolute -top-1 -right-1 text-[8px] font-bold text-white/80">
                  E
                </span>
              </div>
            );
          })()}
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Line Style */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["lineStyle"] = el;
          }}
          onClick={() => {
            if (showLineStyle) {
              setShowLineStyle(false);
            } else {
              openDropdown("lineStyle", setShowLineStyle);
            }
          }}
          className={cn(
            "flex items-center gap-1 rounded p-2 transition-all",
            "hover:bg-gray-700",
            showLineStyle && "bg-gray-700",
          )}
          title="선 스타일"
        >
          <svg width="20" height="4" viewBox="0 0 20 4">
            <line
              x1="0"
              y1="2"
              x2="20"
              y2="2"
              stroke="white"
              strokeWidth="2"
              strokeDasharray={
                LINE_STYLE_OPTIONS.find(
                  (l) => l.id === currentLineStyle,
                )?.dash.join(",") ?? ""
              }
            />
          </svg>
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        {/* Path Style (Straight/Elbowed/Curved) */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["pathStyle"] = el;
          }}
          onClick={() => {
            if (showPathStyle) {
              setShowPathStyle(false);
            } else {
              openDropdown("pathStyle", setShowPathStyle);
            }
          }}
          className={cn(
            "flex items-center gap-1 rounded p-2 transition-all",
            "hover:bg-gray-700",
            showPathStyle && "bg-gray-700",
          )}
          title="Path Style"
        >
          {(() => {
            const PathIcon =
              PATH_STYLE_OPTIONS.find((p) => p.id === currentPathOptionId)
                ?.icon ?? StraightLineIcon;
            return <PathIcon />;
          })()}
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
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
        {/* Path Style Dropdown */}
        {showPathStyle && (
          <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {PATH_STYLE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    const updates: Partial<CanvasObject> = {
                      pathStyle: option.pathStyle,
                    };
                    // elbowCornerStyle 설정
                    if (option.elbowCornerStyle) {
                      updates.elbowCornerStyle = option.elbowCornerStyle;
                    }
                    // 화살표 자동 설정
                    if (option.setArrow) {
                      updates.startMarker = "none";
                      updates.endMarker = "arrow";
                    }
                    // 마커 제거 (직선)
                    if (option.clearMarkers) {
                      updates.startMarker = "none";
                      updates.endMarker = "none";
                    }
                    onUpdate(updates);
                    setShowPathStyle(false);
                  }}
                  className={cn(
                    "rounded p-2 transition-all",
                    "hover:bg-gray-700",
                    currentPathOptionId === option.id && "bg-violet-600",
                  )}
                  title={option.label}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
        )}

        {/* Color Palette Dropdown */}
        {showColorPalette && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Custom colors history */}
            {customColors.length > 0 && (
              <div className="mb-2 border-b border-gray-700 pb-2">
                <div className="mb-1.5 text-xs text-gray-400">최근 사용</div>
                <div className="flex gap-1.5">
                  {customColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        onUpdate({ stroke: color });
                        setShowColorPalette(false);
                      }}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        connector.stroke?.toLowerCase() === color.toLowerCase()
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
                  onClick={() => {
                    onUpdate({ stroke: color });
                    setShowColorPalette(false);
                  }}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    connector.stroke === color
                      ? "scale-110 border-white"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              {/* Custom color picker */}
              <CustomColorButton
                onClick={() => setShowCustomPicker(!showCustomPicker)}
                isActive={showCustomPicker}
              />
            </div>
            {/* Custom Color Picker Popup */}
            {showCustomPicker && (
              <ColorPickerPopup
                currentColor={connector.stroke ?? "#6b7280"}
                onApply={(color) => {
                  onUpdate({ stroke: color });
                  addIfNotInPalette(color, STROKE_COLORS);
                  setShowColorPalette(false);
                }}
                onClose={() => setShowCustomPicker(false)}
              />
            )}
          </div>
        )}

        {/* Marker Dropdowns - Start */}
        {showStartMarker && (
          <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {MARKER_OPTIONS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => {
                  onUpdate({ startMarker: id });
                  setShowStartMarker(false);
                }}
                className={cn(
                  "rounded p-2 transition-all",
                  "hover:bg-gray-700",
                  currentStartMarker === id && "bg-violet-600",
                )}
                title={label}
              >
                <Icon className="h-5 w-5 text-white" />
              </button>
            ))}
          </div>
        )}

        {showEndMarker && (
          <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {MARKER_OPTIONS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => {
                  onUpdate({ endMarker: id });
                  setShowEndMarker(false);
                }}
                className={cn(
                  "rounded p-2 transition-all",
                  "hover:bg-gray-700",
                  currentEndMarker === id && "bg-violet-600",
                )}
                title={label}
              >
                <Icon className="h-5 w-5 text-white" />
              </button>
            ))}
          </div>
        )}

        {/* Line Style Dropdown */}
        {showLineStyle && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Stroke Width - Line icons */}
            <div className="mb-3 flex items-center gap-2">
              {STROKE_WIDTH_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onUpdate({ strokeWidth: id })}
                  className={cn(
                    "rounded p-1.5 transition-all",
                    "hover:bg-gray-700",
                    currentStrokeWidth === id && "bg-violet-600",
                  )}
                  title={label}
                >
                  <svg width="24" height="16" viewBox="0 0 24 16">
                    <line
                      x1="2"
                      y1="8"
                      x2="22"
                      y2="8"
                      stroke="white"
                      strokeWidth={id}
                    />
                  </svg>
                </button>
              ))}
              {/* Custom input */}
              <div className="ml-2 flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={currentStrokeWidth}
                  onChange={(e) => {
                    const val = Math.max(
                      1,
                      Math.min(20, Number(e.target.value)),
                    );
                    onUpdate({ strokeWidth: val });
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-12 rounded border border-gray-600 bg-gray-700 px-1 py-0.5 text-center text-xs text-white focus:border-violet-500 focus:outline-none"
                />
                <span className="text-xs text-gray-400">px</span>
              </div>
            </div>
            <div className="mb-3 h-px w-full bg-gray-600" />
            {/* Line Style */}
            <div className="flex items-center gap-1">
              {LINE_STYLE_OPTIONS.map(({ id, label, dash }) => (
                <button
                  key={id}
                  onClick={() => {
                    onUpdate({ lineStyle: id });
                    setShowLineStyle(false);
                  }}
                  className={cn(
                    "min-w-[40px] rounded p-2 transition-all",
                    "hover:bg-gray-700",
                    currentLineStyle === id && "bg-violet-600",
                  )}
                  title={label}
                >
                  <svg width="24" height="4" viewBox="0 0 24 4">
                    <line
                      x1="0"
                      y1="2"
                      x2="24"
                      y2="2"
                      stroke="white"
                      strokeWidth="2"
                      strokeDasharray={dash.join(",")}
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
