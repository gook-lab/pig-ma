import { memo } from "react";
import type { ChartData } from "@/types";
import { getSeriesData } from "@/utils/chart";

interface ChartTooltipProps {
  chartData: ChartData;
  xIndex: number;
  screenX: number;
  screenY: number;
}

export const ChartTooltip = memo(function ChartTooltip({
  chartData,
  xIndex,
  screenX,
  screenY,
}: ChartTooltipProps) {
  const seriesData = getSeriesData(chartData);
  const label = chartData.items[xIndex]?.label ?? `Point ${xIndex + 1}`;

  // 툴팁 위치 조정 (화면 경계 고려)
  const tooltipStyle: React.CSSProperties = {
    left: screenX + 10,
    top: screenY - 10,
    transform: "translateY(-100%)",
  };

  return (
    <div
      className="pointer-events-none fixed z-[300] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
      style={tooltipStyle}
    >
      {/* X축 라벨 */}
      <div className="mb-1 text-xs font-semibold text-gray-700">{label}</div>

      {/* 각 시리즈 값 */}
      <div className="space-y-0.5">
        {seriesData.map((series) => {
          const value = series.values[xIndex];
          if (value === undefined) return null;

          return (
            <div key={series.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: series.style.color }}
              />
              <span className="text-gray-500">{series.name}:</span>
              <span className="font-medium text-gray-800">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
