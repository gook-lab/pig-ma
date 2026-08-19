import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  X,
  ChevronDown,
  Plus,
  GripHorizontal,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import { useGlobalCustomColors } from "@/hooks/useCustomColors";
import { CHART_COLORS } from "@/constants/colors";
import type {
  CanvasObject,
  ChartDataItem,
  ChartSortBy,
  ChartLineStyle,
  LineSeriesStyle,
  SelectedPoint,
} from "@/types";
import {
  getSeriesData,
  addSeries,
  removeSeries,
  updateSeries,
  updateSeriesStyle,
  addXAxisPoint,
  updateSeriesPointValue,
  updateSeriesPointColor,
  updateSeriesPointShowLabel,
  updateSeriesPointShowValue,
  hideSeriesPoint,
} from "@/utils/chart";

// input 포커스 중 키보드 이벤트 전파 방지
const stopKeyPropagation = (e: KeyboardEvent) => {
  e.stopPropagation();
};

// input 포커스를 위해 마우스 이벤트 전파 방지
const stopMousePropagation = (e: ReactMouseEvent) => {
  e.stopPropagation();
};

interface ChartRightPanelProps {
  shape: CanvasObject;
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onClose: () => void;
}

type ChartTab = "data" | "settings";

// Settings tab color palette
const TEXT_COLORS = [
  "#374151",
  "#000000",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

// Series Value Input with local state and regex validation
function SeriesValueInput({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleChange = useCallback(
    (inputValue: string) => {
      if (inputValue === "") {
        setLocalValue("");
        return;
      }
      const regex = /^-?\d{0,8}(\.\d{0,1})?$/;
      if (regex.test(inputValue)) {
        setLocalValue(inputValue);
        const numValue = parseFloat(inputValue);
        if (!isNaN(numValue)) {
          onChange(numValue);
        }
      }
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    if (localValue === "" || isNaN(parseFloat(localValue))) {
      setLocalValue("0");
      onChange(0);
    }
  }, [localValue, onChange]);

  return (
    <div className="flex items-center gap-0.5">
      {label && <span className="text-[10px] text-gray-400">{label}:</span>}
      <input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={stopKeyPropagation}
        onMouseDown={stopMousePropagation}
        className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs dark:border-[#c0c1c4] dark:bg-white dark:text-gray-800 dark:caret-gray-800"
        maxLength={10}
      />
    </div>
  );
}

// Editable Text Input with select all on focus
function EditableTextInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        onChange(e.target.value);
      }}
      onFocus={(e) => e.target.select()}
      onKeyDown={stopKeyPropagation}
      onMouseDown={stopMousePropagation}
      placeholder={placeholder}
      className={cn(
        "w-full rounded border border-gray-200 px-2 py-1.5 text-xs dark:border-[#c0c1c4] dark:bg-white dark:text-gray-800 dark:caret-gray-800",
        className,
      )}
    />
  );
}

// Editable Number Input with local state (allows clearing)
function EditableNumberInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleChange = useCallback(
    (inputValue: string) => {
      // Allow empty string during editing
      if (inputValue === "" || inputValue === "-") {
        setLocalValue(inputValue);
        return;
      }
      // 정규식: 최대 8자리, 소수점 첫째자리까지만 허용
      const regex = /^-?\d{0,8}(\.\d{0,1})?$/;
      if (regex.test(inputValue)) {
        setLocalValue(inputValue);
        const numValue = parseFloat(inputValue);
        if (!isNaN(numValue)) {
          onChange(numValue);
        }
      }
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    const numValue = parseFloat(localValue);
    if (isNaN(numValue)) {
      setLocalValue(String(value));
    } else {
      setLocalValue(String(numValue));
      onChange(numValue);
    }
  }, [localValue, value, onChange]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={handleBlur}
      onKeyDown={stopKeyPropagation}
      onMouseDown={stopMousePropagation}
      className={cn(
        "w-full rounded border border-gray-200 px-2 py-1.5 text-xs dark:border-[#c0c1c4] dark:bg-white dark:text-gray-800 dark:caret-gray-800",
        className,
      )}
    />
  );
}

const SORT_OPTIONS: {
  value: ChartSortBy;
  label: string;
  shortLabel: string;
}[] = [
  { value: "none", label: "No sorting", shortLabel: "None" },
  { value: "value-desc", label: "Value (high to low)", shortLabel: "Val ↓" },
  { value: "value-asc", label: "Value (low to high)", shortLabel: "Val ↑" },
  { value: "label-asc", label: "Label (A to Z)", shortLabel: "A→Z" },
  { value: "label-desc", label: "Label (Z to A)", shortLabel: "Z→A" },
];

// 라인 스타일 옵션
const LINE_STYLE_OPTIONS: {
  id: ChartLineStyle;
  label: string;
  dash: number[];
}[] = [
  { id: "solid", label: "Solid", dash: [] },
  { id: "dashed", label: "Dashed", dash: [10, 5] },
  { id: "dotted", label: "Dotted", dash: [3, 4] },
];

// 라인 두께 옵션
const STROKE_WIDTH_OPTIONS = [1, 2, 3, 4];

// 개별 선택 모드 컨텐츠 컴포넌트
function IndividualOptionsContent({
  chartData,
  selectedItemIndex,
  selectedSeriesIndex,
  selectedPoint,
  selectedLegendIndex,
  seriesData,
  onUpdate,
  isLine,
  isBarChart,
}: {
  chartData: NonNullable<CanvasObject["chartData"]>;
  selectedItemIndex?: number;
  selectedSeriesIndex?: number;
  selectedPoint?: SelectedPoint;
  selectedLegendIndex?: number;
  seriesData: ReturnType<typeof getSeriesData>;
  onUpdate: (updates: Partial<CanvasObject>) => void;
  isLine: boolean;
  isBarChart: boolean;
}) {
  // Bar/Pie 아이템 선택 시
  if (selectedItemIndex !== undefined) {
    const item = chartData.items[selectedItemIndex];
    if (!item) return null;

    const globalColor = chartData.globalColor;
    // 실제 적용되는 색상: colorOverride가 true면 개별 색상, 아니면 globalColor 적용
    const displayColor = item.colorOverride
      ? item.color
      : (globalColor ?? item.color);
    const showLabel = item.showLabel ?? true;
    const showValue = item.showValue ?? true;
    const labelFontSize = item.labelFontSize ?? item.fontSize ?? 10;
    const valueFontSize = item.valueFontSize ?? item.fontSize ?? 10;
    const labelColor = item.labelColor ?? "#374151";
    const valueColor = item.valueColor ?? "#374151";
    const labelBold = item.labelBold ?? chartData.labelBold ?? false;
    const valueBold = item.valueBold ?? chartData.valueBold ?? false;
    const valueOffsetY = item.valueOffsetY ?? chartData.valueOffsetY ?? 0;
    const cornerRadius = item.cornerRadius ?? 2;
    const cornerPosition = item.cornerPosition ?? "top";
    const isPie = chartData.variant === "pie";

    const handleUpdateItem = (updates: Partial<ChartDataItem>) => {
      const newItems = [...chartData.items];
      newItems[selectedItemIndex] = {
        ...newItems[selectedItemIndex],
        ...updates,
      };
      onUpdate({ chartData: { ...chartData, items: newItems } });
    };

    return (
      <div className="space-y-3">
        {/* Fill Color Group */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-2.5">
          <label className="text-xs font-medium text-gray-700">Fill</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={displayColor}
              onChange={(e) =>
                handleUpdateItem({ color: e.target.value, colorOverride: true })
              }
              onMouseDown={stopMousePropagation}
              className="h-6 w-6 cursor-pointer rounded border border-gray-200"
            />
            <span className="text-[10px] text-gray-500">{displayColor}</span>
          </div>
        </div>

        {/* Label Group */}
        <div className="space-y-2 rounded-lg border border-gray-200 p-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">Label</label>
            <button
              onClick={() => handleUpdateItem({ showLabel: !showLabel })}
              className={cn(
                "relative h-5 w-9 rounded-full border transition-colors",
                showLabel
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300 bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                  showLabel && "translate-x-4",
                )}
              />
            </button>
          </div>
          <EditableTextInput
            value={item.label}
            onChange={(label) => handleUpdateItem({ label })}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Color</span>
              <input
                type="color"
                value={labelColor}
                onChange={(e) =>
                  handleUpdateItem({ labelColor: e.target.value })
                }
                onMouseDown={stopMousePropagation}
                className="h-5 w-5 cursor-pointer rounded border border-gray-200"
              />
              {item.labelColor && item.labelColor !== "#374151" && (
                <button
                  onClick={() => handleUpdateItem({ labelColor: undefined })}
                  className="text-gray-400 hover:text-gray-600"
                  title="Reset to default"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Size</span>
              <Slider
                min={2}
                max={16}
                value={[labelFontSize]}
                onValueChange={(v) => handleUpdateItem({ labelFontSize: v[0] })}
                onPointerDown={stopMousePropagation}
                className="w-14"
              />
              <span className="w-4 text-right text-[10px] text-gray-500">
                {labelFontSize}
              </span>
              {item.labelFontSize !== undefined &&
                item.labelFontSize !== 10 && (
                  <button
                    onClick={() =>
                      handleUpdateItem({ labelFontSize: undefined })
                    }
                    className="text-gray-400 hover:text-gray-600"
                    title="Reset to default"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">Bold</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleUpdateItem({ labelBold: !labelBold })}
                className={cn(
                  "rounded px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                  labelBold
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                )}
              >
                {labelBold ? "On" : "Off"}
              </button>
              {item.labelBold !== undefined && (
                <button
                  onClick={() => handleUpdateItem({ labelBold: undefined })}
                  className="text-gray-400 hover:text-gray-600"
                  title="Reset to default"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Value Group */}
        <div className="space-y-2 rounded-lg border border-gray-200 p-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">Value</label>
            <button
              onClick={() => handleUpdateItem({ showValue: !showValue })}
              className={cn(
                "relative h-5 w-9 rounded-full border transition-colors",
                showValue
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300 bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                  showValue && "translate-x-4",
                )}
              />
            </button>
          </div>
          <EditableNumberInput
            value={item.value}
            onChange={(value) => handleUpdateItem({ value })}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Color</span>
              <input
                type="color"
                value={valueColor}
                onChange={(e) =>
                  handleUpdateItem({ valueColor: e.target.value })
                }
                onMouseDown={stopMousePropagation}
                className="h-5 w-5 cursor-pointer rounded border border-gray-200"
              />
              {item.valueColor && item.valueColor !== "#374151" && (
                <button
                  onClick={() => handleUpdateItem({ valueColor: undefined })}
                  className="text-gray-400 hover:text-gray-600"
                  title="Reset to default"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">Size</span>
              <Slider
                min={2}
                max={16}
                value={[valueFontSize]}
                onValueChange={(v) => handleUpdateItem({ valueFontSize: v[0] })}
                onPointerDown={stopMousePropagation}
                className="w-14"
              />
              <span className="w-4 text-right text-[10px] text-gray-500">
                {valueFontSize}
              </span>
              {item.valueFontSize !== undefined &&
                item.valueFontSize !== 10 && (
                  <button
                    onClick={() =>
                      handleUpdateItem({ valueFontSize: undefined })
                    }
                    className="text-gray-400 hover:text-gray-600"
                    title="Reset to default"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">Bold</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleUpdateItem({ valueBold: !valueBold })}
                className={cn(
                  "rounded px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                  valueBold
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                )}
              >
                {valueBold ? "On" : "Off"}
              </button>
              {item.valueBold !== undefined && (
                <button
                  onClick={() => handleUpdateItem({ valueBold: undefined })}
                  className="text-gray-400 hover:text-gray-600"
                  title="Reset to default"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          {/* Y Offset (Bar/Line only, not Pie) */}
          {!isPie && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">Y Offset</span>
              <div className="flex items-center gap-1.5">
                <Slider
                  min={-80}
                  max={80}
                  value={[valueOffsetY]}
                  onValueChange={(v) =>
                    handleUpdateItem({ valueOffsetY: v[0] })
                  }
                  onPointerDown={stopMousePropagation}
                  className="w-14"
                />
                <span className="w-6 text-right text-[10px] text-gray-500">
                  {valueOffsetY}
                </span>
                {item.valueOffsetY !== undefined && item.valueOffsetY !== 0 && (
                  <button
                    onClick={() =>
                      handleUpdateItem({ valueOffsetY: undefined })
                    }
                    className="text-gray-400 hover:text-gray-600"
                    title="Reset to default"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Corner Radius (Bar only) */}
        {/* Corner Radius Group (Bar only) */}
        {isBarChart && (
          <div className="space-y-2 rounded-lg border border-gray-200 p-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">
                Corner
              </label>
              <div className="flex items-center gap-1.5">
                <Slider
                  min={0}
                  max={20}
                  value={[cornerRadius]}
                  onValueChange={(v) =>
                    handleUpdateItem({ cornerRadius: v[0] })
                  }
                  onPointerDown={stopMousePropagation}
                  className="w-16"
                />
                <span className="w-5 text-right text-[10px] text-gray-500">
                  {cornerRadius}
                </span>
                {item.cornerRadius !== undefined && item.cornerRadius !== 2 && (
                  <button
                    onClick={() =>
                      handleUpdateItem({ cornerRadius: undefined })
                    }
                    className="text-gray-400 hover:text-gray-600"
                    title="Reset to default"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(["top", "bottom", "all"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => handleUpdateItem({ cornerPosition: pos })}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-[10px] font-medium",
                    cornerPosition === pos
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600",
                  )}
                >
                  {pos.charAt(0).toUpperCase() + pos.slice(1)}
                </button>
              ))}
              {item.cornerPosition !== undefined &&
                item.cornerPosition !== "top" && (
                  <button
                    onClick={() =>
                      handleUpdateItem({ cornerPosition: undefined })
                    }
                    className="text-gray-400 hover:text-gray-600"
                    title="Reset to default"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Line 시리즈 선택 시
  if (isLine && selectedSeriesIndex !== undefined) {
    const series = seriesData[selectedSeriesIndex];
    if (!series) return null;

    const {
      color,
      strokeWidth = 2,
      lineStyle = "solid",
      fillEnabled = false,
      fillOpacity = 0.2,
    } = series.style;

    const handleStyleUpdate = (styleUpdates: Partial<LineSeriesStyle>) => {
      const newChartData = updateSeriesStyle(
        chartData,
        selectedSeriesIndex,
        styleUpdates,
      );
      onUpdate({ chartData: newChartData });
    };

    return (
      <div className="space-y-4">
        {/* Series name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">
            Series Name
          </label>
          <input
            type="text"
            value={series.name}
            onChange={(e) => {
              const newChartData = updateSeries(
                chartData,
                selectedSeriesIndex,
                { name: e.target.value },
              );
              onUpdate({ chartData: newChartData });
            }}
            onKeyDown={stopKeyPropagation}
            onMouseDown={stopMousePropagation}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
          />
        </div>

        {/* Color */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => handleStyleUpdate({ color: e.target.value })}
            onMouseDown={stopMousePropagation}
            className="h-6 w-6 cursor-pointer rounded border-0"
          />
        </div>

        {/* Stroke width */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">
            Stroke Width
          </label>
          <select
            value={strokeWidth}
            onChange={(e) =>
              handleStyleUpdate({ strokeWidth: Number(e.target.value) })
            }
            onMouseDown={stopMousePropagation}
            className="rounded border border-gray-200 px-2 py-1 text-xs"
          >
            {STROKE_WIDTH_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>
        </div>

        {/* Line style */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">
            Line Style
          </label>
          <div className="flex gap-1">
            {LINE_STYLE_OPTIONS.map(({ id, label: _label, dash }) => (
              <button
                key={id}
                onClick={() => handleStyleUpdate({ lineStyle: id })}
                className={cn(
                  "flex h-7 flex-1 items-center justify-center rounded border",
                  lineStyle === id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200",
                )}
              >
                <svg width="24" height="2" viewBox="0 0 24 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="24"
                    y2="1"
                    stroke={lineStyle === id ? "#3b82f6" : "#6b7280"}
                    strokeWidth="2"
                    strokeDasharray={dash.join(",")}
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Fill */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">
              Fill Area
            </label>
            <button
              onClick={() => handleStyleUpdate({ fillEnabled: !fillEnabled })}
              className={cn(
                "relative h-5 w-9 rounded-full border transition-colors",
                fillEnabled
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300 bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                  fillEnabled && "translate-x-4",
                )}
              />
            </button>
          </div>
          {fillEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">Opacity</span>
              <Slider
                min={10}
                max={50}
                step={5}
                value={[Math.round(fillOpacity * 100)]}
                onValueChange={(v) =>
                  handleStyleUpdate({ fillOpacity: v[0] / 100 })
                }
                onPointerDown={stopMousePropagation}
                className="flex-1"
              />
              <span className="text-xs text-gray-500">
                {Math.round(fillOpacity * 100)}%
              </span>
              {Math.round(fillOpacity * 100) !== 20 && (
                <button
                  onClick={() => handleStyleUpdate({ fillOpacity: 0.2 })}
                  className="text-gray-400 hover:text-gray-600"
                  title="Reset to default"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Line 포인트 선택 시
  if (isLine && selectedPoint !== undefined) {
    const series = seriesData[selectedPoint.seriesIndex];
    if (!series) return null;

    const pointIndex = selectedPoint.pointIndex;
    const xLabel = chartData.items[pointIndex]?.label ?? "";
    const pointValue = series.values[pointIndex] ?? 0;
    const pointColor = series.pointColors?.[pointIndex] ?? series.style.color;
    const showPointLabel = series.pointShowLabels?.[pointIndex] ?? true;
    const showPointValue = series.pointShowValues?.[pointIndex] ?? true;

    return (
      <div className="space-y-4">
        {/* Point info */}
        <div className="rounded bg-gray-50 p-2">
          <div className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{series.name}</span>
            <span className="mx-1">@</span>
            <span>{xLabel}</span>
          </div>
        </div>

        {/* Value */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Value</label>
          <input
            type="number"
            value={pointValue}
            onChange={(e) => {
              const newChartData = updateSeriesPointValue(
                chartData,
                selectedPoint.seriesIndex,
                pointIndex,
                Number(e.target.value),
              );
              onUpdate({ chartData: newChartData });
            }}
            onKeyDown={stopKeyPropagation}
            onMouseDown={stopMousePropagation}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
          />
        </div>

        {/* Color */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">
            Point Color
          </label>
          <input
            type="color"
            value={pointColor}
            onChange={(e) => {
              const newChartData = updateSeriesPointColor(
                chartData,
                selectedPoint.seriesIndex,
                pointIndex,
                e.target.value,
              );
              onUpdate({ chartData: newChartData });
            }}
            onMouseDown={stopMousePropagation}
            className="h-6 w-6 cursor-pointer rounded border-0"
          />
        </div>

        {/* Show Label */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">
            Show Label
          </label>
          <button
            onClick={() => {
              const newChartData = updateSeriesPointShowLabel(
                chartData,
                selectedPoint.seriesIndex,
                pointIndex,
                !showPointLabel,
              );
              onUpdate({ chartData: newChartData });
            }}
            className={cn(
              "relative h-5 w-9 rounded-full border transition-colors",
              showPointLabel
                ? "border-blue-500 bg-blue-500"
                : "border-gray-300 bg-gray-200",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                showPointLabel && "translate-x-4",
              )}
            />
          </button>
        </div>

        {/* Show Value */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">
            Show Value
          </label>
          <button
            onClick={() => {
              const newChartData = updateSeriesPointShowValue(
                chartData,
                selectedPoint.seriesIndex,
                pointIndex,
                !showPointValue,
              );
              onUpdate({ chartData: newChartData });
            }}
            className={cn(
              "relative h-5 w-9 rounded-full border transition-colors",
              showPointValue
                ? "border-blue-500 bg-blue-500"
                : "border-gray-300 bg-gray-200",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                showPointValue && "translate-x-4",
              )}
            />
          </button>
        </div>
      </div>
    );
  }

  // Legend 선택 시
  if (selectedLegendIndex !== undefined) {
    const isLineChart = chartData.variant === "line" && chartData.series;
    const currentLabel = isLineChart
      ? chartData.series![selectedLegendIndex].name
      : chartData.items[selectedLegendIndex].label;
    const currentColor = isLineChart
      ? chartData.series![selectedLegendIndex].style.color
      : chartData.items[selectedLegendIndex].color;

    return (
      <div className="space-y-4">
        {/* Color */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">Color</label>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => {
              if (isLineChart) {
                const newSeries = [...chartData.series!];
                newSeries[selectedLegendIndex] = {
                  ...newSeries[selectedLegendIndex],
                  style: {
                    ...newSeries[selectedLegendIndex].style,
                    color: e.target.value,
                  },
                };
                onUpdate({ chartData: { ...chartData, series: newSeries } });
              } else {
                const newItems = [...chartData.items];
                newItems[selectedLegendIndex] = {
                  ...newItems[selectedLegendIndex],
                  color: e.target.value,
                };
                onUpdate({ chartData: { ...chartData, items: newItems } });
              }
            }}
            onMouseDown={stopMousePropagation}
            className="h-6 w-6 cursor-pointer rounded border-0"
          />
        </div>

        {/* Label */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Label</label>
          <input
            type="text"
            value={currentLabel}
            onChange={(e) => {
              if (isLineChart) {
                const newSeries = [...chartData.series!];
                newSeries[selectedLegendIndex] = {
                  ...newSeries[selectedLegendIndex],
                  name: e.target.value,
                };
                onUpdate({ chartData: { ...chartData, series: newSeries } });
              } else {
                const newItems = [...chartData.items];
                newItems[selectedLegendIndex] = {
                  ...newItems[selectedLegendIndex],
                  label: e.target.value,
                };
                onUpdate({ chartData: { ...chartData, items: newItems } });
              }
            }}
            onKeyDown={stopKeyPropagation}
            onMouseDown={stopMousePropagation}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
          />
        </div>
      </div>
    );
  }

  return null;
}

export function ChartRightPanel({
  shape,
  onUpdate,
  onClose,
}: ChartRightPanelProps) {
  const chartData = shape.chartData;
  const [activeTab, setActiveTab] = useState<ChartTab>("data");
  const [showCustomPicker, setShowCustomPicker] = useState<
    "fillColor" | "labelColor" | "valueColor" | null
  >(null);
  const { customColors, addIfNotInPalette } = useGlobalCustomColors();

  // 드래그 상태
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // 차트 재선택 시 위치 초기화
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [shape.id]);

  // 드래그 핸들러
  const handleDragStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  if (!chartData) return null;

  const isPie = chartData.variant === "pie";
  const isLine = chartData.variant === "line";
  const isBar = chartData.variant === "bar";
  const showLabels = chartData.showLabels ?? true;
  const showValues = chartData.showValues ?? true;
  const showLegend = chartData.showLegend ?? true;
  const legendPosition = chartData.legendPosition ?? "bottom";
  const legendAlign = chartData.legendAlign ?? "start";
  const pieStyle = chartData.pieStyle ?? "default";

  // Settings values
  const globalColor = chartData.globalColor;
  const labelColor = chartData.labelColor ?? "#374151";
  const valueColor = chartData.valueColor ?? "#374151";
  const labelBold = chartData.labelBold ?? false;
  const valueBold = chartData.valueBold ?? false;
  const valueOffsetY = chartData.valueOffsetY ?? 0;
  const valuePosition = chartData.valuePosition ?? "top";
  const cornerRadius = chartData.cornerRadius ?? 2;
  const sortBy = chartData.sortBy ?? "none";
  const showAxis = chartData.showAxis ?? true;
  const showYAxis = chartData.showYAxis ?? true;
  const showGridX = chartData.showGridX ?? (isLine ? false : true);
  const showGridY = chartData.showGridY ?? true;
  const selectedItemIndex = chartData.selectedItemIndex;
  const selectedSeriesIndex = chartData.selectedSeriesIndex;
  const selectedPoint = chartData.selectedPoint;
  const selectedLegendIndex = chartData.selectedLegendIndex;
  const xAxisMargin = chartData.xAxisMargin ?? (isLine ? 16 : 0);
  const yAxisMargin = chartData.yAxisMargin ?? 0;
  const curveType = chartData.curveType ?? "linear";
  const barOrientation = chartData.orientation ?? "vertical";

  // 개별 선택 모드 판별
  const hasItemSelected = selectedItemIndex !== undefined;
  const hasSeriesSelected = selectedSeriesIndex !== undefined;
  const hasPointSelected = selectedPoint !== undefined;
  const hasLegendSelected = selectedLegendIndex !== undefined;
  const isIndividualMode =
    hasItemSelected ||
    hasSeriesSelected ||
    hasPointSelected ||
    hasLegendSelected;

  // Multi-series data (Line chart only)
  const seriesData = isLine ? getSeriesData(chartData) : [];
  const canAddSeries = seriesData.length < 5;

  // Editing series values
  const [editingSeriesIndex, setEditingSeriesIndex] = useState<number | null>(
    null,
  );

  // 개별 선택 해제 핸들러
  const handleDeselectItem = useCallback(() => {
    onUpdate({
      chartData: {
        ...chartData,
        selectedItemIndex: undefined,
      },
    });
  }, [chartData, onUpdate]);

  const handleDeselectSeries = useCallback(() => {
    onUpdate({
      chartData: {
        ...chartData,
        selectedSeriesIndex: undefined,
      },
    });
  }, [chartData, onUpdate]);

  const handleDeselectPoint = useCallback(() => {
    onUpdate({
      chartData: {
        ...chartData,
        selectedPoint: undefined,
      },
    });
  }, [chartData, onUpdate]);

  const handleDeselectLegend = useCallback(() => {
    onUpdate({
      chartData: {
        ...chartData,
        selectedLegendIndex: undefined,
      },
    });
  }, [chartData, onUpdate]);

  // 개별 선택 Back 핸들러
  const handleBackFromIndividual = useCallback(() => {
    if (hasPointSelected) {
      handleDeselectPoint();
    } else if (hasSeriesSelected) {
      handleDeselectSeries();
    } else if (hasItemSelected) {
      handleDeselectItem();
    } else if (hasLegendSelected) {
      handleDeselectLegend();
    }
  }, [
    hasPointSelected,
    hasSeriesSelected,
    hasItemSelected,
    hasLegendSelected,
    handleDeselectPoint,
    handleDeselectSeries,
    handleDeselectItem,
    handleDeselectLegend,
  ]);

  const handleToggleLabels = useCallback(() => {
    onUpdate({
      chartData: {
        ...chartData,
        showLabels: !showLabels,
      },
    });
  }, [chartData, showLabels, onUpdate]);

  const handleToggleValues = useCallback(() => {
    onUpdate({
      chartData: {
        ...chartData,
        showValues: !showValues,
      },
    });
  }, [chartData, showValues, onUpdate]);

  const handleToggleLegend = useCallback(() => {
    onUpdate({
      chartData: {
        ...chartData,
        showLegend: !showLegend,
      },
    });
  }, [chartData, showLegend, onUpdate]);

  const handleLegendPositionChange = useCallback(
    (position: "top" | "bottom" | "left" | "right") => {
      onUpdate({
        chartData: {
          ...chartData,
          legendPosition: position,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleLegendAlignChange = useCallback(
    (align: "start" | "center" | "end") => {
      onUpdate({
        chartData: {
          ...chartData,
          legendAlign: align,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handlePieStyleChange = useCallback(
    (style: "default" | "donut" | "3d" | "rounded" | "gradient") => {
      // 스타일에 따라 innerRadius도 자동 설정
      const innerRadiusMap: Record<string, number> = {
        default: 0,
        donut: 40,
        "3d": 0,
        rounded: 50,
        gradient: 30,
      };
      onUpdate({
        chartData: {
          ...chartData,
          pieStyle: style,
          innerRadius: innerRadiusMap[style],
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleUpdateItem = useCallback(
    (index: number, updates: Partial<ChartDataItem>) => {
      const newItems = [...chartData.items];
      newItems[index] = { ...newItems[index], ...updates };
      onUpdate({
        chartData: {
          ...chartData,
          items: newItems,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleAddItem = useCallback(() => {
    const newItems = [
      ...chartData.items,
      {
        label: String.fromCharCode(65 + chartData.items.length),
        value: 25,
        color: CHART_COLORS[chartData.items.length % CHART_COLORS.length],
      },
    ];
    onUpdate({
      chartData: {
        ...chartData,
        items: newItems,
      },
    });
  }, [chartData, onUpdate]);

  const handleRemoveItem = useCallback(
    (index: number) => {
      if (chartData.items.length <= 1) return;
      const newItems = chartData.items.filter((_, i) => i !== index);
      onUpdate({
        chartData: {
          ...chartData,
          items: newItems,
          selectedItemIndex:
            selectedItemIndex === index ? undefined : selectedItemIndex,
        },
      });
    },
    [chartData, selectedItemIndex, onUpdate],
  );

  // Settings handlers
  const handleSortChange = useCallback(
    (value: ChartSortBy) => {
      onUpdate({
        chartData: {
          ...chartData,
          sortBy: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleGlobalColorChange = useCallback(
    (color: string | undefined) => {
      // globalColor 설정 시 모든 아이템/시리즈의 colorOverride 리셋
      const resetItems = color
        ? chartData.items.map((item) => ({ ...item, colorOverride: false }))
        : chartData.items;
      const resetSeries =
        color && chartData.series
          ? chartData.series.map((s) => ({
              ...s,
              style: { ...s.style, colorOverride: false },
            }))
          : chartData.series;
      onUpdate({
        chartData: {
          ...chartData,
          globalColor: color,
          items: resetItems,
          series: resetSeries,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleLabelColorChange = useCallback(
    (color: string) => {
      onUpdate({
        chartData: {
          ...chartData,
          labelColor: color,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleValueColorChange = useCallback(
    (color: string) => {
      onUpdate({
        chartData: {
          ...chartData,
          valueColor: color,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleLabelBoldChange = useCallback(
    (bold: boolean) => {
      onUpdate({
        chartData: {
          ...chartData,
          labelBold: bold,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleValueBoldChange = useCallback(
    (bold: boolean) => {
      onUpdate({
        chartData: {
          ...chartData,
          valueBold: bold,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleValueOffsetYChange = useCallback(
    (offset: number) => {
      onUpdate({
        chartData: {
          ...chartData,
          valueOffsetY: offset,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleValuePositionChange = useCallback(
    (position: "top" | "center") => {
      onUpdate({
        chartData: {
          ...chartData,
          valuePosition: position,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleCornerRadiusChange = useCallback(
    (value: number) => {
      onUpdate({
        chartData: {
          ...chartData,
          cornerRadius: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleBarOrientationChange = useCallback(
    (value: "vertical" | "horizontal") => {
      onUpdate({
        chartData: {
          ...chartData,
          orientation: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleShowAxisChange = useCallback(
    (value: boolean) => {
      onUpdate({
        chartData: {
          ...chartData,
          showAxis: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleXAxisMarginChange = useCallback(
    (value: number) => {
      onUpdate({
        chartData: {
          ...chartData,
          xAxisMargin: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleYAxisMarginChange = useCallback(
    (value: number) => {
      onUpdate({
        chartData: {
          ...chartData,
          yAxisMargin: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleAddSeries = useCallback(() => {
    const newChartData = addSeries(chartData);
    if (newChartData) {
      onUpdate({ chartData: newChartData });
    }
  }, [chartData, onUpdate]);

  const handleShowYAxisChange = useCallback(
    (value: boolean) => {
      onUpdate({
        chartData: {
          ...chartData,
          showYAxis: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleShowGridXChange = useCallback(
    (value: boolean) => {
      onUpdate({
        chartData: {
          ...chartData,
          showGridX: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleShowGridYChange = useCallback(
    (value: boolean) => {
      onUpdate({
        chartData: {
          ...chartData,
          showGridY: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  const handleCurveTypeChange = useCallback(
    (value: "linear" | "curved") => {
      onUpdate({
        chartData: {
          ...chartData,
          curveType: value,
        },
      });
    },
    [chartData, onUpdate],
  );

  // Area Fill 전체 토글 (모든 시리즈에 적용)
  const handleAreaFillToggle = useCallback(
    (enabled: boolean) => {
      if (!chartData.series) return;
      const newSeries = chartData.series.map((s) => ({
        ...s,
        style: {
          ...s.style,
          fillEnabled: enabled,
        },
      }));
      onUpdate({
        chartData: {
          ...chartData,
          series: newSeries,
        },
      });
    },
    [chartData, onUpdate],
  );

  // 현재 Area Fill 상태 (하나라도 enabled면 true)
  const isAreaFillEnabled = useMemo(() => {
    if (!chartData.series) return false;
    return chartData.series.some((s) => s.style.fillEnabled);
  }, [chartData.series]);

  const handleSeriesValuesUpdate = useCallback(
    (seriesIndex: number, pointIndex: number, value: number) => {
      const newChartData = updateSeriesPointValue(
        chartData,
        seriesIndex,
        pointIndex,
        value,
      );
      onUpdate({ chartData: newChartData });
    },
    [chartData, onUpdate],
  );

  const handleUpdateSeriesName = useCallback(
    (seriesIndex: number, name: string) => {
      const newChartData = updateSeries(chartData, seriesIndex, { name });
      onUpdate({ chartData: newChartData });
    },
    [chartData, onUpdate],
  );

  const handleUpdateSeriesColor = useCallback(
    (seriesIndex: number, color: string) => {
      const newChartData = updateSeriesStyle(chartData, seriesIndex, { color });
      onUpdate({ chartData: newChartData });
    },
    [chartData, onUpdate],
  );

  const handleRemoveSeries = useCallback(
    (seriesIndex: number) => {
      const series = seriesData[seriesIndex];
      if (!series) return;
      const newChartData = removeSeries(chartData, series.id);
      if (newChartData) {
        onUpdate({ chartData: newChartData });
        if (editingSeriesIndex === seriesIndex) {
          setEditingSeriesIndex(null);
        }
      }
    },
    [chartData, seriesData, editingSeriesIndex, onUpdate],
  );

  const handleAddPoint = useCallback(() => {
    const nextLabel = String.fromCharCode(65 + chartData.items.length);
    const newChartData = addXAxisPoint(chartData, nextLabel, 30);
    onUpdate({ chartData: newChartData });
  }, [chartData, onUpdate]);

  // 특정 시리즈에서만 포인트 숨김 (다른 시리즈 영향 없음)
  const handleHideSeriesPoint = useCallback(
    (seriesIndex: number, pointIndex: number) => {
      const newChartData = hideSeriesPoint(chartData, seriesIndex, pointIndex);
      onUpdate({ chartData: newChartData });
    },
    [chartData, onUpdate],
  );

  const handleUpdatePointLabel = useCallback(
    (pointIndex: number, label: string) => {
      const newItems = [...chartData.items];
      newItems[pointIndex] = { ...newItems[pointIndex], label };
      onUpdate({
        chartData: {
          ...chartData,
          items: newItems,
        },
      });
    },
    [chartData, onUpdate],
  );

  return (
    <div
      className={cn(
        "fixed z-[100]",
        "w-80 rounded-xl border border-gray-200 bg-white shadow-xl",
        "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
        "overflow-hidden transition-shadow",
        isDragging && "cursor-grabbing shadow-2xl",
      )}
      style={{
        right: 16 - position.x,
        top: `calc(50% + ${position.y}px)`,
        transform: "translateY(-50%)",
      }}
    >
      {/* Header - Draggable */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-gray-100 px-4 py-3",
          "dark:border-gray-700",
          "cursor-grab select-none",
          isDragging && "cursor-grabbing",
        )}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          {isIndividualMode ? (
            <>
              <button
                onClick={handleBackFromIndividual}
                onMouseDown={(e) => e.stopPropagation()}
                className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
              >
                <ArrowLeft className="h-4 w-4 text-gray-500 dark:text-gray-600" />
              </button>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-800">
                {hasPointSelected
                  ? "Point Options"
                  : hasSeriesSelected
                    ? "Series Options"
                    : hasItemSelected
                      ? "Item Options"
                      : "Legend Options"}
              </h3>
            </>
          ) : (
            <>
              <GripHorizontal className="h-4 w-4 text-gray-300 dark:text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-800">
                Chart Options
              </h3>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Tab Header (전체 모드에서만) */}
      {!isIndividualMode && (
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("data")}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "data"
                ? "border-b-2 border-violet-500 text-violet-600"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            Chart Data
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "settings"
                ? "border-b-2 border-violet-500 text-violet-600"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            Settings
          </button>
        </div>
      )}

      {/* Content */}
      <div className="max-h-[60vh] overflow-y-auto p-3">
        {/* 개별 선택 모드: 개별 옵션 UI */}
        {isIndividualMode && (
          <IndividualOptionsContent
            chartData={chartData}
            selectedItemIndex={selectedItemIndex}
            selectedSeriesIndex={selectedSeriesIndex}
            selectedPoint={selectedPoint}
            selectedLegendIndex={selectedLegendIndex}
            seriesData={seriesData}
            onUpdate={onUpdate}
            isLine={isLine}
            isBarChart={chartData.variant === "bar"}
          />
        )}

        {/* 전체 모드: 탭 컨텐츠 */}
        {!isIndividualMode && activeTab === "data" && (
          <div className="space-y-2">
            {/* Line chart: 시리즈 중심 UI */}
            {isLine ? (
              <>
                {/* Series count header */}
                <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                  <span className="text-xs text-gray-500">
                    {seriesData.length} Series
                  </span>
                  {canAddSeries && (
                    <button
                      onClick={handleAddSeries}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-violet-600 hover:bg-violet-50"
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  )}
                </div>

                {seriesData.map((series, seriesIdx) => {
                  const isExpanded = editingSeriesIndex === seriesIdx;
                  return (
                    <div
                      key={series.id}
                      className={cn(
                        "rounded-md border transition-colors",
                        isExpanded
                          ? "border-violet-300 bg-violet-50/50"
                          : "border-gray-200 hover:border-gray-300",
                      )}
                    >
                      {/* Series header */}
                      <div
                        className="flex cursor-pointer items-center gap-2 p-2"
                        onClick={() =>
                          setEditingSeriesIndex(isExpanded ? null : seriesIdx)
                        }
                      >
                        <div
                          className="h-5 w-5 rounded"
                          style={{ backgroundColor: series.style.color }}
                        />
                        <span className="flex-1 text-xs font-medium text-gray-700">
                          {series.name}
                        </span>
                        {seriesData.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSeries(seriesIdx);
                            }}
                            className="text-gray-400 hover:text-red-500"
                            title="Remove series"
                          >
                            ×
                          </button>
                        )}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-gray-400 transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </div>

                      {/* Expanded: Point list */}
                      {isExpanded && (
                        <div className="border-t border-gray-200">
                          {/* Series edit row */}
                          <div className="flex items-center gap-2 border-b border-gray-100 px-2 py-2">
                            <input
                              type="color"
                              value={series.style.color}
                              onChange={(e) =>
                                handleUpdateSeriesColor(
                                  seriesIdx,
                                  e.target.value,
                                )
                              }
                              onMouseDown={stopMousePropagation}
                              className="h-6 w-6 cursor-pointer rounded border-0"
                            />
                            <input
                              type="text"
                              value={series.name}
                              onChange={(e) =>
                                handleUpdateSeriesName(
                                  seriesIdx,
                                  e.target.value,
                                )
                              }
                              onKeyDown={stopKeyPropagation}
                              onMouseDown={stopMousePropagation}
                              className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                              placeholder="Series name"
                            />
                          </div>

                          {/* Header labels */}
                          <div className="flex items-center gap-2 px-2 pt-2 text-[10px] uppercase tracking-wide text-gray-400">
                            <span className="w-6"></span>
                            <span className="w-20">Label</span>
                            <span className="flex-1">Value</span>
                          </div>

                          {/* Scrollable point list */}
                          <div className="max-h-48 space-y-1.5 overflow-y-auto px-2 py-1.5">
                            {series.values.map((val, pointIdx) => {
                              // null/undefined 값은 숨겨진 포인트 (스킵)
                              if (val == null || typeof val !== "number")
                                return null;
                              return (
                                <div
                                  key={pointIdx}
                                  className="flex items-center gap-2"
                                >
                                  <div
                                    className="h-5 w-5 rounded"
                                    style={{
                                      backgroundColor: series.style.color,
                                    }}
                                  />
                                  <input
                                    type="text"
                                    value={
                                      chartData.items[pointIdx]?.label ??
                                      String(pointIdx)
                                    }
                                    onChange={(e) =>
                                      handleUpdatePointLabel(
                                        pointIdx,
                                        e.target.value,
                                      )
                                    }
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={stopKeyPropagation}
                                    onMouseDown={stopMousePropagation}
                                    className="w-20 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                                    placeholder="Label"
                                  />
                                  <SeriesValueInput
                                    value={val}
                                    label=""
                                    onChange={(newVal) =>
                                      handleSeriesValuesUpdate(
                                        seriesIdx,
                                        pointIdx,
                                        newVal,
                                      )
                                    }
                                  />
                                  {/* 시리즈별 부분 삭제 (해당 시리즈에서만 숨김) */}
                                  <button
                                    onClick={() =>
                                      handleHideSeriesPoint(seriesIdx, pointIdx)
                                    }
                                    className="text-gray-400 hover:text-red-500"
                                    title="Hide point from this series"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Sticky add button */}
                          <div className="border-t border-gray-200 bg-violet-50/50 p-2">
                            <button
                              onClick={handleAddPoint}
                              className="w-full rounded border border-dashed border-gray-300 bg-white py-1 text-xs text-violet-600 hover:border-violet-400 hover:bg-violet-50"
                            >
                              + Add point
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              /* Bar/Pie chart: Line 차트와 동일한 스타일 */
              <div
                className={cn(
                  "rounded-md border transition-colors",
                  "border-violet-300 bg-violet-50/50",
                )}
              >
                {/* Header */}
                <div className="flex items-center gap-2 p-2">
                  <div
                    className="h-5 w-5 rounded"
                    style={{ backgroundColor: globalColor ?? CHART_COLORS[0] }}
                  />
                  <span className="flex-1 text-xs font-medium text-gray-700">
                    {isPie ? "Slices" : "Bars"}
                  </span>
                </div>

                {/* Item list with scroll */}
                <div className="border-t border-gray-200">
                  {/* Header labels */}
                  <div className="flex items-center gap-2 px-2 pt-2 text-[10px] uppercase tracking-wide text-gray-400">
                    <span className="w-6"></span>
                    <span className="w-20">Label</span>
                    <span className="flex-1">Value</span>
                  </div>

                  {/* Scrollable item list */}
                  <div className="max-h-48 space-y-1.5 overflow-y-auto px-2 py-1.5">
                    {chartData.items.map((item, index) => {
                      const itemDisplayColor = item.colorOverride
                        ? item.color
                        : (globalColor ?? item.color);
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="color"
                            value={itemDisplayColor}
                            onChange={(e) =>
                              handleUpdateItem(index, {
                                color: e.target.value,
                                colorOverride: true,
                              })
                            }
                            onMouseDown={stopMousePropagation}
                            className="h-5 w-5 cursor-pointer rounded border-0"
                          />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) =>
                              handleUpdateItem(index, { label: e.target.value })
                            }
                            onFocus={(e) => e.target.select()}
                            onKeyDown={stopKeyPropagation}
                            onMouseDown={stopMousePropagation}
                            className="w-20 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                            placeholder="Label"
                          />
                          <SeriesValueInput
                            value={item.value}
                            label=""
                            onChange={(newVal) =>
                              handleUpdateItem(index, { value: newVal })
                            }
                          />
                          {chartData.items.length > 1 && (
                            <button
                              onClick={() => handleRemoveItem(index)}
                              className="text-gray-400 hover:text-red-500"
                              title="Remove"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Sticky add button */}
                  <div className="border-t border-gray-200 bg-violet-50/50 p-2">
                    <button
                      onClick={handleAddItem}
                      className="w-full rounded border border-dashed border-gray-300 bg-white py-1 text-xs text-violet-600 hover:border-violet-400 hover:bg-violet-50"
                    >
                      + Add {isPie ? "slice" : "bar"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isIndividualMode && activeTab === "settings" && (
          <div className="space-y-4">
            {/* Labels / Values / Legend toggles */}
            <div className="space-y-1.5 rounded-md border border-gray-200 px-3 py-2">
              <div className="text-[10px] text-gray-500">Display</div>
              <div className="text-[9px] text-gray-400">
                Toggle visibility of labels, values, and legend
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleToggleLabels}
                  className={cn(
                    "flex-1 rounded px-1 py-1 text-[10px] font-medium transition-colors",
                    showLabels
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  Labels
                </button>
                <button
                  onClick={handleToggleValues}
                  className={cn(
                    "flex-1 rounded px-1 py-1 text-[10px] font-medium transition-colors",
                    showValues
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  Values
                </button>
                <button
                  onClick={handleToggleLegend}
                  className={cn(
                    "flex-1 rounded px-1 py-1 text-[10px] font-medium transition-colors",
                    showLegend
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  Legend
                </button>
              </div>
            </div>

            {/* Pie Style (Pie 차트 전용) */}
            {isPie && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Pie Style
                </div>
                <div className="text-[9px] text-gray-400">
                  Choose pie chart appearance
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">
                    Type
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "default", label: "Default" },
                        { id: "donut", label: "Donut" },
                        { id: "3d", label: "3D" },
                        { id: "rounded", label: "Rounded" },
                        { id: "gradient", label: "Gradient" },
                      ] as const
                    ).map((style) => (
                      <button
                        key={style.id}
                        onClick={() => handlePieStyleChange(style.id)}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-[10px] font-medium transition-all",
                          pieStyle === style.id
                            ? "bg-violet-500 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                        )}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Legend position (shown when legend is on) */}
            {showLegend && (
              <div className="space-y-1 rounded-md border border-gray-200">
                <div className="border-b border-gray-100 px-3 py-2">
                  <div className="text-[11px] font-medium text-gray-700">
                    Legend Settings
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Adjust legend position and alignment
                  </div>
                </div>
                <div className="px-3 py-2">
                  <div className="mb-1.5 text-[10px] text-gray-500">
                    Position
                  </div>
                  <div className="flex gap-1">
                    {(["top", "bottom", "left", "right"] as const).map(
                      (pos) => (
                        <button
                          key={pos}
                          onClick={() => handleLegendPositionChange(pos)}
                          className={cn(
                            "flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors",
                            legendPosition === pos
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                          )}
                        >
                          {pos === "top"
                            ? "Top"
                            : pos === "bottom"
                              ? "Bottom"
                              : pos === "left"
                                ? "Left"
                                : "Right"}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100 px-3 py-2">
                  <div className="mb-1.5 text-[10px] text-gray-500">Align</div>
                  <div className="flex gap-1">
                    {(["start", "center", "end"] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => handleLegendAlignChange(align)}
                        className={cn(
                          "flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                          legendAlign === align
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                        )}
                      >
                        {align === "start"
                          ? "Left"
                          : align === "center"
                            ? "Center"
                            : "Right"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sort */}
            <div className="space-y-1.5 rounded-md border border-gray-200 px-3 py-2">
              <div className="text-[10px] text-gray-500">Sort</div>
              <div className="text-[9px] text-gray-400">
                Order data points by value or alphabetically
              </div>
              <div className="flex gap-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSortChange(option.value)}
                    className={cn(
                      "flex-1 rounded px-1 py-1 text-[10px] font-medium transition-colors",
                      sortBy === option.value
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                    )}
                    title={option.label}
                  >
                    {option.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors Section */}
            <div className="space-y-3 rounded-lg border border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-700">Colors</div>
              <div className="text-[9px] text-gray-400">
                Customize fill, label, and value colors
              </div>

              {/* Fill Color (Bar/Line only) */}
              {!isPie && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">
                    Fill
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleGlobalColorChange(undefined)}
                      className={cn(
                        "flex h-6 items-center rounded-full border px-2 text-[10px] font-medium transition-all",
                        !globalColor
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-gray-300 text-gray-500 hover:border-gray-400",
                      )}
                    >
                      Auto
                    </button>
                    {CHART_COLORS.slice(0, 6).map((color) => (
                      <button
                        key={color}
                        onClick={() => handleGlobalColorChange(color)}
                        className={cn(
                          "h-6 w-6 rounded-full transition-all",
                          globalColor === color
                            ? "ring-2 ring-blue-500 ring-offset-1"
                            : "hover:scale-110",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <CustomColorButton
                      onClick={() =>
                        setShowCustomPicker(
                          showCustomPicker === "fillColor" ? null : "fillColor",
                        )
                      }
                      isActive={showCustomPicker === "fillColor"}
                    />
                  </div>
                  {showCustomPicker === "fillColor" && (
                    <ColorPickerPopup
                      currentColor={globalColor ?? CHART_COLORS[0]}
                      onApply={(color) => {
                        handleGlobalColorChange(color);
                        addIfNotInPalette(color, CHART_COLORS);
                        setShowCustomPicker(null);
                      }}
                      onClose={() => setShowCustomPicker(null)}
                    />
                  )}
                </div>
              )}

              {/* Label Color */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500">
                  Label
                </div>
                {/* Custom colors history */}
                {customColors.length > 0 && (
                  <div className="flex gap-1.5 border-b border-gray-100 pb-1.5 mb-1.5">
                    {customColors.slice(0, 6).map((color) => (
                      <button
                        key={color}
                        onClick={() => handleLabelColorChange(color)}
                        className={cn(
                          "h-6 w-6 rounded-full transition-all",
                          labelColor.toLowerCase() === color.toLowerCase()
                            ? "ring-2 ring-blue-500 ring-offset-1"
                            : "hover:scale-110",
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleLabelColorChange(color)}
                      className={cn(
                        "h-6 w-6 rounded-full transition-all",
                        labelColor === color
                          ? "ring-2 ring-blue-500 ring-offset-1"
                          : "hover:scale-110",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <CustomColorButton
                    onClick={() =>
                      setShowCustomPicker(
                        showCustomPicker === "labelColor" ? null : "labelColor",
                      )
                    }
                    isActive={showCustomPicker === "labelColor"}
                  />
                </div>
                {showCustomPicker === "labelColor" && (
                  <ColorPickerPopup
                    currentColor={labelColor}
                    onApply={(color) => {
                      handleLabelColorChange(color);
                      addIfNotInPalette(color, TEXT_COLORS);
                      setShowCustomPicker(null);
                    }}
                    onClose={() => setShowCustomPicker(null)}
                  />
                )}
              </div>

              {/* Value Color */}
              <div className="space-y-1.5 border-t border-gray-200 pt-2">
                <div className="text-[10px] font-medium text-gray-500">
                  Value
                </div>
                <div className="flex gap-1.5">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleValueColorChange(color)}
                      className={cn(
                        "h-6 w-6 rounded-full transition-all",
                        valueColor === color
                          ? "ring-2 ring-blue-500 ring-offset-1"
                          : "hover:scale-110",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <CustomColorButton
                    onClick={() =>
                      setShowCustomPicker(
                        showCustomPicker === "valueColor" ? null : "valueColor",
                      )
                    }
                    isActive={showCustomPicker === "valueColor"}
                  />
                </div>
                {showCustomPicker === "valueColor" && (
                  <ColorPickerPopup
                    currentColor={valueColor}
                    onApply={(color) => {
                      handleValueColorChange(color);
                      addIfNotInPalette(color, TEXT_COLORS);
                      setShowCustomPicker(null);
                    }}
                    onClose={() => setShowCustomPicker(null)}
                  />
                )}
              </div>
            </div>

            {/* Text Styling Section */}
            <div className="space-y-3 rounded-lg border border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-700">
                Text Style
              </div>
              <div className="text-[9px] text-gray-400">
                Apply bold styling to labels and values
              </div>

              {/* Label Bold */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-500">
                  Label Bold
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleLabelBoldChange(!labelBold)}
                    className={cn(
                      "rounded px-3 py-1 text-[10px] font-medium transition-colors",
                      labelBold
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                    )}
                  >
                    {labelBold ? "On" : "Off"}
                  </button>
                  {labelBold && (
                    <button
                      onClick={() => handleLabelBoldChange(false)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Value Bold */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-500">
                  Value Bold
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleValueBoldChange(!valueBold)}
                    className={cn(
                      "rounded px-3 py-1 text-[10px] font-medium transition-colors",
                      valueBold
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                    )}
                  >
                    {valueBold ? "On" : "Off"}
                  </button>
                  {valueBold && (
                    <button
                      onClick={() => handleValueBoldChange(false)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Value Position Section (Bar/Line only, not Pie) */}
            {!isPie && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Value Position
                </div>
                <div className="text-[9px] text-gray-400">
                  Adjust value label position and offset
                </div>

                {/* Bar only: Position (top/center) */}
                {isBar && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-gray-500">
                        Position
                      </span>
                      {valuePosition !== "top" && (
                        <button
                          onClick={() => handleValuePositionChange("top")}
                          className="text-gray-400 hover:text-gray-600"
                          title="Reset to default"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 p-1">
                      <button
                        onClick={() => handleValuePositionChange("top")}
                        className={cn(
                          "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                          valuePosition === "top"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700",
                        )}
                      >
                        Top
                      </button>
                      <button
                        onClick={() => handleValuePositionChange("center")}
                        className={cn(
                          "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                          valuePosition === "center"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700",
                        )}
                      >
                        Center
                      </button>
                    </div>
                  </div>
                )}

                {/* Y Offset Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500">
                      Y Offset
                    </span>
                    {valueOffsetY !== 0 && (
                      <button
                        onClick={() => handleValueOffsetYChange(0)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Slider
                      min={-80}
                      max={80}
                      value={[valueOffsetY]}
                      onValueChange={(v) => handleValueOffsetYChange(v[0])}
                      onKeyDown={stopKeyPropagation}
                      onPointerDown={stopMousePropagation}
                      className="flex-1"
                    />
                    <span className="w-8 text-right text-[10px] text-gray-400">
                      {valueOffsetY}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Line Style Section */}
            {isLine && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Line Style
                </div>
                <div className="text-[9px] text-gray-400">
                  Line type and area fill options
                </div>
                {/* Line Type */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">
                    Type
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 p-1">
                    <button
                      onClick={() => handleCurveTypeChange("linear")}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                        curveType === "linear"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700",
                      )}
                    >
                      Linear
                    </button>
                    <button
                      onClick={() => handleCurveTypeChange("curved")}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                        curveType === "curved"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700",
                      )}
                    >
                      Curved
                    </button>
                  </div>
                </div>
                {/* Area Fill Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-gray-500">
                    Area Fill
                  </span>
                  <button
                    onClick={() => handleAreaFillToggle(!isAreaFillEnabled)}
                    className={cn(
                      "relative h-5 w-9 rounded-full border transition-colors",
                      isAreaFillEnabled
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300 bg-gray-200",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                        isAreaFillEnabled && "translate-x-4",
                      )}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Bar Style Section */}
            {isBar && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Bar Style
                </div>
                <div className="text-[9px] text-gray-400">
                  Bar orientation and corner roundness
                </div>
                {/* Orientation Toggle */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">
                    Orientation
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 p-1">
                    <button
                      onClick={() => handleBarOrientationChange("vertical")}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                        barOrientation === "vertical"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-400",
                      )}
                    >
                      Vertical
                    </button>
                    <button
                      onClick={() => handleBarOrientationChange("horizontal")}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                        barOrientation === "horizontal"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-400",
                      )}
                    >
                      Horizontal
                    </button>
                  </div>
                </div>
                {/* Corner Radius */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-500">
                      Corner Radius
                    </span>
                    {cornerRadius !== 2 && (
                      <button
                        onClick={() => handleCornerRadiusChange(2)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Reset to default"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Slider
                      min={0}
                      max={16}
                      value={[cornerRadius]}
                      onValueChange={(v) => handleCornerRadiusChange(v[0])}
                      onKeyDown={stopKeyPropagation}
                      onPointerDown={stopMousePropagation}
                      className="flex-1"
                    />
                    <span className="w-8 text-right text-[10px] text-gray-400">
                      {cornerRadius}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Grid & Axes (Bar/Line) */}
            {(isLine || isBar) && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                {/* Section Header */}
                <div className="text-xs font-semibold text-gray-700">
                  Grid & Axes
                </div>
                <div className="text-[9px] text-gray-400">
                  Show or hide gridlines and axis labels
                </div>

                {/* Grid Row */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">
                    Grid
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 p-1">
                    <button
                      onClick={() => handleShowGridXChange(!showGridX)}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                        showGridX
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-400",
                      )}
                    >
                      X-grid
                    </button>
                    <button
                      onClick={() => handleShowGridYChange(!showGridY)}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                        showGridY
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-400",
                      )}
                    >
                      Y-grid
                    </button>
                  </div>
                </div>

                {/* Axes Row */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-gray-500">
                    Axes
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 p-1">
                    <button
                      onClick={() => handleShowAxisChange(!showAxis)}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                        showAxis
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-400",
                      )}
                    >
                      X-axis
                    </button>
                    <button
                      onClick={() => handleShowYAxisChange(!showYAxis)}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                        showYAxis
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-400",
                      )}
                    >
                      Y-axis
                    </button>
                  </div>
                </div>

                {/* Margins (when axes are visible) */}
                {(showAxis || showYAxis) && (
                  <div className="space-y-2 border-t border-gray-200 pt-2">
                    <div className="text-[10px] font-medium text-gray-500">
                      Margin
                    </div>
                    {showAxis && (
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-[10px] text-gray-500">
                          X-axis
                        </span>
                        <Slider
                          min={0}
                          max={isLine ? 32 : 16}
                          step={isLine ? 16 : 1}
                          value={[xAxisMargin]}
                          onValueChange={(v) => handleXAxisMarginChange(v[0])}
                          onKeyDown={stopKeyPropagation}
                          onPointerDown={stopMousePropagation}
                          className="flex-1"
                        />
                        <span className="w-8 text-right text-[10px] text-gray-400">
                          {xAxisMargin}
                        </span>
                        {xAxisMargin !== (isLine ? 16 : 0) && (
                          <button
                            onClick={() =>
                              handleXAxisMarginChange(isLine ? 16 : 0)
                            }
                            className="text-gray-400 hover:text-gray-600"
                            title="Reset to default"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {showYAxis && (
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-[10px] text-gray-500">
                          Y-axis
                        </span>
                        <Slider
                          min={0}
                          max={16}
                          value={[yAxisMargin]}
                          onValueChange={(v) => handleYAxisMarginChange(v[0])}
                          onKeyDown={stopKeyPropagation}
                          onPointerDown={stopMousePropagation}
                          className="flex-1"
                        />
                        <span className="w-8 text-right text-[10px] text-gray-400">
                          {yAxisMargin}
                        </span>
                        {yAxisMargin !== 0 && (
                          <button
                            onClick={() => handleYAxisMarginChange(0)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Reset to default"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
