import { cn } from "@/lib/utils";
import type { ShapeVariant } from "@/types";

interface ShapeIconProps {
  variant: ShapeVariant;
  className?: string;
}

/**
 * Flowchart Shape Icons (Progressive Disclosure)
 * 플로우차트 아이콘 - 필요할 때만 로드됩니다.
 */
export function FlowchartShapeIcon({ variant, className }: ShapeIconProps) {
  const baseClass = cn("w-8 h-8", className);

  switch (variant) {
    case "flowProcess":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="6" width="20" height="12" />
        </svg>
      );
    case "flowDecision":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 2L22 12L12 22L2 12L12 2Z" />
        </svg>
      );
    case "flowTerminal":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="6" width="20" height="12" rx="6" />
        </svg>
      );
    case "flowData":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 5H22L18 19H2L6 5Z" />
        </svg>
      );
    case "flowDocument":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4H21V18C21 18 18 16 12 18C6 20 3 18 3 18V4Z" />
        </svg>
      );
    case "flowDatabase":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <ellipse cx="12" cy="6" rx="9" ry="3" />
          <path d="M3 6V18C3 19.66 7 21 12 21C17 21 21 19.66 21 18V6" />
          <path d="M3 12C3 13.66 7 15 12 15C17 15 21 13.66 21 12" />
        </svg>
      );
    case "flowPredefined":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2" y="6" width="20" height="12" />
          <line x1="5" y1="6" x2="5" y2="18" />
          <line x1="19" y1="6" x2="19" y2="18" />
        </svg>
      );
    case "flowManualInput":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 8L22 4V20H2V8Z" />
        </svg>
      );
    case "flowPreparation":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 4H18L22 12L18 20H6L2 12L6 4Z" />
        </svg>
      );
    case "flowDelay":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 5H15C19 5 21 8 21 12C21 16 19 19 15 19H3V5Z" />
        </svg>
      );
    case "flowOr":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      );
    case "flowSumming":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
          <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
        </svg>
      );
    default:
      return null;
  }
}

// Flowchart shape variants for type checking
export const FLOWCHART_SHAPE_VARIANTS = [
  "flowProcess",
  "flowDecision",
  "flowTerminal",
  "flowData",
  "flowDocument",
  "flowDatabase",
  "flowPredefined",
  "flowManualInput",
  "flowPreparation",
  "flowDelay",
  "flowOr",
  "flowSumming",
] as const;

export function isFlowchartShape(variant: ShapeVariant): boolean {
  return (FLOWCHART_SHAPE_VARIANTS as readonly string[]).includes(variant);
}
