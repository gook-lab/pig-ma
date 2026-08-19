/**
 * Template Utilities
 *
 * Helper functions for template gallery functionality.
 */

import DOMPurify from "dompurify";
import type { TemplateCategory, TemplateDefinition } from "@/types";
import { DEFAULT_TEMPLATES, TEMPLATE_CATEGORIES } from "@/data/templates";

/**
 * Get all available templates
 */
export function getAllTemplates(): TemplateDefinition[] {
  return DEFAULT_TEMPLATES;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: TemplateCategory,
): TemplateDefinition[] {
  return DEFAULT_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): TemplateDefinition | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Search templates by name, description, or tags
 */
export function searchTemplates(query: string): TemplateDefinition[] {
  if (!query.trim()) return DEFAULT_TEMPLATES;

  const lowerQuery = query.toLowerCase();
  return DEFAULT_TEMPLATES.filter((t) => {
    const matchesName = t.name.toLowerCase().includes(lowerQuery);
    const matchesDescription = t.description.toLowerCase().includes(lowerQuery);
    const matchesTags = t.tags?.some((tag) =>
      tag.toLowerCase().includes(lowerQuery),
    );
    return matchesName || matchesDescription || matchesTags;
  });
}

/**
 * Get category metadata
 */
export function getCategoryInfo(category: TemplateCategory) {
  return TEMPLATE_CATEGORIES.find((c) => c.id === category);
}

/**
 * Get all category metadata
 */
export function getAllCategories() {
  return TEMPLATE_CATEGORIES;
}

/**
 * Calculate bounding box of a template
 */
export function getTemplateBounds(template: TemplateDefinition): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  if (template.objects.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of template.objects) {
    const objX = obj.x;
    const objY = obj.y;
    const objWidth = obj.width ?? obj.radius ?? 50;
    const objHeight = obj.height ?? obj.radius ?? 50;

    // Handle connector end points
    if (
      obj.type === "connector" &&
      obj.endX !== undefined &&
      obj.endY !== undefined
    ) {
      minX = Math.min(minX, objX, obj.endX);
      minY = Math.min(minY, objY, obj.endY);
      maxX = Math.max(maxX, objX, obj.endX);
      maxY = Math.max(maxY, objY, obj.endY);
    } else {
      minX = Math.min(minX, objX);
      minY = Math.min(minY, objY);
      maxX = Math.max(maxX, objX + objWidth);
      maxY = Math.max(maxY, objY + objHeight);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * Generate SVG thumbnail for a template
 * Returns an SVG string for preview rendering
 */
export function generateTemplateThumbnail(
  template: TemplateDefinition,
  size: { width: number; height: number } = { width: 120, height: 80 },
): string {
  const bounds = getTemplateBounds(template);
  if (bounds.width === 0 || bounds.height === 0) {
    return `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg"><rect fill="#f9fafb" width="${size.width}" height="${size.height}"/></svg>`;
  }

  // Calculate scale to fit template in thumbnail with more padding
  const padding = 10;
  const availableWidth = size.width - padding * 2;
  const availableHeight = size.height - padding * 2;
  const scale =
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height) *
    0.9; // 90% to ensure no clipping

  // Center the content
  const scaledWidth = bounds.width * scale;
  const scaledHeight = bounds.height * scale;
  const offsetX = (size.width - scaledWidth) / 2 - bounds.minX * scale;
  const offsetY = (size.height - scaledHeight) / 2 - bounds.minY * scale;

  let svgContent = "";

  // Helper to generate elbow path
  const generateElbowPath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): string => {
    const midX = (x1 + x2) / 2;
    return `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`;
  };

  // Helper to generate curved path
  const generateCurvedPath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): string => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const ctrlX = midX - dy * 0.2;
    const ctrlY = midY + dx * 0.2;
    return `M${x1},${y1} Q${ctrlX},${ctrlY} ${x2},${y2}`;
  };

  for (const obj of template.objects) {
    const x = obj.x * scale + offsetX;
    const y = obj.y * scale + offsetY;
    const width = (obj.width ?? 50) * scale;
    const height = (obj.height ?? 50) * scale;
    const fill = obj.fill ?? obj.backgroundColor ?? "#ffffff";
    const stroke = obj.stroke ?? "#374151";
    const strokeWidth = Math.max(0.5, (obj.strokeWidth ?? 2) * scale * 0.4);

    if (obj.type === "connector") {
      const endX = (obj.endX ?? obj.x) * scale + offsetX;
      const endY = (obj.endY ?? obj.y) * scale + offsetY;
      const pathStyle = obj.pathStyle ?? "straight";

      // Generate path based on style
      if (pathStyle === "elbowed") {
        const pathD = generateElbowPath(x, y, endX, endY);
        svgContent += `<path d="${pathD}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"/>`;
      } else if (pathStyle === "curved") {
        const pathD = generateCurvedPath(x, y, endX, endY);
        svgContent += `<path d="${pathD}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"/>`;
      } else {
        svgContent += `<line x1="${x}" y1="${y}" x2="${endX}" y2="${endY}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
      }
    } else if (
      obj.shapeVariant === "circle" ||
      obj.shapeVariant === "ellipse"
    ) {
      const rx = width / 2;
      const ry = height / 2;
      svgContent += `<ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else if (
      obj.shapeVariant === "flowDecision" ||
      obj.shapeVariant === "diamond"
    ) {
      // Diamond shape
      const cx = x + width / 2;
      const cy = y + height / 2;
      svgContent += `<polygon points="${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else if (obj.shapeVariant === "flowTerminal") {
      // Rounded rectangle (pill shape)
      const rx = Math.min(width, height) / 2;
      svgContent += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="${rx}"/>`;
    } else if (obj.type === "stickyNote") {
      svgContent += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" rx="2"/>`;
    } else {
      // Rectangle or other shapes
      svgContent += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="2"/>`;
    }
  }

  const svg = `<svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <rect fill="#f9fafb" width="${size.width}" height="${size.height}" rx="4"/>
    ${svgContent}
  </svg>`;

  // Sanitize SVG to prevent XSS attacks
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true },
    ADD_ATTR: ["xmlns"],
  });
}

/**
 * Keys that could cause prototype pollution if present in objects
 */
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"] as const;

/**
 * Sanitize a template object to prevent prototype pollution attacks.
 * Returns null if the object contains forbidden keys.
 */
export function sanitizeTemplateObject<T extends object>(
  obj: unknown,
): T | null {
  if (typeof obj !== "object" || obj === null) {
    return null;
  }

  // Check for forbidden keys
  for (const key of FORBIDDEN_KEYS) {
    if (key in obj) {
      console.warn(`[Template] Blocked template with forbidden key: ${key}`);
      return null;
    }
  }

  // Recursively check nested objects
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (sanitizeTemplateObject(item) === null) {
            return null;
          }
        }
      } else {
        if (sanitizeTemplateObject(value) === null) {
          return null;
        }
      }
    }
  }

  return obj as T;
}

/**
 * Validate and sanitize a template definition before applying
 */
export function validateTemplate(template: unknown): TemplateDefinition | null {
  const sanitized = sanitizeTemplateObject<TemplateDefinition>(template);
  if (!sanitized) return null;

  // Validate required fields
  if (
    typeof sanitized.id !== "string" ||
    typeof sanitized.name !== "string" ||
    !Array.isArray(sanitized.objects)
  ) {
    return null;
  }

  return sanitized;
}
