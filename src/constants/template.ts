/**
 * Template System Constants
 *
 * Limits and constraints for template storage to prevent localStorage quota exceeded errors.
 */

/**
 * Template storage limits
 * localStorage limit is ~5MB, we allocate ~1MB for templates
 */
export const TEMPLATE_LIMITS = {
  /** Maximum number of custom templates */
  maxCustomTemplates: 50,
  /** Maximum number of recent templates to track */
  maxRecentTemplates: 10,
  /** Maximum size of a single template in bytes (estimated) */
  maxTemplateSize: 100_000, // 100KB
  /** Warning threshold for custom templates count */
  warningThreshold: 40,
} as const;

/**
 * Check if a new custom template can be added
 * @param currentCount Current number of custom templates
 * @returns Object with canAdd status and optional warning/error message
 */
export function canAddTemplate(currentCount: number): {
  canAdd: boolean;
  message?: string;
  isWarning?: boolean;
} {
  if (currentCount >= TEMPLATE_LIMITS.maxCustomTemplates) {
    return {
      canAdd: false,
      message: `Maximum ${TEMPLATE_LIMITS.maxCustomTemplates} custom templates reached. Delete some templates to add more.`,
    };
  }

  if (currentCount >= TEMPLATE_LIMITS.warningThreshold) {
    return {
      canAdd: true,
      message: `You have ${currentCount} custom templates. Consider removing unused ones.`,
      isWarning: true,
    };
  }

  return { canAdd: true };
}

/**
 * Estimate the size of a template in bytes
 * @param template Template object
 * @returns Estimated size in bytes
 */
export function estimateTemplateSize(template: unknown): number {
  return new Blob([JSON.stringify(template)]).size;
}
