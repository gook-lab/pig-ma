import { cn } from "@/lib/utils";
import type { ShapeVariant } from "@/types";

interface ShapeIconProps {
  variant: ShapeVariant;
  className?: string;
}

/**
 * Basic Shape Icons (Progressive Disclosure)
 * 기본 도형 아이콘 - 필요할 때만 로드됩니다.
 */
export function BasicShapeIcon({ variant, className }: ShapeIconProps) {
  const baseClass = cn("w-8 h-8", className);

  switch (variant) {
    case "rectangle":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="5" width="18" height="14" rx="1" />
        </svg>
      );
    case "roundedRect":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="5" width="18" height="14" rx="4" />
        </svg>
      );
    case "circle":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "ellipse":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <ellipse cx="12" cy="12" rx="10" ry="6" />
        </svg>
      );
    case "triangle":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 3L22 21H2L12 3Z" />
        </svg>
      );
    case "triangleDown":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 21L2 3H22L12 21Z" />
        </svg>
      );
    case "diamond":
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
    case "pentagon":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 2L22 9L18 21H6L2 9L12 2Z" />
        </svg>
      );
    case "hexagon":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" />
        </svg>
      );
    case "octagon":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 2H16L22 8V16L16 22H8L2 16V8L8 2Z" />
        </svg>
      );
    case "star":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 2L14.5 9H22L16 13.5L18.5 21L12 16.5L5.5 21L8 13.5L2 9H9.5L12 2Z" />
        </svg>
      );
    case "star4":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 2L14 10H22L14 14L12 22L10 14L2 10H10L12 2Z" />
        </svg>
      );
    case "cross":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M9 2H15V9H22V15H15V22H9V15H2V9H9V2Z" />
        </svg>
      );
    case "arrowRight":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 8H14V4L22 12L14 20V16H2V8Z" />
        </svg>
      );
    case "arrowLeft":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M22 8H10V4L2 12L10 20V16H22V8Z" />
        </svg>
      );
    case "arrowUp":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 22V10H4L12 2L20 10H16V22H8Z" />
        </svg>
      );
    case "arrowDown":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 2V14H4L12 22L20 14H16V2H8Z" />
        </svg>
      );
    case "chevronRight":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 4L16 12L4 20V4Z" />
        </svg>
      );
    case "chevronLeft":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M20 4L8 12L20 20V4Z" />
        </svg>
      );
    case "speechBubble":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4H21V16H9L3 22V4Z" />
        </svg>
      );
    default:
      return null;
  }
}

// Basic shape variants for type checking
export const BASIC_SHAPE_VARIANTS = [
  "rectangle",
  "roundedRect",
  "circle",
  "ellipse",
  "triangle",
  "triangleDown",
  "diamond",
  "pentagon",
  "hexagon",
  "octagon",
  "star",
  "star4",
  "cross",
  "arrowRight",
  "arrowLeft",
  "arrowUp",
  "arrowDown",
  "chevronRight",
  "chevronLeft",
  "speechBubble",
] as const;

export function isBasicShape(variant: ShapeVariant): boolean {
  return (BASIC_SHAPE_VARIANTS as readonly string[]).includes(variant);
}
