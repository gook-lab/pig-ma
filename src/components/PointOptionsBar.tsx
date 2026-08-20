import {
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import type { CanvasObject, SelectedPoint } from "@/types";
import {
  getSeriesData,
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

interface PointOptionsBarProps {
  shape: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  selectedPoint: SelectedPoint;
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onDeselectPoint: () => void;
}

export function PointOptionsBar({
  shape,
  position,
  selectedPoint,
  onUpdate,
  onDeselectPoint,
}: PointOptionsBarProps) {
  const chartData = shape.chartData;

  // 조기 반환은 훅을 모두 호출한 뒤에 한다 (아래 early return) — 훅 위에서
  // 반환하면 chartData/series 유무에 따라 훅 개수가 달라진다.
  const seriesData = chartData ? getSeriesData(chartData) : [];
  const series = seriesData[selectedPoint.seriesIndex];
  const xLabel = chartData?.items[selectedPoint.pointIndex]?.label ?? "";

  const value = series?.values[selectedPoint.pointIndex] ?? 0;
  const pointColor =
    series?.pointColors?.[selectedPoint.pointIndex] ?? series?.style.color;
  const showLabel = series?.pointShowLabels?.[selectedPoint.pointIndex] ?? true;
  const showValue = series?.pointShowValues?.[selectedPoint.pointIndex] ?? true;

  // 로컬 value 입력 상태
  const [localValue, setLocalValue] = useState(String(value));

  // value가 외부에서 변경되면 로컬 상태 동기화
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleValueChange = useCallback(
    (inputValue: string) => {
      if (inputValue === "") {
        setLocalValue("");
        return;
      }

      // 정규식: 최대 8자리, 소수점 첫째자리까지만 허용
      const regex = /^-?\d{0,8}(\.\d{0,1})?$/;

      if (regex.test(inputValue)) {
        setLocalValue(inputValue);
        const numValue = parseFloat(inputValue);
        if (!isNaN(numValue) && chartData) {
          const newChartData = updateSeriesPointValue(
            chartData,
            selectedPoint.seriesIndex,
            selectedPoint.pointIndex,
            numValue,
          );
          onUpdate({ chartData: newChartData });
        }
      }
    },
    [chartData, selectedPoint, onUpdate],
  );

  const handleValueBlur = useCallback(() => {
    if (!chartData) return;
    if (localValue === "" || isNaN(parseFloat(localValue))) {
      setLocalValue("0");
      const newChartData = updateSeriesPointValue(
        chartData,
        selectedPoint.seriesIndex,
        selectedPoint.pointIndex,
        0,
      );
      onUpdate({ chartData: newChartData });
    }
  }, [localValue, chartData, selectedPoint, onUpdate]);

  const handleColorChange = useCallback(
    (color: string) => {
      if (!chartData) return;
      const newChartData = updateSeriesPointColor(
        chartData,
        selectedPoint.seriesIndex,
        selectedPoint.pointIndex,
        color,
      );
      onUpdate({ chartData: newChartData });
    },
    [chartData, selectedPoint, onUpdate],
  );

  const handleToggleShowLabel = useCallback(() => {
    if (!chartData) return;
    const newChartData = updateSeriesPointShowLabel(
      chartData,
      selectedPoint.seriesIndex,
      selectedPoint.pointIndex,
      !showLabel,
    );
    onUpdate({ chartData: newChartData });
  }, [chartData, selectedPoint, showLabel, onUpdate]);

  const handleToggleShowValue = useCallback(() => {
    if (!chartData) return;
    const newChartData = updateSeriesPointShowValue(
      chartData,
      selectedPoint.seriesIndex,
      selectedPoint.pointIndex,
      !showValue,
    );
    onUpdate({ chartData: newChartData });
  }, [chartData, selectedPoint, showValue, onUpdate]);

  if (!chartData || !series) return null;

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
          onClick={onDeselectPoint}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            "hover:bg-gray-100",
          )}
          title="Back to chart"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Point info */}
        <div className="flex items-center gap-1 px-1">
          <span className="text-xs font-medium text-gray-600">
            {series.name}
          </span>
          <span className="text-xs text-gray-400">@</span>
          <span className="text-xs text-gray-500">{xLabel}</span>
        </div>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Value input */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Value</span>
          <input
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={handleValueBlur}
            onKeyDown={stopKeyPropagation}
            onMouseDown={stopMousePropagation}
            className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
            placeholder="Value"
            maxLength={10}
          />
        </div>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Point color */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Color</span>
          <input
            type="color"
            value={pointColor}
            onChange={(e) => handleColorChange(e.target.value)}
            onMouseDown={stopMousePropagation}
            className="h-6 w-6 cursor-pointer rounded border-0"
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
              "relative h-5 w-9 rounded-full border transition-colors",
              showLabel
                ? "border-blue-500 bg-blue-500"
                : "border-gray-300 bg-gray-200",
            )}
            title={showLabel ? "Hide Label" : "Show Label"}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                showLabel && "translate-x-4",
              )}
            />
          </button>
        </div>

        {/* Value toggle */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">Value</span>
          <button
            onClick={handleToggleShowValue}
            className={cn(
              "relative h-5 w-9 rounded-full border transition-colors",
              showValue
                ? "border-blue-500 bg-blue-500"
                : "border-gray-300 bg-gray-200",
            )}
            title={showValue ? "Hide Value" : "Show Value"}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                showValue && "translate-x-4",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
