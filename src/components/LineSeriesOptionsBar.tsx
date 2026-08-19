import {
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import type {
  CanvasObject,
  ChartLineStyle,
  LineSeriesStyle,
  SelectedPoint,
} from "@/types";
import {
  getSeriesData,
  updateSeriesStyle,
  removeSeries,
  updateSeriesPointValue,
  updateSeriesPointColor,
  updateSeriesPointShowLabel,
  updateSeriesPointShowValue,
} from "@/utils/chart";

// input 포커스 중 키보드 이벤트 전파 방지
const stopKeyPropagation = (e: KeyboardEvent) => {
  e.stopPropagation();
};

// input 포커스를 위해 마우스 이벤트 전파 방지
const stopMousePropagation = (e: MouseEvent) => {
  e.stopPropagation();
};

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

interface LineSeriesOptionsBarProps {
  shape: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  selectedSeriesIndex: number;
  selectedPoint?: SelectedPoint;
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onDeselectSeries: () => void;
  onDeselectPoint?: () => void;
}

export function LineSeriesOptionsBar({
  shape,
  position,
  selectedSeriesIndex,
  selectedPoint,
  onUpdate,
  onDeselectSeries,
  onDeselectPoint,
}: LineSeriesOptionsBarProps) {
  const chartData = shape.chartData;

  if (!chartData) return null;

  const seriesData = getSeriesData(chartData);
  const series = seriesData[selectedSeriesIndex];

  if (!series) return null;

  const {
    color,
    strokeWidth = 2,
    lineStyle = "solid",
    fillEnabled = false,
    fillOpacity = 0.2,
  } = series.style;

  // 포인트 관련 상태
  const hasPointSelected = selectedPoint !== undefined;
  const pointIndex = selectedPoint?.pointIndex ?? -1;
  const xLabel = chartData.items[pointIndex]?.label ?? "";
  const pointValue = hasPointSelected ? (series.values[pointIndex] ?? 0) : 0;
  const pointColor = hasPointSelected
    ? (series.pointColors?.[pointIndex] ?? color)
    : color;
  const showLabel = hasPointSelected
    ? (series.pointShowLabels?.[pointIndex] ?? true)
    : true;
  const showValue = hasPointSelected
    ? (series.pointShowValues?.[pointIndex] ?? true)
    : true;

  // 로컬 value 입력 상태
  const [localValue, setLocalValue] = useState(String(pointValue));

  // value가 외부에서 변경되면 로컬 상태 동기화
  useEffect(() => {
    setLocalValue(String(pointValue));
  }, [pointValue]);

  const handleStyleUpdate = useCallback(
    (styleUpdates: Partial<LineSeriesStyle>) => {
      const newChartData = updateSeriesStyle(
        chartData,
        selectedSeriesIndex,
        styleUpdates,
      );
      onUpdate({ chartData: newChartData });
    },
    [chartData, selectedSeriesIndex, onUpdate],
  );

  const handleColorChange = useCallback(
    (newColor: string) => {
      handleStyleUpdate({ color: newColor });
    },
    [handleStyleUpdate],
  );

  const handleStrokeWidthChange = useCallback(
    (width: number) => {
      handleStyleUpdate({ strokeWidth: width });
    },
    [handleStyleUpdate],
  );

  const handleLineStyleChange = useCallback(
    (style: ChartLineStyle) => {
      handleStyleUpdate({ lineStyle: style });
    },
    [handleStyleUpdate],
  );

  const handleFillToggle = useCallback(() => {
    handleStyleUpdate({ fillEnabled: !fillEnabled });
  }, [handleStyleUpdate, fillEnabled]);

  const handleFillOpacityChange = useCallback(
    (opacity: number) => {
      handleStyleUpdate({ fillOpacity: opacity });
    },
    [handleStyleUpdate],
  );

  const handleDeleteSeries = useCallback(() => {
    const newChartData = removeSeries(chartData, series.id);
    if (newChartData) {
      onUpdate({ chartData: newChartData });
      onDeselectSeries();
    }
  }, [chartData, series.id, onUpdate, onDeselectSeries]);

  // 포인트 관련 핸들러
  const handlePointValueChange = useCallback(
    (inputValue: string) => {
      if (!hasPointSelected) return;
      if (inputValue === "") {
        setLocalValue("");
        return;
      }

      const regex = /^-?\d{0,8}(\.\d{0,1})?$/;
      if (regex.test(inputValue)) {
        setLocalValue(inputValue);
        const numValue = parseFloat(inputValue);
        if (!isNaN(numValue)) {
          const newChartData = updateSeriesPointValue(
            chartData,
            selectedSeriesIndex,
            pointIndex,
            numValue,
          );
          onUpdate({ chartData: newChartData });
        }
      }
    },
    [chartData, selectedSeriesIndex, pointIndex, hasPointSelected, onUpdate],
  );

  const handlePointValueBlur = useCallback(() => {
    if (!hasPointSelected) return;
    if (localValue === "" || isNaN(parseFloat(localValue))) {
      setLocalValue("0");
      const newChartData = updateSeriesPointValue(
        chartData,
        selectedSeriesIndex,
        pointIndex,
        0,
      );
      onUpdate({ chartData: newChartData });
    }
  }, [
    localValue,
    chartData,
    selectedSeriesIndex,
    pointIndex,
    hasPointSelected,
    onUpdate,
  ]);

  const handlePointColorChange = useCallback(
    (newColor: string) => {
      if (!hasPointSelected) return;
      const newChartData = updateSeriesPointColor(
        chartData,
        selectedSeriesIndex,
        pointIndex,
        newColor,
      );
      onUpdate({ chartData: newChartData });
    },
    [chartData, selectedSeriesIndex, pointIndex, hasPointSelected, onUpdate],
  );

  const handleToggleShowLabel = useCallback(() => {
    if (!hasPointSelected) return;
    const newChartData = updateSeriesPointShowLabel(
      chartData,
      selectedSeriesIndex,
      pointIndex,
      !showLabel,
    );
    onUpdate({ chartData: newChartData });
  }, [
    chartData,
    selectedSeriesIndex,
    pointIndex,
    showLabel,
    hasPointSelected,
    onUpdate,
  ]);

  const handleToggleShowValue = useCallback(() => {
    if (!hasPointSelected) return;
    const newChartData = updateSeriesPointShowValue(
      chartData,
      selectedSeriesIndex,
      pointIndex,
      !showValue,
    );
    onUpdate({ chartData: newChartData });
  }, [
    chartData,
    selectedSeriesIndex,
    pointIndex,
    showValue,
    hasPointSelected,
    onUpdate,
  ]);

  const handleBack = useCallback(() => {
    if (hasPointSelected && onDeselectPoint) {
      onDeselectPoint();
    } else {
      onDeselectSeries();
    }
  }, [hasPointSelected, onDeselectPoint, onDeselectSeries]);

  const canDelete = seriesData.length > 1;

  return (
    <div
      className="pointer-events-auto fixed z-[200] flex flex-col items-center"
      style={{
        left: position.x,
        top: position.y,
        transform: getOptionsBarTransform({
          ...position,
          above: position.above ?? false,
          align: position.align ?? "center",
        }),
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Main options bar */}
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5",
          "rounded-lg border border-gray-200 bg-white shadow-lg",
        )}
      >
        {/* Back button */}
        <button
          onClick={handleBack}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            "hover:bg-gray-100",
          )}
          title={hasPointSelected ? "Back to series" : "Back to chart"}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Series/Point info */}
        <div className="flex items-center gap-1 px-1">
          <span className="text-xs font-medium text-gray-600">
            {series.name}
          </span>
          {hasPointSelected && (
            <>
              <span className="text-xs text-gray-400">@</span>
              <span className="text-xs text-gray-500">{xLabel}</span>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Point-specific options (when point selected) */}
        {hasPointSelected ? (
          <>
            {/* Value input */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Value</span>
              <input
                type="text"
                inputMode="decimal"
                value={localValue}
                onChange={(e) => handlePointValueChange(e.target.value)}
                onBlur={handlePointValueBlur}
                onKeyDown={stopKeyPropagation}
                onMouseDown={stopMousePropagation}
                className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                placeholder="Value"
                maxLength={10}
              />
            </div>

            {/* Point color */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Color</span>
              <input
                type="color"
                value={pointColor}
                onChange={(e) => handlePointColorChange(e.target.value)}
                onMouseDown={stopMousePropagation}
                className="h-5 w-5 cursor-pointer rounded border-0"
                title="Point Color"
              />
            </div>

            {/* Divider */}
            <div className="mx-1 h-5 w-px bg-gray-200" />

            {/* Label toggle */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Label</span>
              <button
                onClick={handleToggleShowLabel}
                className={cn(
                  "relative h-4 w-7 rounded-full border transition-colors",
                  showLabel
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300 bg-gray-200",
                )}
                title={showLabel ? "Hide Label" : "Show Label"}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                    showLabel && "translate-x-3",
                  )}
                />
              </button>
            </div>

            {/* Value toggle */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Val</span>
              <button
                onClick={handleToggleShowValue}
                className={cn(
                  "relative h-4 w-7 rounded-full border transition-colors",
                  showValue
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300 bg-gray-200",
                )}
                title={showValue ? "Hide Value" : "Show Value"}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                    showValue && "translate-x-3",
                  )}
                />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Series color picker */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Color</span>
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(e.target.value)}
                onMouseDown={stopMousePropagation}
                className="h-5 w-5 cursor-pointer rounded border-0"
                title="Line Color"
              />
            </div>

            {/* Stroke width */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">W</span>
              <select
                value={strokeWidth}
                onChange={(e) =>
                  handleStrokeWidthChange(Number(e.target.value))
                }
                onMouseDown={stopMousePropagation}
                className="h-5 rounded border border-gray-200 px-0.5 text-xs"
              >
                {STROKE_WIDTH_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Line style */}
            <div className="flex items-center gap-0.5">
              {LINE_STYLE_OPTIONS.map(({ id, label, dash }) => (
                <button
                  key={id}
                  onClick={() => handleLineStyleChange(id)}
                  className={cn(
                    "flex h-5 w-7 items-center justify-center rounded border transition-colors",
                    lineStyle === id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300",
                  )}
                  title={label}
                >
                  <svg width="20" height="2" viewBox="0 0 20 2">
                    <line
                      x1="0"
                      y1="1"
                      x2="20"
                      y2="1"
                      stroke={lineStyle === id ? "#3b82f6" : "#6b7280"}
                      strokeWidth="2"
                      strokeDasharray={dash.join(",")}
                    />
                  </svg>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="mx-1 h-5 w-px bg-gray-200" />

            {/* Fill toggle */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Fill</span>
              <button
                onClick={handleFillToggle}
                className={cn(
                  "relative h-4 w-7 rounded-full border transition-colors",
                  fillEnabled
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300 bg-gray-200",
                )}
                title={fillEnabled ? "Disable fill" : "Enable fill"}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                    fillEnabled && "translate-x-3",
                  )}
                />
              </button>
            </div>

            {/* Fill opacity */}
            {fillEnabled && (
              <>
                <Slider
                  min={10}
                  max={50}
                  step={5}
                  value={[Math.round(fillOpacity * 100)]}
                  onValueChange={(v) => handleFillOpacityChange(v[0] / 100)}
                  onKeyDown={stopKeyPropagation}
                  onPointerDown={stopMousePropagation}
                  className="w-10"
                />
                <span className="text-[10px] text-gray-500">
                  {Math.round(fillOpacity * 100)}%
                </span>
              </>
            )}

            {/* Delete button */}
            {canDelete && (
              <>
                <div className="mx-1 h-5 w-px bg-gray-200" />
                <button
                  onClick={handleDeleteSeries}
                  className={cn(
                    "rounded-md p-1 transition-colors",
                    "text-gray-400 hover:bg-red-50 hover:text-red-500",
                  )}
                  title="Delete series"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
