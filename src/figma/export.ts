/**
 * Figma Export — pig-ma → Figma
 *
 * Two export modes:
 * 1. SVG clipboard — copy as SVG for paste in Figma (Cmd+V)
 * 2. JSON download — Figma node tree as .json file
 */

import type { CanvasObject } from "@/types";
import type { FigmaNode, PigmaShape } from "./types";
import { pigmaToFigma } from "./mapper";

// ============================================================================
// CanvasObject → PigmaShape conversion
// ============================================================================

function canvasObjectToPigmaShape(obj: CanvasObject): PigmaShape | null {
  const base = {
    id: obj.id,
    x: obj.x,
    y: obj.y,
    width: obj.width ?? 100,
    height: obj.height ?? 100,
    rotation: obj.rotation,
    opacity: obj.opacity,
  };

  switch (obj.type) {
    case "shape":
      return {
        ...base,
        type: "shape",
        fill: obj.fill,
        fillMode: obj.fillMode as PigmaShape["fillMode"],
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        shapeVariant: obj.shapeVariant as PigmaShape["shapeVariant"],
        text: obj.text,
        textColor: obj.textColor,
        fontSize: obj.fontSize,
      };

    case "stickyNote":
      return {
        ...base,
        type: "stickyNote",
        text: obj.text,
        backgroundColor: obj.backgroundColor ?? obj.fill ?? "#FEF08A",
        fontSize: obj.fontSize,
      };

    case "textBox":
      return {
        ...base,
        type: "textBox",
        text: obj.text,
        tiptapContent: obj.tiptapContent,
        textColor: obj.textColor,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fontWeight: obj.fontWeight as PigmaShape["fontWeight"],
        textAlign: obj.textAlign as PigmaShape["textAlign"],
      };

    case "line":
      return {
        ...base,
        type: "line",
        points: obj.points,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        penType: obj.penType as PigmaShape["penType"],
      };

    case "image":
      return {
        ...base,
        type: "image",
        src: obj.src,
      };

    case "connector":
      return {
        ...base,
        type: "connector",
        endX: obj.endX,
        endY: obj.endY,
        sourceId: obj.sourceId,
        targetId: obj.targetId,
        pathStyle: obj.pathStyle as PigmaShape["pathStyle"],
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        startMarker: obj.startMarker,
        endMarker: obj.endMarker,
      };

    // Types without direct Figma mapping — export as rectangle placeholder
    case "table":
    case "chart":
    case "codeBlock":
    case "embed":
      return {
        ...base,
        type: "shape",
        fill: "#f3f4f6",
        stroke: "#d1d5db",
        strokeWidth: 1,
        shapeVariant: "rectangle",
        text: `[${obj.type}]`,
      };

    case "connectorLabel":
      return null; // Labels are part of connectors

    default:
      return null;
  }
}

// ============================================================================
// Figma JSON Export
// ============================================================================

export interface FigmaExportDocument {
  name: string;
  document: FigmaNode;
  exportedAt: string;
  objectCount: number;
}

/** Convert canvas objects to Figma document JSON */
export function exportToFigmaJson(
  objects: CanvasObject[],
  documentName: string = "pig-ma export",
): FigmaExportDocument {
  const figmaNodes: FigmaNode[] = [];

  for (const obj of objects) {
    const pigma = canvasObjectToPigmaShape(obj);
    if (!pigma) continue;
    figmaNodes.push(pigmaToFigma(pigma));
  }

  const document: FigmaNode = {
    id: "0:0",
    name: "Document",
    type: "DOCUMENT",
    children: [
      {
        id: "0:1",
        name: "Page 1",
        type: "CANVAS",
        children: figmaNodes,
      },
    ],
  };

  return {
    name: documentName,
    document,
    exportedAt: new Date().toISOString(),
    objectCount: figmaNodes.length,
  };
}

/** Download Figma JSON file (for pig-ma Figma plugin import) */
export function downloadFigmaJson(
  objects: CanvasObject[],
  documentName: string = "pig-ma export",
): void {
  const data = exportToFigmaJson(objects, documentName);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${documentName.replace(/\s+/g, "-")}.pigma.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/** Download SVG file (can be dragged into Figma or imported via File > Import) */
export function downloadSvgFile(
  objects: CanvasObject[],
  documentName: string = "pig-ma export",
): void {
  const svg = exportToSvg(objects);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${documentName.replace(/\s+/g, "-")}.svg`;
  a.click();

  URL.revokeObjectURL(url);
}

// ============================================================================
// SVG Export (for Figma clipboard paste)
// ============================================================================

/** Convert canvas objects to SVG string */
export function exportToSvg(objects: CanvasObject[]): string {
  // Calculate bounding box of all objects
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const obj of objects) {
    if (obj.type === "connectorLabel") continue;
    const w = obj.width ?? 100;
    const h = obj.height ?? 100;
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + w);
    maxY = Math.max(maxY, obj.y + h);
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }

  const padding = 20;
  const vx = minX - padding;
  const vy = minY - padding;
  const vw = maxX - minX + padding * 2;
  const vh = maxY - minY + padding * 2;

  const elements: string[] = [];

  for (const obj of objects) {
    const el = canvasObjectToSvg(obj);
    if (el) elements.push(el);
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`,
    ...elements,
    "</svg>",
  ].join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function canvasObjectToSvg(obj: CanvasObject): string | null {
  const opacity =
    obj.opacity !== undefined && obj.opacity < 1
      ? ` opacity="${obj.opacity}"`
      : "";
  const rotation = obj.rotation
    ? ` transform="rotate(${obj.rotation} ${obj.x + (obj.width ?? 100) / 2} ${obj.y + (obj.height ?? 100) / 2})"`
    : "";

  switch (obj.type) {
    case "shape": {
      const w = obj.width ?? 100;
      const h = obj.height ?? 100;
      const fill = obj.fillMode === "nofill" ? "none" : (obj.fill ?? "#3b82f6");
      const stroke = obj.stroke ?? "none";
      const sw = obj.strokeWidth ?? 2;

      if (obj.shapeVariant === "circle" || obj.shapeVariant === "ellipse") {
        const cx = obj.x + w / 2;
        const cy = obj.y + h / 2;
        return `  <ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${opacity}${rotation}/>`;
      }

      return `  <rect x="${obj.x}" y="${obj.y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="4"${opacity}${rotation}/>`;
    }

    case "stickyNote": {
      const w = obj.width ?? 150;
      const h = obj.height ?? 150;
      const bg = obj.backgroundColor ?? obj.fill ?? "#FEF08A";
      const text = obj.text ?? "";
      return [
        `  <g${opacity}${rotation}>`,
        `    <rect x="${obj.x}" y="${obj.y}" width="${w}" height="${h}" fill="${bg}" rx="4" filter="url(#shadow)"/>`,
        text
          ? `    <text x="${obj.x + 12}" y="${obj.y + 24}" font-size="${obj.fontSize ?? 16}" font-family="sans-serif" fill="#374151">${escapeXml(text)}</text>`
          : "",
        "  </g>",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "textBox": {
      const text = obj.text ?? "";
      if (!text) return null;
      const color = obj.textColor ?? "#374151";
      const fontSize = obj.fontSize ?? 16;
      return `  <text x="${obj.x}" y="${obj.y + fontSize}" font-size="${fontSize}" font-family="${obj.fontFamily ?? "sans-serif"}" fill="${color}" font-weight="${obj.fontWeight ?? "normal"}"${opacity}${rotation}>${escapeXml(text)}</text>`;
    }

    case "line": {
      if (!obj.points || obj.points.length < 4) return null;
      const pts: string[] = [];
      for (let i = 0; i < obj.points.length; i += 2) {
        pts.push(`${obj.x + obj.points[i]},${obj.y + obj.points[i + 1]}`);
      }
      const stroke = obj.stroke ?? "#374151";
      const sw = obj.strokeWidth ?? 2;
      return `  <polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${opacity}/>`;
    }

    case "connector": {
      const endX = obj.endX ?? obj.x + 100;
      const endY = obj.endY ?? obj.y;
      const stroke = obj.stroke ?? "#374151";
      const sw = obj.strokeWidth ?? 2;
      return `  <line x1="${obj.x}" y1="${obj.y}" x2="${endX}" y2="${endY}" stroke="${stroke}" stroke-width="${sw}"${opacity}/>`;
    }

    case "image": {
      const w = obj.width ?? 100;
      const h = obj.height ?? 100;
      if (!obj.src)
        return `  <rect x="${obj.x}" y="${obj.y}" width="${w}" height="${h}" fill="#f3f4f6" stroke="#d1d5db" rx="4"/>`;
      return `  <image x="${obj.x}" y="${obj.y}" width="${w}" height="${h}" href="${obj.src}"${opacity}${rotation}/>`;
    }

    case "connectorLabel":
      return null;

    default: {
      // table, chart, codeBlock, embed — placeholder rect
      const w = obj.width ?? 100;
      const h = obj.height ?? 100;
      return [
        `  <g${opacity}${rotation}>`,
        `    <rect x="${obj.x}" y="${obj.y}" width="${w}" height="${h}" fill="#f3f4f6" stroke="#d1d5db" rx="4"/>`,
        `    <text x="${obj.x + w / 2}" y="${obj.y + h / 2 + 5}" text-anchor="middle" font-size="12" fill="#9ca3af">[${obj.type}]</text>`,
        "  </g>",
      ].join("\n");
    }
  }
}

/** Copy SVG to clipboard for Figma paste.
 * Figma parses SVG from text/html and creates individual editable nodes:
 * <rect> → Rectangle, <ellipse> → Ellipse, <text> → Text
 */
export async function copyToFigmaClipboard(
  objects: CanvasObject[],
): Promise<void> {
  const svg = exportToSvg(objects);

  // Figma reads text/html for SVG parsing into editable nodes
  const htmlBlob = new Blob([svg], { type: "text/html" });
  const textBlob = new Blob([svg], { type: "text/plain" });

  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob,
    }),
  ]);
}
