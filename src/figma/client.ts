/**
 * Figma REST API client
 *
 * Read-only client for v0.1.0. Uses Personal Access Token (PAT) for auth.
 * The library never stores tokens — PAT is passed as argument to each call.
 */

import type { FigmaFileResponse } from "./types";
import {
  FigmaAuthError,
  FigmaNotFoundError,
  FigmaRateLimitError,
} from "./types";

const FIGMA_API_BASE = "https://api.figma.com/v1";

/** Parse a Figma file URL to extract the file key */
export function parseFigmaFileUrl(url: string): string | null {
  // https://www.figma.com/file/XXXXX/Title
  // https://www.figma.com/design/XXXXX/Title
  // https://www.figma.com/board/XXXXX/Title
  const match = url.match(/figma\.com\/(?:file|design|board)\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

/** Handle 403 errors with scope detection */
async function handle403(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  const msg = body?.err ?? "";
  if (msg.includes("scope")) {
    throw new FigmaAuthError(
      "Token missing required scope. Regenerate with 'File content → Read' enabled.",
    );
  }
  throw new FigmaAuthError();
}

/** Fetch a Figma file's document tree */
export async function fetchFile(
  fileKey: string,
  token: string,
): Promise<FigmaFileResponse> {
  const res = await fetch(`${FIGMA_API_BASE}/files/${fileKey}?geometry=paths`, {
    headers: { "X-Figma-Token": token },
  });

  if (res.status === 403) await handle403(res);
  if (res.status === 404) throw new FigmaNotFoundError(fileKey);
  if (res.status === 429) throw new FigmaRateLimitError();
  if (!res.ok)
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`);

  return res.json();
}

/** Fetch specific nodes from a Figma file */
export async function fetchNodes(
  fileKey: string,
  nodeIds: string[],
  token: string,
): Promise<FigmaFileResponse> {
  const ids = nodeIds.join(",");
  const res = await fetch(
    `${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`,
    { headers: { "X-Figma-Token": token } },
  );

  if (res.status === 403) await handle403(res);
  if (res.status === 404) throw new FigmaNotFoundError(fileKey);
  if (res.status === 429) throw new FigmaRateLimitError();
  if (!res.ok)
    throw new Error(`Figma API error: ${res.status} ${res.statusText}`);

  return res.json();
}

/** Render specific nodes as PNG images (for vectors that can't be converted to lines) */
export async function renderNodes(
  fileKey: string,
  nodeIds: string[],
  token: string,
): Promise<Record<string, string>> {
  const ids = nodeIds.join(",");
  const res = await fetch(
    `${FIGMA_API_BASE}/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
    { headers: { "X-Figma-Token": token } },
  );

  if (!res.ok) return {};

  const data = await res.json();
  return data?.images ?? {};
}

/** Fetch image URLs for all images in a file (imageRef → CDN URL) */
export async function fetchImageUrls(
  fileKey: string,
  token: string,
): Promise<Record<string, string>> {
  const res = await fetch(`${FIGMA_API_BASE}/files/${fileKey}/images`, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) return {};

  const data = await res.json();
  return data?.meta?.images ?? {};
}
