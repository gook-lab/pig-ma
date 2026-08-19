import {
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Edit3, ChevronDown, Plus, Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import { useGlobalCustomColors } from "@/hooks/useCustomColors";
import { CHART_COLORS } from "@/constants/colors";
import type { CanvasObject, ChartDataItem, ChartSortBy } from "@/types";
import {
  getSeriesData,
  addSeries,
  removeSeries,
  updateSeries,
  updateSeriesStyle,
  addXAxisPoint,
  removeXAxisPoint,
  updateSeriesPointValue,
} from "@/utils/chart";

// input 포커스 중 키보드 이벤트 전파 방지 (백스페이스로 객체 삭제 방지)
const stopKeyPropagation = (e: KeyboardEvent) => {
  e.stopPropagation();
};

// input 포커스를 위해 마우스 이벤트 전파 방지 (부모의 preventDefault 우회)
const stopMousePropagation = (e: MouseEvent) => {
  e.stopPropagation();
};

interface ChartOptionsBarProps {
  shape: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onOpenDataEditor?: () => void;
}

type ChartTab = "data" | "settings";

// Settings tab color palette
const TEXT_COLORS = [
  "#374151", // gray-700 (default)
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
  value: number | null;
  label: string;
  onChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value ?? 0));

  useEffect(() => {
    setLocalValue(String(value ?? 0));
  }, [value]);

  const handleChange = useCallback(
    (inputValue: string) => {
      if (inputValue === "") {
        setLocalValue("");
        return;
      }
      // Bar 차트와 동일한 정규식: 최대 8자리, 소수점 첫째자리까지, 음수 허용
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
        className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
        maxLength={10}
      />
    </div>
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

export function ChartOptionsBar({
  shape,
  position,
  onUpdate,
}: ChartOptionsBarProps) {
  const chartData = shape.chartData;
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<ChartTab>("data");
  const [showSeriesDropdown, setShowSeriesDropdown] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState<
    "fillColor" | "labelColor" | "valueColor" | null
  >(null);
  const { customColors, addIfNotInPalette } = useGlobalCustomColors();

  if (!chartData) return null;

  const isPie = chartData.variant === "pie";
  const isLine = chartData.variant === "line";
  const isBar = chartData.variant === "bar";
  const showLabels = chartData.showLabels ?? true;
  const showValues = chartData.showValues ?? true;
  const showLegend = chartData.showLegend ?? true;
  const innerRadius = chartData.innerRadius ?? 0;

  // Settings values
  const globalColor = chartData.globalColor;
  const labelColor = chartData.labelColor ?? "#374151";
  const valueColor = chartData.valueColor ?? "#374151";
  const cornerRadius = chartData.cornerRadius ?? 2;
  const sortBy = chartData.sortBy ?? "none";
  const showAxis = chartData.showAxis ?? true;
  const showYAxis = chartData.showYAxis ?? true;
  const showGridX = chartData.showGridX ?? (isLine ? false : true);
  const showGridY = chartData.showGridY ?? true;
  const selectedItemIndex = chartData.selectedItemIndex;
  const xAxisMargin = chartData.xAxisMargin ?? (isLine ? 16 : 0);
  const yAxisMargin = chartData.yAxisMargin ?? 0;
  const curveType = chartData.curveType ?? "linear";

  // Multi-series data (Line chart only)
  const seriesData = isLine ? getSeriesData(chartData) : [];
  const canAddSeries = seriesData.length < 5;

  // Editing series values
  const [editingSeriesIndex, setEditingSeriesIndex] = useState<number | null>(
    null,
  );

  const handleSelectItem = useCallback(
    (index: number) => {
      onUpdate({
        chartData: {
          ...chartData,
          selectedItemIndex: selectedItemIndex === index ? undefined : index,
        },
      });
    },
    [chartData, selectedItemIndex, onUpdate],
  );

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

  const handleInnerRadiusChange = useCallback(
    (value: number) => {
      onUpdate({
        chartData: {
          ...chartData,
          innerRadius: value,
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
        label: String.fromCharCode(65 + chartData.items.length), // A, B, C, ...
        value: 25,
        color: CHART_COLORS[chartData.items.length % CHART_COLORS.length],
      },
    ];

    // Auto-expand width for bar charts when items increase
    // Each bar needs ~35px minimum (bar + gap) + 60px for padding/axis
    const currentWidth = shape.width ?? 200;
    const minWidthPerItem = 35;
    const baseWidth = 60; // padding + Y-axis labels
    const minRequiredWidth = newItems.length * minWidthPerItem + baseWidth;

    const updates: Partial<CanvasObject> = {
      chartData: {
        ...chartData,
        items: newItems,
      },
    };

    // Only expand, never shrink automatically (pie charts don't need expansion)
    if (!isPie && minRequiredWidth > currentWidth) {
      updates.width = minRequiredWidth;
    }

    onUpdate(updates);
  }, [chartData, shape.width, isPie, onUpdate]);

  const handleRemoveItem = useCallback(
    (index: number) => {
      if (chartData.items.length <= 1) return;
      const newItems = chartData.items.filter((_, i) => i !== index);
      onUpdate({
        chartData: {
          ...chartData,
          items: newItems,
        },
      });
    },
    [chartData, onUpdate],
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

  const handleSelectSeries = useCallback(
    (index: number) => {
      onUpdate({
        chartData: {
          ...chartData,
          selectedSeriesIndex: index,
        },
      });
      setShowSeriesDropdown(false);
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

  // Line chart: 시리즈 이름 변경
  const handleUpdateSeriesName = useCallback(
    (seriesIndex: number, name: string) => {
      const newChartData = updateSeries(chartData, seriesIndex, { name });
      onUpdate({ chartData: newChartData });
    },
    [chartData, onUpdate],
  );

  // Line chart: 시리즈 색상 변경
  const handleUpdateSeriesColor = useCallback(
    (seriesIndex: number, color: string) => {
      const newChartData = updateSeriesStyle(chartData, seriesIndex, { color });
      onUpdate({ chartData: newChartData });
    },
    [chartData, onUpdate],
  );

  // Line chart: 시리즈 삭제
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

  // Line chart: X축 포인트 추가
  const handleAddPoint = useCallback(() => {
    const nextLabel = String.fromCharCode(65 + chartData.items.length); // A, B, C...
    const newChartData = addXAxisPoint(chartData, nextLabel, 30);

    // Auto-expand width for line charts when points increase
    // Each point needs ~40px minimum + 60px for padding/axis
    const currentWidth = shape.width ?? 200;
    const newPointCount = chartData.items.length + 1;
    const minWidthPerPoint = 40;
    const baseWidth = 60; // padding + axis labels
    const minRequiredWidth = newPointCount * minWidthPerPoint + baseWidth;

    const updates: Partial<CanvasObject> = {
      chartData: newChartData,
    };

    // Only expand, never shrink automatically
    if (minRequiredWidth > currentWidth) {
      updates.width = minRequiredWidth;
    }

    onUpdate(updates);
  }, [chartData, shape.width, onUpdate]);

  // Line chart: X축 포인트 삭제
  const handleRemovePoint = useCallback(
    (pointIndex: number) => {
      const newChartData = removeXAxisPoint(chartData, pointIndex);
      if (newChartData) {
        onUpdate({ chartData: newChartData });
      }
    },
    [chartData, onUpdate],
  );

  // Line chart: X축 라벨 변경
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

  // 패널이 위/아래 중 어디에 표시될지 결정
  const panelAbove = position.above ?? false;

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
      {/* Panel (above main bar when panelAbove is true) */}
      {showPanel && panelAbove && (
        <div
          className={cn(
            "mb-2 w-72 max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg",
          )}
        >
          {renderPanelContent()}
        </div>
      )}

      {/* Main options bar */}
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5",
          "popover-enter rounded-lg border border-gray-200 bg-white shadow-lg",
        )}
      >
        {/* Pie: Inner Radius (donut) */}
        {isPie && (
          <>
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-gray-500">Donut</span>
              <Slider
                min={0}
                max={40}
                value={[innerRadius]}
                onValueChange={(v) => handleInnerRadiusChange(v[0])}
                onKeyDown={stopKeyPropagation}
                onPointerDown={stopMousePropagation}
                className="w-16"
              />
            </div>
            <div className="mx-1 h-5 w-px bg-gray-200" />
          </>
        )}

        {/* Line: Series dropdown */}
        {isLine && (
          <>
            <div className="relative">
              <button
                onClick={() => setShowSeriesDropdown(!showSeriesDropdown)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                  "hover:bg-gray-100",
                  showSeriesDropdown && "bg-gray-100",
                )}
              >
                <span className="text-gray-500">Series</span>
                <span className="font-medium">{seriesData.length}</span>
                <ChevronDown className="h-3 w-3 text-gray-400" />
              </button>
              {showSeriesDropdown && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {seriesData.map((series, index) => (
                    <button
                      key={series.id}
                      onClick={() => handleSelectSeries(index)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: series.style.color }}
                      />
                      <span>{series.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add series button */}
            {canAddSeries && (
              <button
                onClick={handleAddSeries}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  "hover:bg-gray-100",
                )}
                title="Add series"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}

            <div className="mx-1 h-5 w-px bg-gray-200" />
          </>
        )}

        {/* Edit Data */}
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            "hover:bg-gray-100",
            showPanel && "bg-violet-100 text-violet-600",
          )}
          title="Edit Data"
        >
          <Edit3 className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Lock toggle */}
        <button
          onClick={() => onUpdate({ locked: !shape.locked })}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            "hover:bg-gray-100",
            shape.locked && "bg-red-100 text-red-600",
          )}
          title={shape.locked ? "Unlock" : "Lock"}
        >
          {shape.locked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <LockOpen className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Panel (below main bar when panelAbove is false) */}
      {showPanel && !panelAbove && (
        <div
          className={cn(
            "mt-2 w-72 max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg",
          )}
        >
          {renderPanelContent()}
        </div>
      )}
    </div>
  );

  // Panel content renderer
  function renderPanelContent() {
    return (
      <>
        {/* Tab Header */}
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

        {/* Tab Content */}
        <div className="p-3">
          {activeTab === "data" && (
            <div className="space-y-2">
              {/* Line chart: 시리즈 중심 UI */}
              {isLine ? (
                <>
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
                          <input
                            type="color"
                            value={series.style.color}
                            onChange={(e) =>
                              handleUpdateSeriesColor(seriesIdx, e.target.value)
                            }
                            onMouseDown={stopMousePropagation}
                            onClick={(e) => e.stopPropagation()}
                            className="h-5 w-5 cursor-pointer rounded border-0"
                          />
                          <input
                            type="text"
                            value={series.name}
                            onChange={(e) =>
                              handleUpdateSeriesName(seriesIdx, e.target.value)
                            }
                            onKeyDown={stopKeyPropagation}
                            onMouseDown={stopMousePropagation}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs"
                            placeholder="Series name"
                          />
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
                          <div className="space-y-1.5 border-t border-gray-200 p-2 pt-2">
                            {/* Header labels */}
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-wide">
                              <span className="w-16">Label</span>
                              <span className="flex-1">Value</span>
                            </div>
                            {series.values.map((val, pointIdx) => (
                              <div
                                key={pointIdx}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={
                                    chartData?.items[pointIdx]?.label ??
                                    String(pointIdx)
                                  }
                                  onChange={(e) =>
                                    handleUpdatePointLabel(
                                      pointIdx,
                                      e.target.value,
                                    )
                                  }
                                  onKeyDown={stopKeyPropagation}
                                  onMouseDown={stopMousePropagation}
                                  className="w-16 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
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
                                {(chartData?.items.length ?? 0) > 1 && (
                                  <button
                                    onClick={() => handleRemovePoint(pointIdx)}
                                    className="text-gray-400 hover:text-red-500"
                                    title="Remove point"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={handleAddPoint}
                              className="w-full rounded border border-dashed border-gray-300 py-1 text-xs text-violet-600 hover:border-violet-400 hover:bg-violet-50"
                            >
                              + Add point
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add series button */}
                  {canAddSeries && (
                    <button
                      onClick={handleAddSeries}
                      className="w-full rounded border border-dashed border-gray-300 py-1.5 text-xs text-violet-600 hover:border-violet-400 hover:bg-violet-50"
                    >
                      + Add series
                    </button>
                  )}
                </>
              ) : (
                /* Bar/Pie chart: 기존 UI */
                <>
                  {chartData?.items.map((item, index) => {
                    const itemShowLabel = item.showLabel ?? true;
                    const itemShowValue = item.showValue ?? true;
                    const isItemSelected = selectedItemIndex === index;
                    // 실제 적용되는 색상
                    const itemDisplayColor = item.colorOverride
                      ? item.color
                      : (globalColor ?? item.color);
                    return (
                      <div
                        key={index}
                        className={cn(
                          "space-y-1 rounded-md p-1 -mx-1 cursor-pointer transition-colors",
                          isItemSelected
                            ? "bg-violet-50 ring-1 ring-violet-300"
                            : "hover:bg-gray-50",
                        )}
                        onClick={() => handleSelectItem(index)}
                      >
                        <div className="flex items-center gap-2">
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
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 cursor-pointer rounded border-0"
                          />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) =>
                              handleUpdateItem(index, { label: e.target.value })
                            }
                            onKeyDown={stopKeyPropagation}
                            onMouseDown={stopMousePropagation}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
                            placeholder="Name"
                          />
                          <input
                            type="number"
                            value={item.value}
                            onChange={(e) =>
                              handleUpdateItem(index, {
                                value: Number(e.target.value),
                              })
                            }
                            onKeyDown={stopKeyPropagation}
                            onMouseDown={stopMousePropagation}
                            onClick={(e) => e.stopPropagation()}
                            className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
                            placeholder="Value"
                          />
                          {(chartData?.items.length ?? 0) > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItem(index);
                              }}
                              className="text-gray-400 hover:text-red-500"
                              title="Remove"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <div
                          className="ml-8 flex items-center gap-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500">
                              Label
                            </span>
                            <button
                              onClick={() =>
                                handleUpdateItem(index, {
                                  showLabel: !itemShowLabel,
                                })
                              }
                              onMouseDown={stopMousePropagation}
                              className={cn(
                                "relative h-5 w-9 rounded-full border transition-colors",
                                itemShowLabel
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300 bg-gray-200",
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                                  itemShowLabel && "translate-x-4",
                                )}
                              />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500">
                              Value
                            </span>
                            <button
                              onClick={() =>
                                handleUpdateItem(index, {
                                  showValue: !itemShowValue,
                                })
                              }
                              onMouseDown={stopMousePropagation}
                              className={cn(
                                "relative h-5 w-9 rounded-full border transition-colors",
                                itemShowValue
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300 bg-gray-200",
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform",
                                  itemShowValue && "translate-x-4",
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={handleAddItem}
                    className="w-full rounded border border-dashed border-gray-300 py-1.5 text-xs text-violet-600 hover:border-violet-400 hover:bg-violet-50"
                  >
                    + Add another {isPie ? "slice" : "bar"}
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* Labels / Values / Legend toggles */}
              <div className="space-y-1.5 rounded-md border border-gray-200 px-3 py-2">
                <div className="text-[10px] text-gray-500">Display</div>
                <p className="text-[9px] text-gray-400">
                  Toggle visibility of labels, values, and legend
                </p>
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

              {/* Sort */}
              <div className="space-y-1.5 rounded-md border border-gray-200 px-3 py-2">
                <div className="text-[10px] text-gray-500">Sort</div>
                <p className="text-[9px] text-gray-400">
                  Order data points by value or keep original
                </p>
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
                <div className="text-xs font-semibold text-gray-700">
                  Colors
                </div>
                <p className="text-[9px] text-gray-400">
                  Customize fill, label, and value colors
                </p>

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
                            showCustomPicker === "fillColor"
                              ? null
                              : "fillColor",
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
                          showCustomPicker === "labelColor"
                            ? null
                            : "labelColor",
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
                          showCustomPicker === "valueColor"
                            ? null
                            : "valueColor",
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

              {/* Style Section (Line only) */}
              {isLine && (
                <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs font-semibold text-gray-700">
                    Line Style
                  </div>
                  <p className="text-[9px] text-gray-400">
                    Choose line type between straight or curved
                  </p>
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
                </div>
              )}

              {/* Bar Style Section (Bar only) */}
              {isBar && (
                <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs font-semibold text-gray-700">
                    Bar Style
                  </div>
                  <p className="text-[9px] text-gray-400">
                    Adjust bar corner roundness
                  </p>
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-medium text-gray-500">
                      Corner Radius
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
                  <p className="text-[9px] text-gray-400">
                    Show or hide gridlines and axis labels
                  </p>

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
                            max={isLine ? 32 : 30}
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
                        </div>
                      )}
                      {showYAxis && (
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-[10px] text-gray-500">
                            Y-axis
                          </span>
                          <Slider
                            min={0}
                            max={30}
                            value={[yAxisMargin]}
                            onValueChange={(v) => handleYAxisMarginChange(v[0])}
                            onKeyDown={stopKeyPropagation}
                            onPointerDown={stopMousePropagation}
                            className="flex-1"
                          />
                          <span className="w-8 text-right text-[10px] text-gray-400">
                            {yAxisMargin}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }
}
