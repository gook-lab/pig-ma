import { nanoid } from "nanoid";
import type {
  ChartData,
  ChartDataItem,
  ChartSeries,
  LineSeriesStyle,
  ChartLineStyle,
} from "@/types";
import { CHART_COLORS } from "@/constants/colors";

/**
 * 기본 시리즈 스타일
 */
export const DEFAULT_SERIES_STYLE: LineSeriesStyle = {
  color: CHART_COLORS[0],
  strokeWidth: 2,
  lineStyle: "solid",
  fillEnabled: false,
  fillOpacity: 0.2,
};

/**
 * 시리즈 인덱스에 맞는 기본 색상 반환
 */
export function getSeriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * 새 시리즈 생성
 */
export function createDefaultSeries(
  index: number,
  pointCount: number,
): ChartSeries {
  // 기본 이름: Series 1, Series 2, ...
  const name = `Series ${index + 1}`;

  // 기본 값: 랜덤 생성 (20~80 범위)
  const values = Array.from(
    { length: pointCount },
    () => Math.floor(Math.random() * 60) + 20,
  );

  return {
    id: nanoid(),
    name,
    values,
    style: {
      ...DEFAULT_SERIES_STYLE,
      color: getSeriesColor(index),
    },
  };
}

/**
 * 시리즈 값 정규화 (비정상 값을 null로 변환)
 * - localStorage에서 "null" 문자열로 저장된 경우 처리
 */
function sanitizeSeriesValues(values: (number | null)[]): (number | null)[] {
  return values.map((v) => (v != null && typeof v === "number" ? v : null));
}

/**
 * ChartData에서 시리즈 데이터 추출
 * - series가 있으면 값 정규화 후 반환
 * - 없으면 items[].value를 단일 시리즈로 변환
 */
export function getSeriesData(data: ChartData): ChartSeries[] {
  // series가 있으면 값 정규화 후 사용
  if (data.series && data.series.length > 0) {
    return data.series.map((series) => ({
      ...series,
      values: sanitizeSeriesValues(series.values),
    }));
  }

  // items에서 단일 시리즈 생성 (레거시 호환)
  const values = data.items.map((item) => item.value);
  return [
    {
      id: "legacy-series",
      name: "Values",
      values,
      style: {
        color: data.globalColor ?? CHART_COLORS[0],
        strokeWidth: 2,
        lineStyle: "solid",
        fillEnabled: false,
        fillOpacity: 0.2,
      },
    },
  ];
}

/**
 * items에서 X축 라벨 추출
 */
export function getXAxisLabels(data: ChartData): string[] {
  return data.items.map((item) => item.label);
}

/**
 * 시리즈 추가 (최대 5개)
 * 포인트 개수는 기존 시리즈 중 최대값 기준
 */
export function addSeries(
  data: ChartData,
  series?: ChartSeries,
): ChartData | null {
  const currentSeries = getSeriesData(data);
  if (currentSeries.length >= 5) return null;

  // 기존 시리즈 중 최대 포인트 개수 사용 (없으면 items.length)
  const maxPointCount =
    currentSeries.length > 0
      ? Math.max(...currentSeries.map((s) => s.values.length))
      : data.items.length;
  const newSeries =
    series ?? createDefaultSeries(currentSeries.length, maxPointCount);

  return {
    ...data,
    series: [...currentSeries, newSeries],
  };
}

/**
 * 시리즈 삭제 (최소 1개 유지)
 */
export function removeSeries(
  data: ChartData,
  seriesId: string,
): ChartData | null {
  const currentSeries = getSeriesData(data);
  if (currentSeries.length <= 1) return null;

  const newSeries = currentSeries.filter((s) => s.id !== seriesId);

  // 선택 인덱스 조정
  let selectedSeriesIndex = data.selectedSeriesIndex;
  if (selectedSeriesIndex !== undefined) {
    const removedIndex = currentSeries.findIndex((s) => s.id === seriesId);
    if (selectedSeriesIndex === removedIndex) {
      selectedSeriesIndex = undefined;
    } else if (selectedSeriesIndex > removedIndex) {
      selectedSeriesIndex -= 1;
    }
  }

  return {
    ...data,
    series: newSeries,
    selectedSeriesIndex,
  };
}

/**
 * 시리즈 업데이트
 */
export function updateSeries(
  data: ChartData,
  seriesIndex: number,
  updates: Partial<ChartSeries>,
): ChartData {
  const currentSeries = getSeriesData(data);
  const newSeries = [...currentSeries];
  newSeries[seriesIndex] = { ...newSeries[seriesIndex], ...updates };

  return {
    ...data,
    series: newSeries,
  };
}

/**
 * 시리즈 스타일 업데이트
 */
export function updateSeriesStyle(
  data: ChartData,
  seriesIndex: number,
  styleUpdates: Partial<LineSeriesStyle>,
): ChartData {
  const currentSeries = getSeriesData(data);
  const series = currentSeries[seriesIndex];

  return updateSeries(data, seriesIndex, {
    style: { ...series.style, ...styleUpdates },
  });
}

/**
 * LineStyle을 Konva dash 배열로 변환
 */
export function getLineDash(lineStyle: ChartLineStyle = "solid"): number[] {
  switch (lineStyle) {
    case "dashed":
      return [10, 5];
    case "dotted":
      return [3, 4];
    case "solid":
    default:
      return [];
  }
}

/**
 * X축 포인트 추가 (모든 시리즈에 기본값 추가)
 */
export function addXAxisPoint(
  data: ChartData,
  label: string,
  defaultValue: number = 30,
): ChartData {
  const newItems: ChartDataItem[] = [
    ...data.items,
    {
      label,
      value: defaultValue,
      color: CHART_COLORS[data.items.length % CHART_COLORS.length],
    },
  ];

  // 모든 시리즈에 값 추가
  const currentSeries = data.series ? [...data.series] : [];
  const updatedSeries = currentSeries.map((series) => ({
    ...series,
    values: [...series.values, defaultValue],
  }));

  return {
    ...data,
    items: newItems,
    series: updatedSeries.length > 0 ? updatedSeries : undefined,
  };
}

/**
 * X축 포인트 삭제 (모든 시리즈에서 삭제)
 */
export function removeXAxisPoint(
  data: ChartData,
  index: number,
): ChartData | null {
  if (data.items.length <= 1) return null;

  const newItems = data.items.filter((_, i) => i !== index);

  // 모든 시리즈에서 해당 인덱스 값 삭제
  const currentSeries = data.series ? [...data.series] : [];
  const updatedSeries = currentSeries.map((series) => ({
    ...series,
    values: series.values.filter((_, i) => i !== index),
  }));

  return {
    ...data,
    items: newItems,
    series: updatedSeries.length > 0 ? updatedSeries : undefined,
  };
}

/**
 * 시리즈의 특정 포인트 값 업데이트
 */
export function updateSeriesPointValue(
  data: ChartData,
  seriesIndex: number,
  pointIndex: number,
  value: number,
): ChartData {
  const currentSeries = getSeriesData(data);
  const newSeries = currentSeries.map((series, idx) => {
    if (idx !== seriesIndex) return series;
    const newValues = [...series.values];
    newValues[pointIndex] = value;
    return { ...series, values: newValues };
  });

  return {
    ...data,
    series: newSeries,
  };
}

/**
 * 시리즈의 특정 포인트 색상 업데이트
 */
export function updateSeriesPointColor(
  data: ChartData,
  seriesIndex: number,
  pointIndex: number,
  color: string,
): ChartData {
  const currentSeries = getSeriesData(data);
  const newSeries = currentSeries.map((series, idx) => {
    if (idx !== seriesIndex) return series;
    const pointColors = series.pointColors
      ? [...series.pointColors]
      : Array(series.values.length).fill(undefined);
    pointColors[pointIndex] = color;
    return { ...series, pointColors };
  });

  return {
    ...data,
    series: newSeries,
  };
}

/**
 * 시리즈의 모든 값 업데이트
 */
export function updateSeriesValues(
  data: ChartData,
  seriesIndex: number,
  values: number[],
): ChartData {
  const currentSeries = getSeriesData(data);
  const newSeries = currentSeries.map((series, idx) => {
    if (idx !== seriesIndex) return series;
    return { ...series, values };
  });

  return {
    ...data,
    series: newSeries,
  };
}

/**
 * 시리즈의 특정 포인트 라벨 표시 여부 업데이트
 */
export function updateSeriesPointShowLabel(
  data: ChartData,
  seriesIndex: number,
  pointIndex: number,
  showLabel: boolean,
): ChartData {
  const currentSeries = getSeriesData(data);
  const newSeries = currentSeries.map((series, idx) => {
    if (idx !== seriesIndex) return series;
    const pointShowLabels = series.pointShowLabels
      ? [...series.pointShowLabels]
      : Array(series.values.length).fill(undefined);
    pointShowLabels[pointIndex] = showLabel;
    return { ...series, pointShowLabels };
  });

  return {
    ...data,
    series: newSeries,
  };
}

/**
 * 시리즈의 특정 포인트 값 표시 여부 업데이트
 */
export function updateSeriesPointShowValue(
  data: ChartData,
  seriesIndex: number,
  pointIndex: number,
  showValue: boolean,
): ChartData {
  const currentSeries = getSeriesData(data);
  const newSeries = currentSeries.map((series, idx) => {
    if (idx !== seriesIndex) return series;
    const pointShowValues = series.pointShowValues
      ? [...series.pointShowValues]
      : Array(series.values.length).fill(undefined);
    pointShowValues[pointIndex] = showValue;
    return { ...series, pointShowValues };
  });

  return {
    ...data,
    series: newSeries,
  };
}

/**
 * 시리즈의 특정 포인트 숨김 (값을 null로 설정)
 * 해당 시리즈에서만 포인트가 숨겨지고, 다른 시리즈는 영향 없음
 */
export function hideSeriesPoint(
  data: ChartData,
  seriesIndex: number,
  pointIndex: number,
): ChartData {
  const currentSeries = getSeriesData(data);
  const newSeries = currentSeries.map((series, idx) => {
    if (idx !== seriesIndex) return series;
    const newValues = [...series.values];
    newValues[pointIndex] = null;
    return { ...series, values: newValues };
  });

  return {
    ...data,
    series: newSeries,
  };
}

/**
 * 시리즈의 숨겨진 포인트 복원 (기본값으로 설정)
 */
export function restoreSeriesPoint(
  data: ChartData,
  seriesIndex: number,
  pointIndex: number,
  defaultValue: number = 50,
): ChartData {
  const currentSeries = getSeriesData(data);
  const newSeries = currentSeries.map((series, idx) => {
    if (idx !== seriesIndex) return series;
    const newValues = [...series.values];
    newValues[pointIndex] = defaultValue;
    return { ...series, values: newValues };
  });

  return {
    ...data,
    series: newSeries,
  };
}

/**
 * 축·값 라벨용 숫자 포맷.
 * 1000 이상은 K/M/B 로 축약해 라벨 폭을 일정하게 유지하고,
 * 그 미만은 소수 첫째 자리까지만 표시한다 (틱 보간에서 생기는 잔소수 제거).
 */
export function formatChartValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  const compact = (scaled: number, suffix: string) => {
    const rounded =
      Math.abs(scaled) >= 100
        ? Math.round(scaled)
        : Math.round(scaled * 10) / 10;
    return `${rounded}${suffix}`;
  };
  if (abs >= 1e9) return compact(value / 1e9, "B");
  if (abs >= 1e6) return compact(value / 1e6, "M");
  if (abs >= 1e3) return compact(value / 1e3, "K");
  return String(Math.round(value * 10) / 10);
}

/**
 * 축 틱 값 반올림. 범위가 넓으면 정수, 좁으면(10 미만) 소수 첫째 자리 —
 * 좁은 범위에서 정수로 반올림하면 같은 틱 값이 중복 표시된다.
 */
export function roundTickValue(value: number, range: number): number {
  return range >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
}

/**
 * 라벨 픽셀 폭 추정 (Konva 텍스트 측정 없이).
 * CJK/전각 문자는 fontSize, 그 외는 fontSize*0.6 로 근사한다.
 */
export function estimateLabelWidth(label: string, fontSize: number): number {
  let width = 0;
  for (const ch of label) {
    width += /[ᄀ-ᇿ⺀-퟿豈-ￜ]/.test(ch) ? fontSize : fontSize * 0.6;
  }
  return width;
}

/**
 * 카테고리 라벨 표시 간격.
 * 가장 긴 라벨이 슬롯(항목당 가로폭)보다 넓으면 N개마다 하나만 표시해
 * 라벨이 서로 겹쳐 쌓이지 않게 한다. 반환값 N: i % N === 0 인 항목만 표시.
 */
export function getLabelStep(maxLabelWidth: number, slotWidth: number): number {
  if (!Number.isFinite(slotWidth) || slotWidth <= 0) return 1;
  return Math.max(1, Math.ceil(maxLabelWidth / slotWidth));
}
