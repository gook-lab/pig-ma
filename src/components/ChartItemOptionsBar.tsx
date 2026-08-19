import {
  useCallback,
  useState,
  useEffect,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import type { CanvasObject, ChartDataItem, CornerPosition } from "@/types";

// input 포커스 중 키보드 이벤트 전파 방지
const stopKeyPropagation = (e: KeyboardEvent) => {
  e.stopPropagation();
};

// input 포커스를 위해 마우스 이벤트 전파 방지
const stopMousePropagation = (e: MouseEvent) => {
  e.stopPropagation();
};

// 폰트 크기 옵션 (2-16 범위)
const FONT_SIZES = [2, 4, 6, 8, 10, 12, 14, 16];

interface ChartItemOptionsBarProps {
  shape: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  selectedItemIndex: number;
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onDeselectItem: () => void;
}

export function ChartItemOptionsBar({
  shape,
  position,
  selectedItemIndex,
  onUpdate,
  onDeselectItem,
}: ChartItemOptionsBarProps) {
  const chartData = shape.chartData;

  if (
    !chartData ||
    selectedItemIndex < 0 ||
    selectedItemIndex >= chartData.items.length
  ) {
    return null;
  }

  const item = chartData.items[selectedItemIndex]!;
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
  const cornerRadius = item.cornerRadius ?? 2;
  const cornerPosition = item.cornerPosition ?? "top";
  const isBarChart = chartData.variant === "bar";

  // 로컬 입력 상태 (편집 중 빈 값 허용)
  const [localLabel, setLocalLabel] = useState(item.label);
  const [localValue, setLocalValue] = useState(String(item.value));

  // item이 외부에서 변경되면 로컬 상태 동기화
  useEffect(() => {
    setLocalLabel(item.label);
  }, [item.label]);

  useEffect(() => {
    setLocalValue(String(item.value));
  }, [item.value]);

  const handleUpdateItem = useCallback(
    (updates: Partial<ChartDataItem>) => {
      const newItems = [...chartData.items];
      newItems[selectedItemIndex] = {
        ...newItems[selectedItemIndex]!,
        ...updates,
      };
      onUpdate({
        chartData: {
          ...chartData,
          items: newItems,
        },
      });
    },
    [chartData, selectedItemIndex, onUpdate],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      handleUpdateItem({ color, colorOverride: true });
    },
    [handleUpdateItem],
  );

  const handleLabelColorChange = useCallback(
    (labelColor: string) => {
      handleUpdateItem({ labelColor });
    },
    [handleUpdateItem],
  );

  const handleValueColorChange = useCallback(
    (valueColor: string) => {
      handleUpdateItem({ valueColor });
    },
    [handleUpdateItem],
  );

  const handleCornerRadiusChange = useCallback(
    (cornerRadius: number) => {
      handleUpdateItem({ cornerRadius });
    },
    [handleUpdateItem],
  );

  const handleCornerPositionChange = useCallback(
    (cornerPosition: CornerPosition) => {
      handleUpdateItem({ cornerPosition });
    },
    [handleUpdateItem],
  );

  const handleToggleLabel = useCallback(() => {
    handleUpdateItem({ showLabel: !showLabel });
  }, [handleUpdateItem, showLabel]);

  const handleToggleValue = useCallback(() => {
    handleUpdateItem({ showValue: !showValue });
  }, [handleUpdateItem, showValue]);

  const handleLabelFontSizeChange = useCallback(
    (size: number) => {
      handleUpdateItem({ labelFontSize: size });
    },
    [handleUpdateItem],
  );

  const handleValueFontSizeChange = useCallback(
    (size: number) => {
      handleUpdateItem({ valueFontSize: size });
    },
    [handleUpdateItem],
  );

  const handleLabelChange = useCallback(
    (inputValue: string) => {
      setLocalLabel(inputValue);
      handleUpdateItem({ label: inputValue });
    },
    [handleUpdateItem],
  );

  const handleValueChange = useCallback(
    (inputValue: string) => {
      // 빈 값 허용 (편집 중)
      if (inputValue === "") {
        setLocalValue("");
        return;
      }

      // 정규식: 최대 8자리, 소수점 첫째자리까지만 허용
      const regex = /^-?\d{0,8}(\.\d{0,1})?$/;

      if (regex.test(inputValue)) {
        setLocalValue(inputValue);
        const numValue = parseFloat(inputValue);
        if (!isNaN(numValue)) {
          handleUpdateItem({ value: numValue });
        }
      }
    },
    [handleUpdateItem],
  );

  const handleValueBlur = useCallback(() => {
    // 포커스 잃을 때 빈 값이면 0으로 설정
    if (localValue === "" || isNaN(parseFloat(localValue))) {
      setLocalValue("0");
      handleUpdateItem({ value: 0 });
    }
  }, [localValue, handleUpdateItem]);

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
          onClick={onDeselectItem}
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

        {/* Background color picker */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">BG</span>
          <input
            type="color"
            value={displayColor}
            onChange={(e) => handleColorChange(e.target.value)}
            onMouseDown={stopMousePropagation}
            className="h-6 w-6 cursor-pointer rounded border-0"
            title="Background Color"
          />
        </div>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Toggle Label */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Label</span>
          <button
            onClick={handleToggleLabel}
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

        {/* Toggle Value */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Value</span>
          <button
            onClick={handleToggleValue}
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

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* Label font size */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">L</span>
          <select
            value={labelFontSize}
            onChange={(e) => handleLabelFontSizeChange(Number(e.target.value))}
            onMouseDown={stopMousePropagation}
            className="h-6 w-10 rounded border border-gray-200 px-0.5 text-xs"
            title="Label Font Size"
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Value font size */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">V</span>
          <select
            value={valueFontSize}
            onChange={(e) => handleValueFontSizeChange(Number(e.target.value))}
            onMouseDown={stopMousePropagation}
            className="h-6 w-10 rounded border border-gray-200 px-0.5 text-xs"
            title="Value Font Size"
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Extended panel below */}
      <div
        className={cn(
          "mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg",
        )}
      >
        {/* Label input with color */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">Label</label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">Color</span>
              <input
                type="color"
                value={labelColor}
                onChange={(e) => handleLabelColorChange(e.target.value)}
                onMouseDown={stopMousePropagation}
                className="h-5 w-5 cursor-pointer rounded border-0"
                title="Label Color"
              />
            </div>
          </div>
          <input
            type="text"
            value={localLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={stopKeyPropagation}
            onMouseDown={stopMousePropagation}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
            placeholder="Label"
          />
        </div>

        {/* Value input with color */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">Value</label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">Color</span>
              <input
                type="color"
                value={valueColor}
                onChange={(e) => handleValueColorChange(e.target.value)}
                onMouseDown={stopMousePropagation}
                className="h-5 w-5 cursor-pointer rounded border-0"
                title="Value Color"
              />
            </div>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={(e) => handleValueChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={handleValueBlur}
            onKeyDown={stopKeyPropagation}
            onMouseDown={stopMousePropagation}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
            placeholder="Value"
            maxLength={10}
          />
        </div>

        {/* Corner radius - bar chart only */}
        {isBarChart && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">
                Rounded
              </label>
              <span className="text-[10px] text-gray-500">
                {cornerRadius}px
              </span>
            </div>
            <Slider
              min={0}
              max={20}
              value={[cornerRadius]}
              onValueChange={(v) => handleCornerRadiusChange(v[0]!)}
              onPointerDown={stopMousePropagation}
              className="w-full"
            />
            {/* Corner position selector */}
            <div className="flex gap-1">
              {(["top", "bottom", "all"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => handleCornerPositionChange(pos)}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                    cornerPosition === pos
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {pos === "top" ? "Top" : pos === "bottom" ? "Bottom" : "All"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
