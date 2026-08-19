/**
 * Figma integration module
 *
 * v0.1.0: One-shot import (Figma → pig-ma) via REST API
 * v0.2.0: Write (pig-ma → Figma) via MCP server
 */

// Mapper (pure conversion functions)
export {
  figmaToPigma,
  pigmaToFigma,
  extractLeafNodes,
  importFigmaDocument,
  hexToFigmaColor,
  figmaColorToHex,
  svgPathToPoints,
} from "./mapper";
export type { FigmaImportResult } from "./mapper";

// REST API client
export {
  fetchFile,
  fetchNodes,
  fetchImageUrls,
  parseFigmaFileUrl,
} from "./client";

// Types
export type {
  FigmaNode,
  FigmaColor,
  FigmaPaint,
  FigmaTextStyle,
  FigmaBoundingBox,
  FigmaNodeType,
  FigmaFileResponse,
  PigmaShape,
} from "./types";

// Export (pig-ma → Figma)
export {
  exportToFigmaJson,
  downloadFigmaJson,
  downloadSvgFile,
  exportToSvg,
  copyToFigmaClipboard,
} from "./export";
export type { FigmaExportDocument } from "./export";

// Errors
export {
  FigmaAuthError,
  FigmaNotFoundError,
  FigmaRateLimitError,
} from "./types";
