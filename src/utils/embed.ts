/**
 * Embed URL parsing utilities
 * Supports YouTube and Figma URLs
 */

import type { EmbedType, EmbedMetadata, FigmaType } from "@/types";

export interface ParsedEmbed {
  type: EmbedType;
  url: string;
  metadata: EmbedMetadata;
}

/**
 * Parse YouTube URL and extract video ID and metadata
 * Supports: watch, youtu.be, shorts, live, embed, timestamps
 */
export function parseYouTubeUrl(url: string): EmbedMetadata | null {
  // Patterns:
  // https://www.youtube.com/watch?v=VIDEO_ID
  // https://youtu.be/VIDEO_ID
  // https://www.youtube.com/shorts/VIDEO_ID
  // https://www.youtube.com/live/VIDEO_ID
  // https://www.youtube.com/embed/VIDEO_ID
  // With timestamp: ?t=123 or &t=123 or ?start=123

  const patterns = [
    // Standard watch URL
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // Short URL
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Shorts
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    // Live
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    // Embed
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  let videoId: string | null = null;

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      videoId = match[1];
      break;
    }
  }

  if (!videoId) {
    return null;
  }

  // Extract timestamp if present
  let startTime: number | undefined;
  const timeMatch = url.match(/[?&](?:t|start)=(\d+)/);
  if (timeMatch) {
    startTime = parseInt(timeMatch[1], 10);
  }

  // YouTube thumbnail URL (high quality default)
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return {
    videoId,
    thumbnailUrl,
    startTime,
  };
}

/**
 * Parse Figma URL and extract file key and metadata
 * Supports: file, design, board, proto
 */
export function parseFigmaUrl(url: string): EmbedMetadata | null {
  // Patterns:
  // https://www.figma.com/file/FILE_KEY/File-Name
  // https://www.figma.com/design/FILE_KEY/File-Name
  // https://www.figma.com/board/FILE_KEY/Board-Name
  // https://www.figma.com/proto/FILE_KEY/Proto-Name
  // With node-id: ?node-id=123-456

  const patterns = [
    // Design (new URL format)
    /figma\.com\/design\/([a-zA-Z0-9]+)(?:\/([^?#]*))?/,
    // File (legacy URL format)
    /figma\.com\/file\/([a-zA-Z0-9]+)(?:\/([^?#]*))?/,
    // Board (FigJam)
    /figma\.com\/board\/([a-zA-Z0-9]+)(?:\/([^?#]*))?/,
    // Prototype
    /figma\.com\/proto\/([a-zA-Z0-9]+)(?:\/([^?#]*))?/,
  ];

  const typeMap: Record<number, FigmaType> = {
    0: "design", // design
    1: "design", // file (legacy)
    2: "board", // board
    3: "proto", // proto
  };

  let fileKey: string | null = null;
  let fileName: string | undefined;
  let figmaType: FigmaType = "design";

  for (let i = 0; i < patterns.length; i++) {
    const match = url.match(patterns[i]);
    if (match) {
      fileKey = match[1];
      // Decode URL-encoded file name and replace hyphens with spaces
      fileName = match[2]
        ? decodeURIComponent(match[2]).replace(/-/g, " ")
        : undefined;
      figmaType = typeMap[i];
      break;
    }
  }

  if (!fileKey) {
    return null;
  }

  // Extract node-id if present
  let nodeId: string | undefined;
  const nodeMatch = url.match(/[?&]node-id=([^&#]+)/);
  if (nodeMatch) {
    nodeId = decodeURIComponent(nodeMatch[1]);
  }

  return {
    fileKey,
    fileName,
    figmaType,
    nodeId,
  };
}

/**
 * Parse Notion URL and extract page ID and metadata
 * Supports: notion.so, notion.site
 */
export function parseNotionUrl(url: string): EmbedMetadata | null {
  // Patterns:
  // https://www.notion.so/workspace/Page-Title-abc123def456...
  // https://notion.so/Page-Title-abc123def456...
  // https://www.notion.site/Page-Title-abc123def456...
  // https://notion.so/abc123def456...

  // Notion page IDs are 32 hex characters (without dashes) at the end of URL
  const pageIdPattern = /([a-f0-9]{32})(?:\?|$)/i;
  // Or with dashes: 8-4-4-4-12 format
  const uuidPattern =
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\?|$)/i;

  // Check if it's a Notion URL
  if (!url.includes("notion.so") && !url.includes("notion.site")) {
    return null;
  }

  let pageId: string | null = null;
  let pageName: string | undefined;

  // Try to extract page ID
  const uuidMatch = url.match(uuidPattern);
  if (uuidMatch) {
    pageId = uuidMatch[1].replace(/-/g, "");
  } else {
    const idMatch = url.match(pageIdPattern);
    if (idMatch) {
      pageId = idMatch[1];
    }
  }

  if (!pageId) {
    return null;
  }

  // Try to extract page name from URL path
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    // Find the part that contains the page name (before the ID)
    for (const part of pathParts) {
      if (part.includes(pageId) || part.match(/[a-f0-9]{32}$/i)) {
        // Extract name before the ID
        const nameMatch = part.match(/^(.+?)-[a-f0-9]{32}$/i);
        if (nameMatch) {
          pageName = decodeURIComponent(nameMatch[1]).replace(/-/g, " ");
        }
        break;
      }
    }
  } catch {
    // Ignore URL parsing errors
  }

  return {
    pageId,
    pageName: pageName || "Notion Page",
  };
}

/**
 * Unified URL parser - detects embed type and parses accordingly
 */
export function parseEmbedUrl(url: string): ParsedEmbed | null {
  // Normalize URL
  const normalizedUrl = url.trim();

  // Check YouTube
  if (
    normalizedUrl.includes("youtube.com") ||
    normalizedUrl.includes("youtu.be")
  ) {
    const metadata = parseYouTubeUrl(normalizedUrl);
    if (metadata) {
      return {
        type: "youtube",
        url: normalizedUrl,
        metadata,
      };
    }
  }

  // Check Figma
  if (normalizedUrl.includes("figma.com")) {
    const metadata = parseFigmaUrl(normalizedUrl);
    if (metadata) {
      return {
        type: "figma",
        url: normalizedUrl,
        metadata,
      };
    }
  }

  // Check Notion
  if (
    normalizedUrl.includes("notion.so") ||
    normalizedUrl.includes("notion.site")
  ) {
    const metadata = parseNotionUrl(normalizedUrl);
    if (metadata) {
      return {
        type: "notion",
        url: normalizedUrl,
        metadata,
      };
    }
  }

  return null;
}

/**
 * Generate iframe src URL for embed
 * Uses privacy-enhanced mode for YouTube (youtube-nocookie.com)
 */
export function getEmbedIframeUrl(
  embedType: EmbedType,
  metadata: EmbedMetadata,
): string {
  if (embedType === "youtube" && metadata.videoId) {
    // Use youtube-nocookie.com for GDPR compliance
    let url = `https://www.youtube-nocookie.com/embed/${metadata.videoId}`;

    const params: string[] = [];

    // Add timestamp if present
    if (metadata.startTime) {
      params.push(`start=${metadata.startTime}`);
    }

    // Enable JS API for potential future controls
    params.push("enablejsapi=1");

    // Disable related videos from other channels at end
    params.push("rel=0");

    if (params.length > 0) {
      url += "?" + params.join("&");
    }

    return url;
  }

  if (embedType === "figma" && metadata.fileKey) {
    // Figma embed URL format
    let url = `https://www.figma.com/embed?embed_host=share&url=`;

    // Reconstruct the original URL for embed
    const figmaBase = "https://www.figma.com";
    let originalUrl = "";

    if (metadata.figmaType === "board") {
      originalUrl = `${figmaBase}/board/${metadata.fileKey}`;
    } else if (metadata.figmaType === "proto") {
      originalUrl = `${figmaBase}/proto/${metadata.fileKey}`;
    } else {
      // design or file
      originalUrl = `${figmaBase}/design/${metadata.fileKey}`;
    }

    // Add node-id if present
    if (metadata.nodeId) {
      originalUrl += `?node-id=${encodeURIComponent(metadata.nodeId)}`;
    }

    url += encodeURIComponent(originalUrl);

    return url;
  }

  if (embedType === "notion" && metadata.pageId) {
    // Notion embed URL - format page ID with dashes for embed
    const formattedId = metadata.pageId.replace(
      /([a-f0-9]{8})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{12})/i,
      "$1-$2-$3-$4-$5",
    );
    return `https://notion.so/embed/${formattedId}`;
  }

  return "";
}

/**
 * Check if a URL is a valid embed URL (YouTube or Figma)
 */
export function isEmbedUrl(url: string): boolean {
  return parseEmbedUrl(url) !== null;
}

/**
 * Get embed type label for display
 */
export function getEmbedTypeLabel(embedType: EmbedType): string {
  switch (embedType) {
    case "youtube":
      return "YouTube";
    case "figma":
      return "Figma";
    default:
      return "Embed";
  }
}
