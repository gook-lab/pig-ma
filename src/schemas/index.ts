import { z } from "zod";
import { CanvasObjectSchema } from "./canvasObject";

// Re-export canvas object schemas
export * from "./canvasObject";

// Viewport schema
export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

// Canvas bounds schema
export const CanvasBoundsSchema = z.object({
  minX: z.number(),
  minY: z.number(),
  maxX: z.number(),
  maxY: z.number(),
});

// Comment attachment schema
export const CommentAttachmentSchema = z
  .object({
    id: z.string(),
    type: z.literal("image"),
    url: z.string(),
    name: z.string(),
  })
  .passthrough();

// Comment message schema
export const CommentMessageSchema = z
  .object({
    id: z.string(),
    authorId: z.string(),
    authorName: z.string(),
    content: z.string(),
    createdAt: z.string(),
    attachments: z.array(CommentAttachmentSchema).optional(),
  })
  .passthrough();

// Caption thread schema
export const CaptionThreadSchema = z
  .object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    messages: z.array(CommentMessageSchema),
    isResolved: z.boolean(),
    isRead: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

// Group info schema
export const GroupInfoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    fill: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
    lineStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
    hidden: z.boolean().optional(),
    locked: z.boolean().optional(),
    tagColor: z.string().optional(),
    customBounds: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .optional(),
  })
  .passthrough();

// User schema
export const UserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    avatarColor: z.string().optional(),
  })
  .passthrough();

// Page data schema
export const PageDataSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    objects: z.array(CanvasObjectSchema),
    groups: z.array(GroupInfoSchema),
    captions: z.array(CaptionThreadSchema),
    viewport: ViewportSchema,
    canvasBounds: CanvasBoundsSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

// Shape variant schema for recent/favorite shapes
export const ShapeVariantPersistSchema = z.enum([
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
]);

// Persisted state schema (for localStorage validation)
export const PersistedStateSchema = z
  .object({
    // Page System (v3)
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    pages: z.array(PageDataSchema).optional(),
    currentPageId: z.string().optional(),

    // Legacy compatibility (v1, v2)
    objects: z.array(CanvasObjectSchema).optional(),
    viewport: ViewportSchema.optional(),
    groups: z.array(GroupInfoSchema).optional(),
    captions: z.array(CaptionThreadSchema).optional(),

    // User settings
    recentShapes: z.array(ShapeVariantPersistSchema).optional(),
    favoriteShapes: z.array(ShapeVariantPersistSchema).optional(),
    currentUser: UserSchema.optional(),
    favoriteTemplates: z.array(z.string()).optional(),
  })
  .passthrough(); // Allow unknown fields for future compatibility

// Type exports
export type ViewportParsed = z.infer<typeof ViewportSchema>;
export type CanvasBoundsParsed = z.infer<typeof CanvasBoundsSchema>;
export type CommentAttachmentParsed = z.infer<typeof CommentAttachmentSchema>;
export type CommentMessageParsed = z.infer<typeof CommentMessageSchema>;
export type CaptionThreadParsed = z.infer<typeof CaptionThreadSchema>;
export type GroupInfoParsed = z.infer<typeof GroupInfoSchema>;
export type UserParsed = z.infer<typeof UserSchema>;
export type PageDataParsed = z.infer<typeof PageDataSchema>;
export type PersistedStateParsed = z.infer<typeof PersistedStateSchema>;

/**
 * Validate persisted state from localStorage
 * Returns { success: true, data } on valid data
 * Returns { success: false, error } on invalid data
 */
export function validatePersistedState(data: unknown) {
  return PersistedStateSchema.safeParse(data);
}

/**
 * Validate a single CanvasObject
 */
export function validateCanvasObject(data: unknown) {
  return CanvasObjectSchema.safeParse(data);
}

/**
 * Validate a single PageData
 */
export function validatePageData(data: unknown) {
  return PageDataSchema.safeParse(data);
}
