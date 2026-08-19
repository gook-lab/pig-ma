import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import type { CanvasObject, ChartDataItem, ChartSeries } from "@/types";

// input 포커스 중 키보드 이벤트 전파 방지
const stopKeyPropagation = (e: KeyboardEvent) => {
  e.stopPropagation();
};

// input 포커스를 위해 마우스 이벤트 전파 방지
const stopMousePropagation = (e: MouseEvent) => {
  e.stopPropagation();
};

interface LegendOptionsBarProps {
  shape: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  selectedLegendIndex: number;
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onDeselectLegend: () => void;
}

export function LegendOptionsBar({
  shape,
  position,
  selectedLegendIndex,
  onUpdate,
  onDeselectLegend,
}: LegendOptionsBarProps) {
  const chartData = shape.chartData;

  if (!chartData) {
    return null;
  }

  const isLineChart = chartData.variant === "line" && chartData.series;
  const isValidIndex = isLineChart
    ? selectedLegendIndex >= 0 &&
      selectedLegendIndex < (chartData.series?.length ?? 0)
    : selectedLegendIndex >= 0 && selectedLegendIndex < chartData.items.length;

  if (!isValidIndex) {
    return null;
  }

  // 현재 선택된 범례 항목
  const currentLabel = isLineChart
    ? chartData.series![selectedLegendIndex]!.name
    : chartData.items[selectedLegendIndex]!.label;

  const globalColor = chartData.globalColor;

  // 실제 적용되는 색상: colorOverride가 true면 개별 색상, 아니면 globalColor 적용
  const currentColor = isLineChart
    ? chartData.series![selectedLegendIndex]!.style.colorOverride
      ? chartData.series![selectedLegendIndex]!.style.color
      : (globalColor ?? chartData.series![selectedLegendIndex]!.style.color)
    : chartData.items[selectedLegendIndex]!.colorOverride
      ? chartData.items[selectedLegendIndex]!.color
      : (globalColor ?? chartData.items[selectedLegendIndex]!.color);

  // Line chart 시리즈 업데이트
  const handleUpdateSeries = useCallback(
    (updates: Partial<ChartSeries>) => {
      if (!chartData.series) return;
      const newSeries = [...chartData.series];
      newSeries[selectedLegendIndex] = {
        ...newSeries[selectedLegendIndex]!,
        ...updates,
        style: {
          ...newSeries[selectedLegendIndex]!.style,
          ...(updates.style || {}),
        },
      };
      onUpdate({
        chartData: {
          ...chartData,
          series: newSeries,
        },
      });
    },
    [chartData, selectedLegendIndex, onUpdate],
  );

  // Bar/Pie 아이템 업데이트
  const handleUpdateItem = useCallback(
    (updates: Partial<ChartDataItem>) => {
      const newItems = [...chartData.items];
      newItems[selectedLegendIndex] = {
        ...newItems[selectedLegendIndex]!,
        ...updates,
      };
      onUpdate({
        chartData: {
          ...chartData,
          items: newItems,
        },
      });
    },
    [chartData, selectedLegendIndex, onUpdate],
  );

  // 라벨 변경
  const handleLabelChange = useCallback(
    (label: string) => {
      if (isLineChart) {
        handleUpdateSeries({ name: label });
      } else {
        handleUpdateItem({ label });
      }
    },
    [isLineChart, handleUpdateSeries, handleUpdateItem],
  );

  // 색상 변경
  const handleColorChange = useCallback(
    (color: string) => {
      if (isLineChart) {
        handleUpdateSeries({ style: { color, colorOverride: true } });
      } else {
        handleUpdateItem({ color, colorOverride: true });
      }
    },
    [isLineChart, handleUpdateSeries, handleUpdateItem],
  );

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
          onClick={onDeselectLegend}
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

        {/* Legend color picker */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Color</span>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => handleColorChange(e.target.value)}
            onMouseDown={stopMousePropagation}
            className="h-6 w-6 cursor-pointer rounded border-0"
            title="Legend Color"
          />
        </div>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Label input */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Label</span>
          <input
            type="text"
            value={currentLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
            onKeyDown={stopKeyPropagation}
            onMouseDown={stopMousePropagation}
            className="w-24 rounded border border-gray-200 px-2 py-1 text-xs"
            placeholder="Label"
          />
        </div>
      </div>
    </div>
  );
}
