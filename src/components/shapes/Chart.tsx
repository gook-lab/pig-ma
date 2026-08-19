import { memo, useMemo, useRef, useCallback } from "react";
import { Group, Rect, Line, Circle, Wedge, Arc, Text } from "react-konva";
import Konva from "konva";
import type {
  CanvasObject,
  ChartData,
  ChartDataItem,
  ChartSortBy,
  SelectedPoint,
} from "@/types";
import { SelectionBorder } from "@/components/SelectionBorder";
import {
  getSeriesData,
  getLineDash,
  formatChartValue,
  roundTickValue,
  estimateLabelWidth,
  getLabelStep,
} from "@/utils/chart";

interface ChartProps {
  shape: CanvasObject;
  isSelected: boolean;
  isMultiSelected?: boolean;
  zoom?: number;
  draggable?: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDoubleClick?: () => void;
  onHeaderDoubleClick?: () => void;
  onUpdate?: (updates: Partial<CanvasObject>) => void;
  isEditingTitle?: boolean;
}

// Sort items based on sortBy option
function sortItems(
  items: ChartDataItem[],
  sortBy: ChartSortBy,
): ChartDataItem[] {
  if (sortBy === "none") return items;

  const sorted = [...items];
  switch (sortBy) {
    case "value-asc":
      return sorted.sort((a, b) => a.value - b.value);
    case "value-desc":
      return sorted.sort((a, b) => b.value - a.value);
    case "label-asc":
      return sorted.sort((a, b) => a.label.localeCompare(b.label));
    case "label-desc":
      return sorted.sort((a, b) => b.label.localeCompare(a.label));
    default:
      return items;
  }
}

// 색상 밝기 조절 (그라디언트용)
function adjustColor(hex: string, amount: number): string {
  // hex to RGB
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  // Adjust
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));

  // RGB to hex
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Bar Chart Renderer
function BarChartRenderer({
  data,
  width,
  height,
  legendHeight = 0,
  selectedItemIndex,
  onItemSelect,
  isChartSelected,
  onChartSelect,
}: {
  data: ChartData;
  width: number;
  height: number;
  legendHeight?: number;
  selectedItemIndex?: number;
  onItemSelect?: (index: number) => void;
  isChartSelected?: boolean;
  onChartSelect?: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
}) {
  const {
    items,
    showLabels,
    showValues = true,
    sortBy = "none",
    labelColor = "#374151",
    valueColor = "#374151",
    labelBold = false,
    valueBold = false,
    valueOffsetY = 0,
    valuePosition = "top",
    globalColor,
    cornerRadius = 2,
    showAxis = true,
    showYAxis = true,
    showGridX = true,
    showGridY = true,
    xAxisMargin = 0,
    yAxisMargin = 0,
    orientation = "vertical",
  } = data;
  const isHorizontal = orientation === "horizontal";
  const padding = 20;
  // 수평: 왼쪽에 카테고리 라벨, 수직: 왼쪽에 Y축 값
  const leftPadding = isHorizontal
    ? showLabels
      ? 16
      : 5
    : showYAxis
      ? 40
      : 10;
  const bottomPadding = isHorizontal ? (showYAxis ? 20 : 0) : 0;
  const rightPadding = isHorizontal ? 10 : 20;
  const labelHeight =
    !isHorizontal && showLabels && showAxis ? 16 : bottomPadding;
  const chartWidth = width - leftPadding - rightPadding;
  const chartHeight = height - padding * 2 - labelHeight - legendHeight;

  // X축 마진 적용 (최소 10px 보장)
  const maxXMargin = Math.max(0, (chartWidth - 20) / 2);
  const actualXMargin = Math.min(xAxisMargin, maxXMargin);
  const effectiveWidth = Math.max(10, chartWidth - actualXMargin * 2);
  const startX = actualXMargin;

  // Y축 마진 적용 (최소 10px 보장)
  const maxYMargin = Math.max(0, (chartHeight - 20) / 2);
  const actualYMargin = Math.min(yAxisMargin, maxYMargin);
  const effectiveHeight = Math.max(10, chartHeight - actualYMargin * 2);
  const startY = actualYMargin;

  const sortedItems = useMemo(() => sortItems(items, sortBy), [items, sortBy]);

  // 10의 자리로 반올림 (올림: 양수, 내림: 음수)
  const roundToTen = (value: number, direction: "up" | "down") => {
    if (direction === "up") {
      return Math.ceil(value / 10) * 10;
    } else {
      return Math.floor(value / 10) * 10;
    }
  };

  // 최소/최대값 계산 (10의 자리 반올림)
  const { minValue, maxValue } = useMemo(() => {
    const values = sortedItems.map((item) => item.value);
    const rawMin = Math.min(...values, 0);
    const rawMax = Math.max(...values, 1);
    return {
      minValue: rawMin < 0 ? roundToTen(rawMin, "down") : 0,
      maxValue: roundToTen(rawMax, "up") || 10,
    };
  }, [sortedItems]);

  const valueRange = maxValue - minValue;
  const itemCount = sortedItems.length;

  // 동적 gap 및 barSize 계산: 차트 크기에 맞게 스케일링
  const idealGap = 8;
  const minBarSize = 2;
  const minGap = 1;

  // 수평: barSize는 막대 높이 (effectiveHeight 기준)
  // 수직: barSize는 막대 너비 (effectiveWidth 기준)
  const availableSpace = isHorizontal ? effectiveHeight : effectiveWidth;
  const idealBarSize =
    (availableSpace - (itemCount - 1) * idealGap) / itemCount;

  let barSize: number;
  let gap: number;

  if (idealBarSize >= minBarSize) {
    barSize = idealBarSize;
    gap = idealGap;
  } else {
    const totalMinBarSize = itemCount * minBarSize;
    const availableForGaps = Math.max(0, availableSpace - totalMinBarSize);
    gap = Math.max(minGap, availableForGaps / Math.max(1, itemCount - 1));
    barSize = Math.max(
      minBarSize,
      (availableSpace - (itemCount - 1) * gap) / itemCount,
    );
  }

  // 동적 폰트 크기: 막대 크기에 따라 축소 (최소 6px, 최대 10px)
  const dynamicFontScale = Math.min(1, Math.max(0.6, barSize / 25));
  const getScaledFontSize = (baseFontSize: number) =>
    Math.max(6, Math.round(baseFontSize * dynamicFontScale));

  // 텍스트 최소 width (value/label이 항상 보이도록)
  const minTextWidth = 20;
  const textWidth = Math.max(barSize, minTextWidth);

  // 카테고리 라벨 겹침 방지: 항목당 슬롯보다 라벨이 크면 N개마다 하나만
  // 표시한다 (수직: 라벨 폭 기준, 수평: 행 높이 대비 폰트 높이 기준).
  const labelSlot = barSize + gap;
  const labelStep = isHorizontal
    ? getLabelStep(getScaledFontSize(10) + 2, labelSlot)
    : getLabelStep(
        sortedItems.reduce(
          (max, it) =>
            Math.max(
              max,
              estimateLabelWidth(
                it.label,
                getScaledFontSize(it.labelFontSize ?? it.fontSize ?? 10),
              ),
            ),
          0,
        ) + 4,
        labelSlot,
      );

  // Value axis tick values (수직: Y축, 수평: X축)
  const valueTicks = useMemo(() => {
    const tickCount = 4;
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const value = roundTickValue(
        minValue + (valueRange / tickCount) * i,
        valueRange,
      );
      if (isHorizontal) {
        // 수평: X축에 값 틱
        const x = startX + ((value - minValue) / valueRange) * effectiveWidth;
        ticks.push({ value, x, y: 0 });
      } else {
        // 수직: Y축에 값 틱
        const y =
          startY +
          effectiveHeight -
          ((value - minValue) / valueRange) * effectiveHeight;
        ticks.push({ value, x: 0, y });
      }
    }
    return ticks;
  }, [
    minValue,
    valueRange,
    effectiveWidth,
    effectiveHeight,
    startX,
    startY,
    isHorizontal,
  ]);

  // 정렬 후 원본 인덱스 매핑
  const originalIndices = useMemo(() => {
    if (sortBy === "none") return items.map((_, i) => i);
    const indexed = items.map((item, i) => ({ item, originalIndex: i }));
    const sorted = [...indexed];
    switch (sortBy) {
      case "value-asc":
        sorted.sort((a, b) => a.item.value - b.item.value);
        break;
      case "value-desc":
        sorted.sort((a, b) => b.item.value - a.item.value);
        break;
      case "label-asc":
        sorted.sort((a, b) => a.item.label.localeCompare(b.item.label));
        break;
      case "label-desc":
        sorted.sort((a, b) => b.item.label.localeCompare(a.item.label));
        break;
    }
    return sorted.map((s) => s.originalIndex);
  }, [items, sortBy]);

  // 0선 좌표 (수직: Y좌표, 수평: X좌표)
  const zeroLinePos = isHorizontal
    ? startX + ((0 - minValue) / valueRange) * effectiveWidth
    : startY +
      effectiveHeight -
      ((0 - minValue) / valueRange) * effectiveHeight;

  return (
    <Group x={leftPadding} y={padding}>
      {/* Value Axis Line (수직: Y축, 수평: X축 하단) */}
      {showYAxis && !isHorizontal && (
        <Line
          points={[0, 0, 0, chartHeight]}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      )}
      {showYAxis && isHorizontal && (
        <Line
          points={[0, chartHeight, chartWidth, chartHeight]}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      )}

      {/* Category Axis Line (수직: X축, 수평: Y축) */}
      {showAxis && !isHorizontal && (
        <Line
          points={[
            0,
            startY + effectiveHeight,
            chartWidth,
            startY + effectiveHeight,
          ]}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      )}
      {showAxis && isHorizontal && (
        <Line
          points={[0, 0, 0, chartHeight]}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      )}

      {/* Value Axis Labels & Ticks */}
      {showYAxis &&
        valueTicks.map((tick, i) =>
          isHorizontal ? (
            // 수평: X축 하단에 값 라벨
            <Group key={i}>
              <Line
                points={[tick.x, chartHeight, tick.x, chartHeight + 4]}
                stroke="#9ca3af"
                strokeWidth={1}
              />
              <Text
                x={tick.x - 16}
                y={chartHeight + 6}
                width={32}
                text={formatChartValue(tick.value)}
                fontSize={9}
                fill="#9ca3af"
                align="center"
              />
            </Group>
          ) : (
            // 수직: Y축 왼쪽에 값 라벨
            <Group key={i}>
              <Line
                points={[-4, tick.y, 0, tick.y]}
                stroke="#9ca3af"
                strokeWidth={1}
              />
              <Text
                x={-38}
                y={tick.y - 5}
                width={32}
                text={formatChartValue(tick.value)}
                fontSize={9}
                fill="#9ca3af"
                align="right"
              />
            </Group>
          ),
        )}

      {/* Value Grid lines */}
      {showGridY &&
        valueTicks.map((tick, i) =>
          isHorizontal ? (
            // 수평: 수직 그리드선 (값 기준)
            <Line
              key={`grid-v-${i}`}
              points={[tick.x, 0, tick.x, chartHeight]}
              stroke="#e5e7eb"
              strokeWidth={1}
              dash={[4, 4]}
            />
          ) : (
            // 수직: 수평 그리드선 (값 기준)
            <Line
              key={`grid-h-${i}`}
              points={[0, tick.y, chartWidth, tick.y]}
              stroke="#e5e7eb"
              strokeWidth={1}
              dash={[4, 4]}
            />
          ),
        )}

      {/* Category Grid lines */}
      {showGridX &&
        sortedItems.map((_, i) => {
          if (isHorizontal) {
            // 수평: 수평 그리드선 (카테고리 기준)
            const y = startY + i * (barSize + gap) + barSize / 2;
            return (
              <Line
                key={`grid-cat-${i}`}
                points={[0, y, chartWidth, y]}
                stroke="#e5e7eb"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          } else {
            // 수직: 수직 그리드선 (카테고리 기준)
            const x = startX + i * (barSize + gap) + barSize / 2;
            return (
              <Line
                key={`grid-cat-${i}`}
                points={[x, 0, x, chartHeight]}
                stroke="#e5e7eb"
                strokeWidth={1}
                dash={[4, 4]}
              />
            );
          }
        })}

      {/* Bars */}
      {sortedItems.map((item, i) => {
        // colorOverride가 true면 개별 색상 우선, 아니면 globalColor 적용
        const fillColor = item.colorOverride
          ? item.color
          : (globalColor ?? item.color);
        const itemShowLabel = item.showLabel ?? true;
        const itemShowValue = item.showValue ?? true;
        const itemLabelFontSize = item.labelFontSize ?? item.fontSize ?? 10;
        const itemValueFontSize = item.valueFontSize ?? item.fontSize ?? 10;
        const itemLabelColor = item.labelColor ?? labelColor;
        const itemValueColor = item.valueColor ?? valueColor;
        const itemLabelBold = item.labelBold ?? labelBold;
        const itemValueBold = item.valueBold ?? valueBold;
        const itemValueOffsetY = item.valueOffsetY ?? valueOffsetY;
        const itemCornerRadius = item.cornerRadius ?? cornerRadius;
        const itemCornerPosition = item.cornerPosition ?? "top";
        const originalIndex = originalIndices[i]!;
        const isItemSelected = selectedItemIndex === originalIndex;

        // 수평/수직에 따른 바 위치 및 크기 계산
        let barX: number, barY: number, barW: number, barH: number;
        let cornerRadiusArray: number | number[];

        if (isHorizontal) {
          // 수평 바: X축이 값, Y축이 카테고리
          const valueLength =
            (Math.abs(item.value) / valueRange) * effectiveWidth;
          barY = startY + i * (barSize + gap);
          barH = barSize;
          barW = valueLength;
          // 양수: 0선 오른쪽, 음수: 0선 왼쪽
          barX = item.value >= 0 ? zeroLinePos : zeroLinePos - valueLength;
          // 수평 바 모서리: right 또는 left
          cornerRadiusArray =
            itemCornerPosition === "top" // top → right for horizontal
              ? [0, itemCornerRadius, itemCornerRadius, 0]
              : itemCornerPosition === "bottom" // bottom → left for horizontal
                ? [itemCornerRadius, 0, 0, itemCornerRadius]
                : itemCornerRadius;
        } else {
          // 수직 바: Y축이 값, X축이 카테고리
          const valueHeight =
            (Math.abs(item.value) / valueRange) * effectiveHeight;
          barX = startX + i * (barSize + gap);
          barW = barSize;
          barH = valueHeight;
          // 양수: 0선 위, 음수: 0선 아래
          barY = item.value >= 0 ? zeroLinePos - valueHeight : zeroLinePos;
          cornerRadiusArray =
            itemCornerPosition === "top"
              ? [itemCornerRadius, itemCornerRadius, 0, 0]
              : itemCornerPosition === "bottom"
                ? [0, 0, itemCornerRadius, itemCornerRadius]
                : itemCornerRadius;
        }

        return (
          <Group
            key={i}
            onClick={(e) => {
              e.cancelBubble = true;
              if (!isChartSelected) {
                onChartSelect?.(e);
              } else {
                onItemSelect?.(originalIndex);
              }
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (!isChartSelected) {
                onChartSelect?.(e);
              } else {
                onItemSelect?.(originalIndex);
              }
            }}
          >
            <Rect
              x={barX}
              y={barY}
              width={barW}
              height={barH}
              fill={fillColor}
              cornerRadius={cornerRadiusArray}
              stroke={isItemSelected ? "#3b82f6" : undefined}
              strokeWidth={isItemSelected ? 2 : 0}
            />
            {/* Value label */}
            {showValues &&
              itemShowValue &&
              (() => {
                const scaledValueFontSize =
                  getScaledFontSize(itemValueFontSize);
                if (isHorizontal) {
                  // 수평: 바 오른쪽 끝에 값 표시
                  const textX = item.value >= 0 ? barX + barW + 4 : barX - 24;
                  return (
                    <Text
                      x={textX}
                      y={barY + barH / 2 - scaledValueFontSize / 2}
                      width={20}
                      text={formatChartValue(item.value)}
                      fontSize={scaledValueFontSize}
                      fontStyle={itemValueBold ? "bold" : "normal"}
                      fill={itemValueColor}
                      align={item.value >= 0 ? "left" : "right"}
                    />
                  );
                } else {
                  // 수직: 바 위에 값 표시
                  const textX = barX + barW / 2 - textWidth / 2;
                  return (
                    <Text
                      x={textX}
                      y={
                        valuePosition === "center"
                          ? barY +
                            barH / 2 -
                            scaledValueFontSize / 2 +
                            itemValueOffsetY
                          : barY - scaledValueFontSize - 4 + itemValueOffsetY
                      }
                      width={textWidth}
                      text={formatChartValue(item.value)}
                      fontSize={scaledValueFontSize}
                      fontStyle={itemValueBold ? "bold" : "normal"}
                      fill={itemValueColor}
                      align="center"
                    />
                  );
                }
              })()}
            {/* Category label */}
            {showAxis &&
              showLabels &&
              itemShowLabel &&
              (() => {
                // 슬롯이 좁으면 labelStep 간격으로만 라벨을 표시한다
                if (i % labelStep !== 0) return null;
                const scaledLabelFontSize =
                  getScaledFontSize(itemLabelFontSize);
                if (isHorizontal) {
                  // 수평: 바 왼쪽에 라벨 표시
                  return (
                    <Text
                      x={-leftPadding + 4}
                      y={barY + barH / 2 - scaledLabelFontSize / 2}
                      width={leftPadding - 8}
                      text={item.label}
                      fontSize={scaledLabelFontSize}
                      fontStyle={itemLabelBold ? "bold" : "normal"}
                      fill={itemLabelColor}
                      align="right"
                      wrap="none"
                      ellipsis
                    />
                  );
                } else {
                  // 수직: 바 아래에 라벨 표시 — 표시되는 라벨은 건너뛴
                  // 슬롯 폭까지 쓰고, 넘치면 말줄임한다
                  const labelW = Math.max(textWidth, labelSlot * labelStep - 4);
                  const textX = barX + barW / 2 - labelW / 2;
                  return (
                    <Text
                      x={textX}
                      y={startY + effectiveHeight + 4}
                      width={labelW}
                      text={item.label}
                      fontSize={scaledLabelFontSize}
                      fontStyle={itemLabelBold ? "bold" : "normal"}
                      fill={itemLabelColor}
                      align="center"
                      wrap="none"
                      ellipsis
                    />
                  );
                }
              })()}
          </Group>
        );
      })}
    </Group>
  );
}

// Line Chart Renderer (Multi-series support)
function LineChartRenderer({
  data,
  width,
  height,
  legendHeight = 0,
  selectedItemIndex: _selectedItemIndex,
  onItemSelect: _onItemSelect,
  isChartSelected,
  onChartSelect,
  selectedSeriesIndex,
  onSeriesSelect,
  onHoverPoint,
  selectedPoint,
  onPointSelect,
  onPointDrag,
}: {
  data: ChartData;
  width: number;
  height: number;
  legendHeight?: number;
  selectedItemIndex?: number;
  onItemSelect?: (index: number) => void;
  isChartSelected?: boolean;
  onChartSelect?: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  selectedSeriesIndex?: number;
  onSeriesSelect?: (index: number) => void;
  onHoverPoint?: (
    xIndex: number | null,
    screenX?: number,
    screenY?: number,
  ) => void;
  selectedPoint?: SelectedPoint;
  onPointSelect?: (seriesIndex: number, pointIndex: number) => void;
  onPointDrag?: (
    seriesIndex: number,
    pointIndex: number,
    value: number,
  ) => void;
}) {
  const {
    items,
    showLabels,
    showValues = true,
    sortBy = "none",
    globalColor,
    labelColor = "#374151",
    valueColor: _valueColor = "#374151",
    labelBold = false,
    valueBold = false,
    valueOffsetY = 0,
    showAxis = true,
    showYAxis: _showYAxis = true,
    showGridX = false,
    showGridY = true,
    showGrid = false, // 레거시 호환
    xAxisMargin = 16,
    yAxisMargin = 0,
    curveType = "linear",
    orientation: _orientation = "horizontal",
  } = data;

  // 레거시 showGrid 호환: showGrid가 true면 showGridY로 적용
  const effectiveShowGridY = showGridY || showGrid;

  const seriesData = useMemo(() => getSeriesData(data), [data]);

  // 라인 refs (애니메이션용)
  const lineRefs = useRef<Map<number, Konva.Line>>(new Map());

  // Y-axis 토글: Y축 상하 여백 조절 (Y축 자체는 항상 표시)
  const padding = 30;
  const leftPadding = 40; // Y축 라벨 공간 항상 확보
  // showYAxis는 Y축 상하 여백 추가 여부 (향후 yAxisMargin으로 대체 가능)
  const labelHeight = showLabels ? 16 : 0;
  const chartWidth = width - leftPadding - 20;
  const chartHeight = height - padding * 2 - labelHeight - legendHeight;

  // X축 마진 적용 (최소 10px 보장)
  const maxXMargin = Math.max(0, (chartWidth - 20) / 2);
  const actualXMargin = Math.min(xAxisMargin, maxXMargin);
  const effectiveWidth = Math.max(10, chartWidth - actualXMargin * 2);
  const startX = actualXMargin;

  // Y축 마진 적용 (최소 10px 보장)
  const maxYMargin = Math.max(0, (chartHeight - 20) / 2);
  const actualYMargin = Math.min(yAxisMargin, maxYMargin);
  const effectiveHeight = Math.max(10, chartHeight - actualYMargin * 2);
  const startY = actualYMargin;

  const sortedItems = useMemo(() => sortItems(items, sortBy), [items, sortBy]);
  const pointCount = sortedItems.length;

  // 10의 자리로 반올림 (올림: 양수, 내림: 음수)
  const roundToTen = (value: number, direction: "up" | "down") => {
    if (direction === "up") {
      return Math.ceil(value / 10) * 10;
    } else {
      return Math.floor(value / 10) * 10;
    }
  };

  // 모든 시리즈에서 최소/최대값 계산 (null 값은 제외)
  const { minValue, maxValue } = useMemo(() => {
    let min = 0;
    let max = 1;
    seriesData.forEach((series) => {
      series.values.forEach((v) => {
        // null/undefined 값은 숨겨진 포인트
        if (v == null || typeof v !== "number") return;
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });
    // items 값도 체크 (하위 호환)
    sortedItems.forEach((item) => {
      if (item.value < min) min = item.value;
      if (item.value > max) max = item.value;
    });
    // 10의 자리로 반올림
    return {
      minValue: min < 0 ? roundToTen(min, "down") : 0,
      maxValue: roundToTen(max, "up") || 10,
    };
  }, [seriesData, sortedItems]);

  // Y축 범위 (minValue ~ maxValue)
  const valueRange = maxValue - minValue;

  const pointSpacing = effectiveWidth / Math.max(pointCount - 1, 1);

  // Y-axis tick values (minValue ~ maxValue 범위, yAxisMargin 적용)
  const yTicks = useMemo(() => {
    const tickCount = 4;
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const value = roundTickValue(
        minValue + (valueRange / tickCount) * i,
        valueRange,
      );
      const y =
        startY +
        effectiveHeight -
        ((value - minValue) / valueRange) * effectiveHeight;
      ticks.push({ value, y });
    }
    return ticks;
  }, [minValue, valueRange, effectiveHeight, startY]);

  // 값 → Y 좌표 변환 (yAxisMargin 적용)
  const valueToY = useCallback(
    (value: number) => {
      return (
        startY +
        effectiveHeight -
        ((value - minValue) / valueRange) * effectiveHeight
      );
    },
    [effectiveHeight, startY, minValue, valueRange],
  );

  // Y 좌표 → 값 변환 (yAxisMargin 적용)
  const yToValue = useCallback(
    (y: number) => {
      return (
        minValue +
        ((startY + effectiveHeight - y) / effectiveHeight) * valueRange
      );
    },
    [effectiveHeight, startY, minValue, valueRange],
  );

  // 0선의 Y 좌표 (마이너스 값이 있을 때 영역 채우기 기준)
  const zeroLineY = valueToY(0);

  // 각 시리즈의 포인트 좌표 계산 (null 값은 스킵)
  const seriesPoints = useMemo(() => {
    return seriesData.map((series) => {
      const points: number[] = [];
      series.values.forEach((value, i) => {
        // null/undefined 값은 숨겨진 포인트이므로 스킵
        if (value == null || typeof value !== "number") return;
        const x = startX + i * pointSpacing;
        const y = valueToY(value);
        points.push(x, y);
      });
      return points;
    });
  }, [seriesData, startX, pointSpacing, valueToY]);

  // 각 X 위치에서 value 라벨 겹침 방지를 위한 오프셋 계산
  const valueLabelOffsets = useMemo(() => {
    const offsets: Map<string, number> = new Map(); // key: "seriesIdx-pointIdx"
    const minLabelGap = 14; // 라벨 간 최소 간격 (px)

    // 각 X 위치별로 그룹화
    for (let pointIdx = 0; pointIdx < pointCount; pointIdx++) {
      // 해당 X 위치의 모든 시리즈 값 수집
      const pointsAtX: { seriesIdx: number; value: number; y: number }[] = [];

      seriesData.forEach((series, seriesIdx) => {
        const value = series.values[pointIdx];
        if (value != null && typeof value === "number") {
          const y = valueToY(value);
          pointsAtX.push({ seriesIdx, value, y });
        }
      });

      if (pointsAtX.length <= 1) {
        // 값이 1개 이하면 오프셋 불필요
        pointsAtX.forEach((p) => {
          offsets.set(`${p.seriesIdx}-${pointIdx}`, 0);
        });
        continue;
      }

      // Y 좌표(값)로 정렬 (위에서 아래로)
      pointsAtX.sort((a, b) => a.y - b.y);

      // 기본 라벨 위치 계산 (포인트 위쪽)
      const labels = pointsAtX.map((p) => ({
        seriesIdx: p.seriesIdx,
        baseY: p.y - 16,
        finalY: p.y - 16,
      }));

      // 반복적으로 겹침 해결 (최대 10회)
      for (let iter = 0; iter < 10; iter++) {
        let hasOverlap = false;

        // 인접한 라벨 쌍 확인 및 간격 확보
        for (let i = 1; i < labels.length; i++) {
          const prev = labels[i - 1]!;
          const curr = labels[i]!;
          const gap = curr.finalY - prev.finalY;

          if (gap < minLabelGap) {
            // 겹침 발생 - 현재 라벨을 아래로 이동
            curr.finalY = prev.finalY + minLabelGap;
            hasOverlap = true;
          }
        }

        if (!hasOverlap) break;
      }

      // 겹침 해소가 아래로만 밀면 스택이 한쪽으로 치우친다 —
      // 총 이동량의 절반만큼 되끌어 포인트들 주변에 고르게 배치한다.
      const lastDrift =
        labels[labels.length - 1]!.finalY - labels[labels.length - 1]!.baseY;
      if (lastDrift > 0) {
        const shift = lastDrift / 2;
        labels.forEach((label) => {
          label.finalY -= shift;
        });
      }

      // 오프셋 저장
      labels.forEach((label) => {
        offsets.set(
          `${label.seriesIdx}-${pointIdx}`,
          label.finalY - label.baseY,
        );
      });
    }

    return offsets;
  }, [seriesData, pointCount, valueToY]);

  // 영역 채우기를 위한 닫힌 경로 계산 (0선 기준, yAxisMargin 적용)
  const getAreaPoints = useCallback(
    (linePoints: number[]) => {
      if (linePoints.length < 4) return [];
      const areaPoints = [...linePoints];
      // 오른쪽 → 0선 → 왼쪽 → 0선 → 시작점으로 닫기
      const baseY = Math.min(zeroLineY, startY + effectiveHeight);
      areaPoints.push(linePoints[linePoints.length - 2]!, baseY);
      areaPoints.push(linePoints[0]!, baseY);
      return areaPoints;
    },
    [effectiveHeight, startY, zeroLineY],
  );

  return (
    <Group x={leftPadding} y={padding}>
      {/* Y-Axis Line (항상 표시) */}
      <Line points={[0, 0, 0, chartHeight]} stroke="#e5e7eb" strokeWidth={1} />

      {/* Y-Axis Labels & Ticks (항상 표시) */}
      {yTicks.map((tick, i) => (
        <Group key={i}>
          <Line
            points={[-4, tick.y, 0, tick.y]}
            stroke="#9ca3af"
            strokeWidth={1}
          />
          <Text
            x={-35}
            y={tick.y - 5}
            width={30}
            text={formatChartValue(tick.value)}
            fontSize={9}
            fill="#9ca3af"
            align="right"
          />
        </Group>
      ))}

      {/* X-Axis */}
      {showAxis && (
        <Line
          points={[0, chartHeight, chartWidth, chartHeight]}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      )}

      {/* Y-axis Grid lines (horizontal) */}
      {effectiveShowGridY &&
        yTicks.map((tick, i) => (
          <Line
            key={`grid-y-${i}`}
            points={[0, tick.y, chartWidth, tick.y]}
            stroke="#e5e7eb"
            strokeWidth={1}
            dash={[4, 4]}
          />
        ))}

      {/* X-axis Grid lines (vertical) */}
      {showGridX &&
        sortedItems.map((_, i) => {
          const x = startX + i * pointSpacing;
          return (
            <Line
              key={`grid-x-${i}`}
              points={[x, 0, x, chartHeight]}
              stroke="#e5e7eb"
              strokeWidth={1}
              dash={[4, 4]}
            />
          );
        })}

      {/* Multi-series Lines */}
      {seriesData.map((series, seriesIdx) => {
        const points = seriesPoints[seriesIdx];
        if (!points || points.length < 4) return null;

        const {
          color: seriesColor,
          strokeWidth = 2,
          lineStyle = "solid",
          fillEnabled,
          fillOpacity = 0.2,
          colorOverride,
        } = series.style;
        // colorOverride가 true면 개별 시리즈 색상 우선, 아니면 globalColor 적용
        const color = colorOverride
          ? seriesColor
          : (globalColor ?? seriesColor);
        const dash = getLineDash(lineStyle);
        const isSeriesSelected = selectedSeriesIndex === seriesIdx;

        return (
          <Group key={series.id}>
            {/* Area fill */}
            {fillEnabled && (
              <Line
                points={getAreaPoints(points)}
                closed
                fill={color}
                opacity={fillOpacity}
                tension={curveType === "curved" ? 0.4 : 0}
              />
            )}

            {/* Clickable transparent line (for selection) */}
            <Line
              points={points}
              stroke="rgba(0,0,0,0.001)"
              strokeWidth={20}
              lineCap="round"
              lineJoin="round"
              tension={curveType === "curved" ? 0.4 : 0}
              onClick={(e) => {
                e.cancelBubble = true;
                if (!isChartSelected) {
                  onChartSelect?.(e);
                } else {
                  onSeriesSelect?.(seriesIdx);
                }
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                if (!isChartSelected) {
                  onChartSelect?.(e);
                } else {
                  onSeriesSelect?.(seriesIdx);
                }
              }}
            />

            {/* Actual line - with animation support */}
            <Line
              ref={(node) => {
                if (node) {
                  lineRefs.current.set(seriesIdx, node);
                }
              }}
              points={points}
              stroke={color}
              strokeWidth={isSeriesSelected ? strokeWidth + 1 : strokeWidth}
              dash={dash}
              lineCap="round"
              lineJoin="round"
              tension={curveType === "curved" ? 0.4 : 0}
              listening={false}
            />

            {/* Data points (without labels - labels rendered separately for z-order) */}
            {series.values.map((value, i) => {
              // null/undefined 값은 숨겨진 포인트이므로 스킵
              if (value == null || typeof value !== "number") return null;
              const x = startX + i * pointSpacing;
              const y = valueToY(value);
              // 포인트별 개별 색상 (없으면 시리즈 색상 사용)
              const pointColor = series.pointColors?.[i] ?? color;
              // 선택된 포인트인지 확인
              const isPointSelected =
                selectedPoint?.seriesIndex === seriesIdx &&
                selectedPoint?.pointIndex === i;

              // 드래그 가능 여부: 차트 선택 상태에서만
              const canDrag = isChartSelected && onPointDrag;

              return (
                <Circle
                  key={i}
                  x={x}
                  y={y}
                  radius={isPointSelected ? 5 : isSeriesSelected ? 4 : 3}
                  fill={pointColor}
                  stroke={
                    isPointSelected
                      ? "#3b82f6"
                      : isSeriesSelected
                        ? "#fff"
                        : undefined
                  }
                  strokeWidth={isPointSelected ? 2 : isSeriesSelected ? 1 : 0}
                  draggable={!!canDrag}
                  onDragStart={
                    canDrag
                      ? (e) => {
                          // 상위 요소로 이벤트 전파 방지
                          e.cancelBubble = true;
                        }
                      : undefined
                  }
                  onDragMove={
                    canDrag
                      ? (e) => {
                          e.cancelBubble = true;
                          // X 고정, Y만 이동 (범위 제한, yAxisMargin 적용)
                          e.target.x(x);
                          const newY = Math.max(
                            startY,
                            Math.min(startY + effectiveHeight, e.target.y()),
                          );
                          e.target.y(newY);

                          // 라인 애니메이션: 현재 포인트만 새 위치로 부드럽게 이동
                          const lineRef = lineRefs.current.get(seriesIdx);
                          if (lineRef) {
                            const currentPoints = [...points];
                            currentPoints[i * 2 + 1] = newY; // Y 좌표만 업데이트
                            lineRef.to({
                              points: currentPoints,
                              duration: 0.05, // 50ms 애니메이션
                              easing: Konva.Easings.EaseOut,
                            });
                          }

                          // 실시간 값 동기화
                          const newValue = yToValue(newY);
                          onPointDrag?.(seriesIdx, i, Math.round(newValue));
                        }
                      : undefined
                  }
                  onDragEnd={
                    canDrag
                      ? (e) => {
                          e.cancelBubble = true;
                          const newY = e.target.y();
                          // Y 좌표를 값으로 변환 (yToValue 사용)
                          const newValue = yToValue(newY);
                          onPointDrag?.(seriesIdx, i, Math.round(newValue));
                          // 포인트 위치 리셋 (상태 업데이트 후 다시 그려짐)
                          e.target.x(x);
                          e.target.y(y);
                        }
                      : undefined
                  }
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (!isChartSelected) {
                      onChartSelect?.(e);
                    } else {
                      // 포인트 클릭 시 포인트 선택
                      onPointSelect?.(seriesIdx, i);
                    }
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    if (!isChartSelected) {
                      onChartSelect?.(e);
                    } else {
                      onPointSelect?.(seriesIdx, i);
                    }
                  }}
                  onMouseEnter={(e) => {
                    onHoverPoint?.(i);
                    // 드래그 가능 시 커서 변경
                    if (canDrag) {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = "ns-resize";
                    }
                  }}
                  onMouseLeave={(e) => {
                    onHoverPoint?.(null);
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = "default";
                  }}
                />
              );
            })}
          </Group>
        );
      })}

      {/* Value labels - rendered after all lines/points to ensure visibility */}
      {showValues &&
        seriesData.map((series, seriesIdx) => {
          const { color: seriesColor, colorOverride } = series.style;
          const color = colorOverride
            ? seriesColor
            : (globalColor ?? seriesColor);

          return series.values.map((value, i) => {
            if (value == null || typeof value !== "number") return null;
            const x = startX + i * pointSpacing;
            const y = valueToY(value);
            const pointColor = series.pointColors?.[i] ?? color;
            const pointShowValue = series.pointShowValues?.[i] ?? true;

            if (!pointShowValue) return null;

            return (
              <Text
                key={`label-${seriesIdx}-${i}`}
                x={x - 15}
                y={
                  y -
                  16 +
                  (sortedItems[i]?.valueOffsetY ?? valueOffsetY) +
                  (valueLabelOffsets.get(`${seriesIdx}-${i}`) ?? 0)
                }
                width={30}
                text={formatChartValue(value)}
                fontSize={
                  sortedItems[i]?.valueFontSize ?? sortedItems[i]?.fontSize ?? 9
                }
                fontStyle={
                  (sortedItems[i]?.valueBold ?? valueBold) ? "bold" : "normal"
                }
                fill={pointColor}
                align="center"
                wrap="none"
                listening={false}
              />
            );
          });
        })}

      {/* X-axis labels — 슬롯(pointSpacing)보다 라벨이 넓으면 간격 표시 */}
      {showLabels &&
        (() => {
          const xLabelStep = getLabelStep(
            sortedItems.reduce(
              (max, it) =>
                Math.max(
                  max,
                  estimateLabelWidth(
                    it.label,
                    it.labelFontSize ?? it.fontSize ?? 10,
                  ),
                ),
              0,
            ) + 4,
            pointSpacing,
          );
          return sortedItems.map((item, i) => {
            if (i % xLabelStep !== 0) return null;
            const x = startX + i * pointSpacing;
            const itemShowLabel = item.showLabel ?? true;
            const itemLabelFontSize = item.labelFontSize ?? item.fontSize ?? 10;
            const itemLabelColor = item.labelColor ?? labelColor;
            const itemLabelBold = item.labelBold ?? labelBold;
            const labelW = Math.max(30, pointSpacing * xLabelStep - 4);

            return (
              itemShowLabel && (
                <Text
                  key={i}
                  x={x - labelW / 2}
                  y={chartHeight + 4}
                  width={labelW}
                  text={item.label}
                  fontSize={itemLabelFontSize}
                  fontStyle={itemLabelBold ? "bold" : "normal"}
                  fill={itemLabelColor}
                  align="center"
                  wrap="none"
                  ellipsis
                />
              )
            );
          });
        })()}
    </Group>
  );
}

// Pie Chart Renderer (also handles donut with innerRadius)
function PieChartRenderer({
  data,
  width,
  height,
  legendHeight = 0,
  selectedItemIndex,
  onItemSelect,
  isChartSelected,
  onChartSelect,
}: {
  data: ChartData;
  width: number;
  height: number;
  legendHeight?: number;
  selectedItemIndex?: number;
  onItemSelect?: (index: number) => void;
  isChartSelected?: boolean;
  onChartSelect?: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
}) {
  const {
    items,
    showLabels,
    showValues = true,
    innerRadius = 0,
    pieStyle = "default",
    sortBy = "none",
    labelColor = "#374151",
    labelBold = false,
    valueBold = false,
  } = data;

  const effectiveHeight = height - legendHeight;
  const centerX = width / 2;
  const centerY = effectiveHeight / 2;
  const radius = Math.min(width, effectiveHeight) / 2 - (showLabels ? 20 : 10);

  const sortedItems = useMemo(() => sortItems(items, sortBy), [items, sortBy]);
  const total = sortedItems.reduce((sum, item) => sum + item.value, 0) || 1;

  // 정렬 후 원본 인덱스 매핑
  const originalIndices = useMemo(() => {
    if (sortBy === "none") return items.map((_, i) => i);
    const indexed = items.map((item, i) => ({ item, originalIndex: i }));
    const sorted = [...indexed];
    switch (sortBy) {
      case "value-asc":
        sorted.sort((a, b) => a.item.value - b.item.value);
        break;
      case "value-desc":
        sorted.sort((a, b) => b.item.value - a.item.value);
        break;
      case "label-asc":
        sorted.sort((a, b) => a.item.label.localeCompare(b.item.label));
        break;
      case "label-desc":
        sorted.sort((a, b) => b.item.label.localeCompare(a.item.label));
        break;
    }
    return sorted.map((s) => s.originalIndex);
  }, [items, sortBy]);

  const slices = useMemo(() => {
    let currentAngle = -90; // Start from top
    return sortedItems.map((item) => {
      const angle = (item.value / total) * 360;
      const slice = {
        ...item,
        startAngle: currentAngle,
        angle,
      };
      currentAngle += angle;
      return slice;
    });
  }, [sortedItems, total]);

  // 모든 값이 0(또는 항목 없음)이면 슬라이스가 전부 0도가 되어 아무것도
  // 그려지지 않는다 — 빈 상태를 명시적으로 보여준다.
  const isEmpty =
    sortedItems.length === 0 || sortedItems.every((it) => it.value <= 0);
  if (isEmpty) {
    return (
      <Group x={centerX} y={centerY}>
        <Circle
          radius={radius}
          stroke="#d1d5db"
          strokeWidth={1.5}
          dash={[6, 6]}
          listening={false}
        />
        <Text
          x={-radius}
          y={-6}
          width={radius * 2}
          text="No data"
          fontSize={12}
          fill="#9ca3af"
          align="center"
          listening={false}
        />
      </Group>
    );
  }

  return (
    <Group x={centerX} y={centerY}>
      {slices.map((slice, i) => {
        // 0값 슬라이스는 각도 0 — 렌더링할 것이 없고 라벨만 겹쳐 쌓인다
        if (slice.angle <= 0) return null;
        const itemShowLabel = slice.showLabel ?? true;
        const itemShowValue = slice.showValue ?? true;
        // Pie는 label/value 합쳐서 표시 - 작은 폰트 사용
        const itemLabelFontSize = slice.labelFontSize ?? slice.fontSize ?? 10;
        const itemValueFontSize = slice.valueFontSize ?? slice.fontSize ?? 10;
        const itemFontSize = Math.min(itemLabelFontSize, itemValueFontSize);
        const itemLabelColor = slice.labelColor ?? labelColor;
        const itemLabelBold = slice.labelBold ?? labelBold;
        const itemValueBold = slice.valueBold ?? valueBold;
        // Pie uses combined label/value text - use labelColor for display
        const labelText = [
          showLabels && itemShowLabel ? slice.label : null,
          showValues && itemShowValue ? formatChartValue(slice.value) : null,
        ]
          .filter(Boolean)
          .join("\n");
        const originalIndex = originalIndices[i]!;
        const isItemSelected = selectedItemIndex === originalIndex;

        // 스타일별 렌더링
        const renderSlice = () => {
          const sliceRadius = isItemSelected ? radius + 4 : radius;

          switch (pieStyle) {
            case "3d": {
              // 3D 효과: 그림자 + 약간의 오프셋 (innerRadius 항상 0)
              const depth = 8;
              return (
                <>
                  {/* 3D 깊이 (그림자) */}
                  <Wedge
                    angle={slice.angle}
                    rotation={slice.startAngle}
                    radius={sliceRadius}
                    fill="#00000040"
                    x={3}
                    y={depth}
                  />
                  {/* 메인 슬라이스 */}
                  <Wedge
                    angle={slice.angle}
                    rotation={slice.startAngle}
                    radius={sliceRadius}
                    fill={slice.color}
                    stroke={isItemSelected ? "#3b82f6" : "#ffffff"}
                    strokeWidth={isItemSelected ? 2 : 1}
                  />
                </>
              );
            }

            case "rounded": {
              // 둥근 끝 + 갭: Arc 사용
              const gapAngle = 8; // 갭 각도
              const arcAngle = Math.max(0, slice.angle - gapAngle);
              const arcRadius = (radius + innerRadius) / 2;
              const strokeWidth = radius - innerRadius - 4;

              if (arcAngle <= 0) return null;

              return (
                <Arc
                  angle={arcAngle}
                  rotation={slice.startAngle + gapAngle / 2}
                  innerRadius={arcRadius - strokeWidth / 2}
                  outerRadius={arcRadius + strokeWidth / 2}
                  fill={slice.color}
                  stroke={isItemSelected ? "#3b82f6" : undefined}
                  strokeWidth={isItemSelected ? 2 : 0}
                  lineCap="round"
                />
              );
            }

            case "gradient": {
              // 그라디언트: 방사형 그라디언트 사용 (Arc로 innerRadius 지원)
              const darkerColor = adjustColor(slice.color, -30);
              return (
                <Arc
                  angle={slice.angle}
                  rotation={slice.startAngle}
                  innerRadius={innerRadius}
                  outerRadius={sliceRadius}
                  fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                  fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                  fillRadialGradientStartRadius={innerRadius}
                  fillRadialGradientEndRadius={sliceRadius}
                  fillRadialGradientColorStops={[
                    0,
                    slice.color,
                    1,
                    darkerColor,
                  ]}
                  stroke={isItemSelected ? "#3b82f6" : "#ffffff20"}
                  strokeWidth={isItemSelected ? 2 : 1}
                />
              );
            }

            case "donut": {
              // 도넛: Arc 사용 (Wedge는 innerRadius 미지원)
              return (
                <Arc
                  angle={slice.angle}
                  rotation={slice.startAngle}
                  innerRadius={innerRadius}
                  outerRadius={sliceRadius}
                  fill={slice.color}
                  stroke={isItemSelected ? "#3b82f6" : "#ffffff"}
                  strokeWidth={isItemSelected ? 2 : 1}
                />
              );
            }

            default: {
              // 기본: 표준 Wedge (innerRadius 0)
              return (
                <Wedge
                  angle={slice.angle}
                  rotation={slice.startAngle}
                  radius={sliceRadius}
                  fill={slice.color}
                  stroke={isItemSelected ? "#3b82f6" : undefined}
                  strokeWidth={isItemSelected ? 2 : 0}
                />
              );
            }
          }
        };

        // 라벨 위치 계산
        const labelRadius =
          pieStyle === "rounded"
            ? (radius + innerRadius) / 2
            : innerRadius > 0
              ? (radius + innerRadius) / 2
              : radius * 0.6;

        return (
          <Group
            key={i}
            onClick={(e) => {
              e.cancelBubble = true;
              if (!isChartSelected) {
                onChartSelect?.(e);
              } else {
                onItemSelect?.(originalIndex);
              }
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (!isChartSelected) {
                onChartSelect?.(e);
              } else {
                onItemSelect?.(originalIndex);
              }
            }}
          >
            {renderSlice()}
            {slice.angle > 20 && labelText && (
              <Text
                x={0}
                y={0}
                text={labelText}
                fontSize={itemFontSize}
                fontStyle={itemLabelBold || itemValueBold ? "bold" : "normal"}
                fill={itemLabelColor}
                align="center"
                offsetX={
                  -Math.cos(
                    ((slice.startAngle + slice.angle / 2) * Math.PI) / 180,
                  ) * labelRadius
                }
                offsetY={
                  -Math.sin(
                    ((slice.startAngle + slice.angle / 2) * Math.PI) / 180,
                  ) *
                    labelRadius +
                  5
                }
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

// Chart Legend Component
function ChartLegend({
  items,
  selectedIndex,
  onSelect,
  isChartSelected,
  onChartSelect,
  x,
  y,
  maxWidth,
  maxHeight: _maxHeight,
  position = "bottom",
  align = "start",
}: {
  items: { label: string; color: string }[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  isChartSelected?: boolean;
  onChartSelect?: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  x: number;
  y: number;
  maxWidth: number;
  maxHeight?: number;
  position?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const itemHeight = 16;
  const itemGap = 8;
  const dotSize = 8;
  const textOffset = 14;

  const isVertical = position === "left" || position === "right";

  // Calculate rows (horizontal) or columns (vertical)
  const rows: { label: string; color: string; index: number; x: number }[][] =
    [];
  let currentRow: { label: string; color: string; index: number; x: number }[] =
    [];
  let currentX = 0;

  if (isVertical) {
    // Vertical layout: one item per row
    items.forEach((item, index) => {
      rows.push([{ ...item, index, x: 0 }]);
    });
  } else {
    // Horizontal layout: wrap items
    items.forEach((item, index) => {
      const itemWidth = textOffset + item.label.length * 6 + itemGap;
      if (currentX + itemWidth > maxWidth && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentX = 0;
      }
      currentRow.push({ ...item, index, x: currentX });
      currentX += itemWidth;
    });
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
  }

  // Calculate total width for alignment
  const getRowWidth = (row: typeof currentRow) => {
    if (row.length === 0) return 0;
    const lastItem = row[row.length - 1]!;
    return lastItem.x + textOffset + lastItem.label.length * 6;
  };

  // Calculate alignment offset
  const getAlignOffset = (row: typeof currentRow) => {
    if (isVertical) return 0;
    const rowWidth = getRowWidth(row);
    if (align === "center") return (maxWidth - rowWidth) / 2;
    if (align === "end") return maxWidth - rowWidth;
    return 0;
  };

  return (
    <Group x={x} y={y}>
      {rows.map((row, rowIndex) => (
        <Group
          key={rowIndex}
          x={getAlignOffset(row)}
          y={rowIndex * (itemHeight + 4)}
        >
          {row.map((item) => {
            const isSelected = selectedIndex === item.index;
            return (
              <Group
                key={item.index}
                x={item.x}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (!isChartSelected) {
                    onChartSelect?.(e);
                  } else {
                    onSelect?.(item.index);
                  }
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  if (!isChartSelected) {
                    onChartSelect?.(e);
                  } else {
                    onSelect?.(item.index);
                  }
                }}
              >
                {/* Legend dot */}
                <Circle
                  x={dotSize / 2}
                  y={itemHeight / 2}
                  radius={dotSize / 2}
                  fill={item.color}
                  stroke={isSelected ? "#3b82f6" : undefined}
                  strokeWidth={isSelected ? 2 : 0}
                />
                {/* Legend text */}
                <Text
                  x={textOffset}
                  y={2}
                  text={item.label}
                  fontSize={10}
                  fill={isSelected ? "#3b82f6" : "#6b7280"}
                  fontStyle={isSelected ? "bold" : "normal"}
                />
              </Group>
            );
          })}
        </Group>
      ))}
    </Group>
  );
}

// Header height for chart (with lock icon)
const CHART_HEADER_HEIGHT = 28;

export const Chart = memo(function Chart({
  shape,
  isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  onHeaderDoubleClick,
  onUpdate,
  isEditingTitle = false,
}: ChartProps) {
  const chartData = shape.chartData;
  const width = shape.width ?? 200;
  const height = shape.height ?? 150;
  const isLocked = shape.locked === true;
  const showHeader = shape.chartShowHeader !== false; // default true
  const headerHeight = showHeader ? CHART_HEADER_HEIGHT : 0;

  // 호버 툴팁 상태
  const hoverXIndexRef = useRef<number | null>(null);

  if (!chartData) {
    return null;
  }

  const selectedItemIndex = chartData.selectedItemIndex;
  const selectedSeriesIndex = chartData.selectedSeriesIndex;
  const selectedPoint = chartData.selectedPoint;
  const selectedLegendIndex = chartData.selectedLegendIndex;
  const showLegend = chartData.showLegend ?? true;
  const legendPosition = chartData.legendPosition ?? "bottom";
  const legendAlign = chartData.legendAlign ?? "start";

  // 범례 아이템 계산 (globalColor 적용)
  const globalColor = chartData.globalColor;
  const legendItems = useMemo(() => {
    if (chartData.variant === "line" && chartData.series) {
      // Line chart: 시리즈 기반
      return chartData.series.map((s) => ({
        label: s.name,
        // colorOverride가 true면 개별 색상, 아니면 globalColor 적용
        color: s.style.colorOverride
          ? s.style.color
          : (globalColor ?? s.style.color),
      }));
    }
    // Bar/Pie: items 기반
    return chartData.items.map((item) => ({
      label: item.label,
      // colorOverride가 true면 개별 색상, 아니면 globalColor 적용
      color: item.colorOverride ? item.color : (globalColor ?? item.color),
    }));
  }, [chartData, globalColor]);

  // 범례 크기 계산
  const isLegendVertical =
    legendPosition === "left" || legendPosition === "right";

  const legendSize = useMemo(() => {
    if (!showLegend || legendItems.length === 0) return { width: 0, height: 0 };

    const textOffset = 14;
    const itemGap = 12;
    const itemHeight = 16;
    const rowGap = 4;

    // Left/Right(세로 배열)
    if (isLegendVertical) {
      const legendPadding = 8;
      const maxLabelWidth = Math.max(
        ...legendItems.map(
          (item) => textOffset + item.label.length * 7 + itemGap,
        ),
      );
      return {
        width: Math.min(maxLabelWidth, 100) + legendPadding,
        height: legendItems.length * 20,
      };
    } else {
      // Top/Bottom: 줄바꿈을 고려한 높이 계산
      const availableWidth = width - 20; // 차트 너비 기준 (여백 고려)
      let currentX = 0;
      let rowCount = 1;

      legendItems.forEach((item) => {
        const itemWidth = textOffset + item.label.length * 6 + itemGap;
        if (currentX + itemWidth > availableWidth && currentX > 0) {
          rowCount++;
          currentX = 0;
        }
        currentX += itemWidth;
      });

      return {
        width: 0, // 사용 안 함
        height: rowCount * itemHeight + (rowCount - 1) * rowGap + 8, // 8 = 상하 패딩
      };
    }
  }, [showLegend, legendItems, isLegendVertical, width]);

  // 전체 영역 크기 (헤더 + 차트 + 범례)
  // shape의 width/height는 "차트 영역" 크기이고, 헤더와 범례는 그 외부에 추가됨
  const totalSize = useMemo(() => {
    const lw = showLegend ? legendSize.width : 0;
    const lh = showLegend ? legendSize.height : 0;

    return {
      width: width + (isLegendVertical ? lw : 0),
      height: height + headerHeight + (isLegendVertical ? 0 : lh),
    };
  }, [legendSize, width, height, headerHeight, showLegend, isLegendVertical]);

  // 차트 오프셋 (헤더 + 범례가 left/top에 있으면 차트가 밀림)
  const chartOffset = useMemo(() => {
    const legendX =
      showLegend && legendPosition === "left" ? legendSize.width : 0;
    const legendY =
      showLegend && legendPosition === "top" ? legendSize.height : 0;
    return {
      x: legendX,
      y: headerHeight + legendY,
    };
  }, [legendPosition, legendSize, showLegend, headerHeight]);

  // 범례 위치 계산 (헤더 높이 고려)
  const legendPos = useMemo(() => {
    const lh = legendSize.height;

    let x = 0;
    let y = 0;

    // 기본 위치 (간격 2px 통일, 헤더 높이 고려)
    switch (legendPosition) {
      case "top":
        y = headerHeight + 2;
        break;
      case "bottom":
        y = headerHeight + height + 2;
        break;
      case "left":
        x = 2;
        y = headerHeight;
        break;
      case "right":
        x = width + 2;
        y = headerHeight;
        break;
    }

    // Align 적용
    if (legendPosition === "top" || legendPosition === "bottom") {
      // Top/Bottom: ChartLegend가 maxWidth 내에서 자체 정렬
      x = 2;
    } else {
      // Left/Right: 세로 정렬 (차트 높이 기준)
      if (legendAlign === "start") {
        y = headerHeight + 2;
      } else if (legendAlign === "center") {
        y = headerHeight + (height - lh) / 2;
      } else {
        y = headerHeight + height - lh - 2;
      }
    }

    return { x, y };
  }, [
    legendPosition,
    legendAlign,
    legendSize,
    totalSize,
    width,
    height,
    headerHeight,
  ]);

  const handleLegendSelect = (index: number) => {
    onUpdate?.({
      chartData: {
        ...chartData,
        selectedLegendIndex: index,
        selectedItemIndex: undefined,
        selectedSeriesIndex: undefined,
        selectedPoint: undefined,
      },
    });
  };

  const handleItemSelect = (index: number) => {
    onUpdate?.({
      chartData: {
        ...chartData,
        selectedItemIndex: index,
        selectedSeriesIndex: undefined,
        selectedPoint: undefined,
      },
    });
  };

  const handleSeriesSelect = (index: number) => {
    onUpdate?.({
      chartData: {
        ...chartData,
        selectedSeriesIndex: index,
        selectedItemIndex: undefined,
        selectedPoint: undefined,
      },
    });
  };

  const handlePointSelect = (seriesIndex: number, pointIndex: number) => {
    onUpdate?.({
      chartData: {
        ...chartData,
        selectedPoint: { seriesIndex, pointIndex },
        selectedSeriesIndex: undefined,
        selectedItemIndex: undefined,
      },
    });
  };

  const handleHoverPoint = useCallback((xIndex: number | null) => {
    hoverXIndexRef.current = xIndex;
    // TODO: 툴팁 표시를 위해 부모 컴포넌트에 전달 필요
  }, []);

  // 포인트 드래그로 값 변경
  const handlePointDrag = useCallback(
    (seriesIndex: number, pointIndex: number, value: number) => {
      const series = chartData.series ? [...chartData.series] : [];
      if (series[seriesIndex]) {
        const newValues = [...series[seriesIndex].values];
        newValues[pointIndex] = value;
        series[seriesIndex] = { ...series[seriesIndex], values: newValues };
        onUpdate?.({
          chartData: {
            ...chartData,
            series,
          },
        });
      }
    },
    [chartData, onUpdate],
  );

  // 차트 배경 클릭 시 개별 항목/시리즈/포인트/범례 선택 해제
  const handleChartClick = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    // 개별 항목, 시리즈, 포인트, 범례가 선택되어 있으면 해제
    if (
      selectedItemIndex !== undefined ||
      selectedSeriesIndex !== undefined ||
      selectedPoint !== undefined ||
      selectedLegendIndex !== undefined
    ) {
      onUpdate?.({
        chartData: {
          ...chartData,
          selectedItemIndex: undefined,
          selectedSeriesIndex: undefined,
          selectedPoint: undefined,
          selectedLegendIndex: undefined,
        },
      });
    }
    // 차트 선택 이벤트 전달
    onSelect(e);
  };

  const renderChart = () => {
    // 차트는 원래 width/height 사용 (범례는 추가 영역)
    const chartContent = (() => {
      switch (chartData.variant) {
        case "bar":
          return (
            <BarChartRenderer
              data={chartData}
              width={width}
              height={height}
              legendHeight={0}
              selectedItemIndex={selectedItemIndex}
              onItemSelect={handleItemSelect}
              isChartSelected={isSelected}
              onChartSelect={onSelect}
            />
          );
        case "line":
          return (
            <LineChartRenderer
              data={chartData}
              width={width}
              height={height}
              legendHeight={0}
              selectedItemIndex={selectedItemIndex}
              onItemSelect={handleItemSelect}
              isChartSelected={isSelected}
              onChartSelect={onSelect}
              selectedSeriesIndex={selectedSeriesIndex}
              onSeriesSelect={handleSeriesSelect}
              onHoverPoint={handleHoverPoint}
              selectedPoint={selectedPoint}
              onPointSelect={handlePointSelect}
              onPointDrag={handlePointDrag}
            />
          );
        case "pie":
          return (
            <PieChartRenderer
              data={chartData}
              width={width}
              height={height}
              legendHeight={0}
              selectedItemIndex={selectedItemIndex}
              onItemSelect={handleItemSelect}
              isChartSelected={isSelected}
              onChartSelect={onSelect}
            />
          );
        default:
          return null;
      }
    })();

    // 차트 오프셋 적용 (left/top 범례일 때)
    if (chartOffset.x !== 0 || chartOffset.y !== 0) {
      return (
        <Group x={chartOffset.x} y={chartOffset.y}>
          {chartContent}
        </Group>
      );
    }
    return chartContent;
  };

  return (
    <Group
      id={shape.id}
      x={shape.x}
      y={shape.y}
      rotation={shape.rotation}
      opacity={shape.opacity}
      draggable={draggable && !isLocked}
      onClick={handleChartClick}
      onTap={handleChartClick}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {/* Background (헤더 + 차트 + 범례 전체 영역) */}
      <Rect
        width={totalSize.width}
        height={totalSize.height}
        fill="#ffffff"
        stroke={isLocked ? "#ef4444" : isSelected ? "#3b82f6" : "#e5e7eb"}
        strokeWidth={isLocked ? 2 / zoom : isSelected ? 2 / zoom : 1 / zoom}
        dash={isLocked ? [8, 4] : undefined}
        cornerRadius={4}
      />

      {/* Header with lock icon */}
      {showHeader && (
        <Group>
          {/* Header background - clickable for title editing */}
          <Rect
            width={totalSize.width}
            height={headerHeight}
            fill="#f9fafb"
            cornerRadius={[4, 4, 0, 0]}
            onClick={(e) => {
              e.cancelBubble = true;
              onSelect(e);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelect(e);
            }}
            onDblClick={(e) => {
              if (!isLocked) {
                e.cancelBubble = true;
                onHeaderDoubleClick?.();
              }
            }}
            onDblTap={(e) => {
              if (!isLocked) {
                e.cancelBubble = true;
                onHeaderDoubleClick?.();
              }
            }}
          />
          {/* Header divider */}
          <Line
            points={[0, headerHeight, totalSize.width, headerHeight]}
            stroke="#e5e7eb"
            strokeWidth={1}
            listening={false}
          />
          {/* Chart title or type label (hidden when editing) */}
          {!isEditingTitle && (
            <Text
              x={10}
              y={8}
              text={
                shape.chartTitle ||
                (chartData.variant === "bar"
                  ? "Bar Chart"
                  : chartData.variant === "line"
                    ? "Line Chart"
                    : "Pie Chart")
              }
              fontSize={11}
              fontFamily="Inter, sans-serif"
              fill="#6b7280"
              listening={false}
            />
          )}
          {/* Lock icon (if locked) */}
          {isLocked && (
            <Text
              x={totalSize.width - 24}
              y={6}
              text="🔒"
              fontSize={12}
              listening={false}
            />
          )}
        </Group>
      )}

      {/* Chart Content */}
      {renderChart()}

      {/* Legend (확장된 영역에 배치) */}
      {showLegend && legendItems.length > 0 && (
        <ChartLegend
          items={legendItems}
          selectedIndex={selectedLegendIndex}
          onSelect={handleLegendSelect}
          isChartSelected={isSelected}
          onChartSelect={onSelect}
          x={legendPos.x}
          y={legendPos.y}
          maxWidth={
            isLegendVertical ? legendSize.width - 8 : totalSize.width - 20
          }
          maxHeight={
            isLegendVertical ? totalSize.height - 20 : legendSize.height - 8
          }
          position={legendPosition}
          align={legendAlign}
        />
      )}

      {/* Selection border for multi-select */}
      {isSelected && isMultiSelected && (
        <SelectionBorder
          width={totalSize.width}
          height={totalSize.height}
          zoom={zoom}
          isMultiSelected={isMultiSelected}
        />
      )}
    </Group>
  );
});
