import { memo } from "react";
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Z_OPTIONS_BAR } from "@/constants/zIndex";
import type { AlignDirection, DistributeDirection } from "@/utils/align";

interface AlignOptionsBarProps {
  position: { x: number; y: number };
  /** 분배는 3개 이상 선택 시에만 활성화 */
  canDistribute: boolean;
  onAlign: (direction: AlignDirection) => void;
  onDistribute: (direction: DistributeDirection) => void;
}

const ALIGN_BUTTONS: {
  direction: AlignDirection;
  icon: typeof AlignStartVertical;
  title: string;
}[] = [
  { direction: "left", icon: AlignStartVertical, title: "Align left" },
  { direction: "centerX", icon: AlignCenterVertical, title: "Align center" },
  { direction: "right", icon: AlignEndVertical, title: "Align right" },
  { direction: "top", icon: AlignStartHorizontal, title: "Align top" },
  { direction: "centerY", icon: AlignCenterHorizontal, title: "Align middle" },
  { direction: "bottom", icon: AlignEndHorizontal, title: "Align bottom" },
];

export const AlignOptionsBar = memo(function AlignOptionsBar({
  position,
  canDistribute,
  onAlign,
  onDistribute,
}: AlignOptionsBarProps) {
  return (
    <div
      className="fixed"
      style={{ left: position.x, top: position.y, zIndex: Z_OPTIONS_BAR }}
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
        {ALIGN_BUTTONS.slice(0, 3).map(({ direction, icon: Icon, title }) => (
          <button
            key={direction}
            onClick={() => onAlign(direction)}
            className="rounded p-2 transition-all hover:bg-gray-700"
            title={title}
            aria-label={title}
          >
            <Icon className="h-4 w-4 text-white" />
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {ALIGN_BUTTONS.slice(3).map(({ direction, icon: Icon, title }) => (
          <button
            key={direction}
            onClick={() => onAlign(direction)}
            className="rounded p-2 transition-all hover:bg-gray-700"
            title={title}
            aria-label={title}
          >
            <Icon className="h-4 w-4 text-white" />
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-gray-600" />

        <button
          onClick={() => onDistribute("horizontal")}
          disabled={!canDistribute}
          className={cn(
            "rounded p-2 transition-all",
            canDistribute
              ? "hover:bg-gray-700"
              : "cursor-not-allowed opacity-40",
          )}
          title="Distribute horizontally"
          aria-label="Distribute horizontally"
        >
          <AlignHorizontalDistributeCenter className="h-4 w-4 text-white" />
        </button>
        <button
          onClick={() => onDistribute("vertical")}
          disabled={!canDistribute}
          className={cn(
            "rounded p-2 transition-all",
            canDistribute
              ? "hover:bg-gray-700"
              : "cursor-not-allowed opacity-40",
          )}
          title="Distribute vertically"
          aria-label="Distribute vertically"
        >
          <AlignVerticalDistributeCenter className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
});
