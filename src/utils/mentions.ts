/**
 * Mention tracking — scan canvas objects and captions for @mentions
 */

import type { CanvasObject, CaptionThread } from "@/types";
import type { JSONContent } from "@tiptap/core";

export interface MentionEntry {
  mentionId: string;
  mentionLabel: string;
  sourceType: "object" | "caption";
  sourceId: string;
  sourceName: string;
  x: number;
  y: number;
}

/** Extract mentions from tiptapContent */
function extractMentionsFromTiptap(
  content: JSONContent | undefined,
): Array<{ id: string; label: string }> {
  if (!content) return [];
  const mentions: Array<{ id: string; label: string }> = [];

  function traverse(node: JSONContent) {
    if (node.type === "mention" && node.attrs) {
      mentions.push({
        id: node.attrs.id ?? "",
        label: node.attrs.label ?? "",
      });
    }
    if (node.content) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }

  traverse(content);
  return mentions;
}

/** Extract @mentions from plain text */
function extractMentionsFromText(
  text: string,
): Array<{ id: string; label: string }> {
  const mentions: Array<{ id: string; label: string }> = [];
  const regex = /@(\w+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    mentions.push({ id: match[1], label: match[1] });
  }
  return mentions;
}

/** Scan all canvas objects and captions for mentions */
export function scanAllMentions(
  objects: CanvasObject[],
  captions: CaptionThread[],
): MentionEntry[] {
  const entries: MentionEntry[] = [];

  // Scan canvas objects (tiptapContent)
  for (const obj of objects) {
    const mentions = extractMentionsFromTiptap(obj.tiptapContent);
    for (const m of mentions) {
      entries.push({
        mentionId: m.id,
        mentionLabel: m.label,
        sourceType: "object",
        sourceId: obj.id,
        sourceName: obj.text?.substring(0, 20) || obj.type,
        x: obj.x,
        y: obj.y,
      });
    }
  }

  // Scan captions
  for (const caption of captions) {
    for (const msg of caption.messages) {
      const mentions = extractMentionsFromText(msg.content);
      for (const m of mentions) {
        entries.push({
          mentionId: m.id,
          mentionLabel: m.label,
          sourceType: "caption",
          sourceId: caption.id,
          sourceName: msg.content.substring(0, 30),
          x: caption.x,
          y: caption.y,
        });
      }
    }
  }

  return entries;
}

/** Group mentions by user */
export function groupMentionsByUser(
  entries: MentionEntry[],
): Map<string, MentionEntry[]> {
  const map = new Map<string, MentionEntry[]>();
  for (const entry of entries) {
    const key = entry.mentionLabel;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return map;
}
