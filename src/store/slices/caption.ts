import type {
  CaptionThread,
  User,
  CaptionFilter,
  CommentAttachment,
  CanvasStoreActions,
} from "@/types";
import { generateUUID } from "@/utils/uuid";
import type { SliceCreator } from "../types";

// ============================================================================
// Caption Slice Types
// ============================================================================

export interface CaptionState {
  captions: CaptionThread[];
  currentUser: User;
  isCaptionPanelOpen: boolean;
  activeCaptionId: string | null;
  captionFilter: CaptionFilter;
}

export interface CaptionActions {
  addCaption: CanvasStoreActions["addCaption"];
  addReply: CanvasStoreActions["addReply"];
  deleteCaption: CanvasStoreActions["deleteCaption"];
  deleteMessage: CanvasStoreActions["deleteMessage"];
  resolveCaption: CanvasStoreActions["resolveCaption"];
  unresolveCaption: CanvasStoreActions["unresolveCaption"];
  markAsRead: CanvasStoreActions["markAsRead"];
  setActiveCaptionId: CanvasStoreActions["setActiveCaptionId"];
  toggleCaptionPanel: CanvasStoreActions["toggleCaptionPanel"];
  setCaptionPanelOpen: CanvasStoreActions["setCaptionPanelOpen"];
  setCaptionFilter: CanvasStoreActions["setCaptionFilter"];
  updateCaption: CanvasStoreActions["updateCaption"];
}

export type CaptionSlice = CaptionState & CaptionActions;

// ============================================================================
// Helpers
// ============================================================================

const generateDefaultUser = (): User => ({
  id: generateUUID(),
  name: "User",
  avatarColor: "#3b82f6",
});

// ============================================================================
// Initial State
// ============================================================================

export const captionInitialState: CaptionState = {
  captions: [],
  currentUser: generateDefaultUser(),
  isCaptionPanelOpen: false,
  activeCaptionId: null,
  captionFilter: {
    showResolved: false,
    onlyMyThreads: false,
    sortBy: "date",
    authorSearch: "",
  },
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createCaptionSlice: SliceCreator<CaptionSlice> = (set, get) => ({
  ...captionInitialState,

  addCaption: (
    x: number,
    y: number,
    content: string,
    attachments?: CommentAttachment[],
  ) => {
    const now = new Date().toISOString();
    const currentUser = get().currentUser;
    const newCaption: CaptionThread = {
      id: generateUUID(),
      x,
      y,
      messages: [
        {
          id: generateUUID(),
          authorId: currentUser.id,
          authorName: currentUser.name,
          content,
          createdAt: now,
          attachments,
        },
      ],
      isResolved: false,
      isRead: true,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      captions: [...state.captions, newCaption],
      activeCaptionId: newCaption.id,
      isCaptionPanelOpen: true,
    }));
    return newCaption;
  },

  addReply: (
    captionId: string,
    content: string,
    attachments?: CommentAttachment[],
  ) => {
    const now = new Date().toISOString();
    set((state) => ({
      captions: state.captions.map((caption) =>
        caption.id === captionId
          ? {
              ...caption,
              messages: [
                ...caption.messages,
                {
                  id: generateUUID(),
                  authorId: state.currentUser.id,
                  authorName: state.currentUser.name,
                  content,
                  createdAt: now,
                  attachments,
                },
              ],
              updatedAt: now,
            }
          : caption,
      ),
    }));
  },

  deleteCaption: (captionId) =>
    set((state) => ({
      captions: state.captions.filter((c) => c.id !== captionId),
      activeCaptionId:
        state.activeCaptionId === captionId ? null : state.activeCaptionId,
    })),

  deleteMessage: (captionId, messageId) =>
    set((state) => ({
      captions: state.captions
        .map((caption) => {
          if (caption.id !== captionId) return caption;
          const filteredMessages = caption.messages.filter(
            (m) => m.id !== messageId,
          );
          if (filteredMessages.length === 0) return null;
          return { ...caption, messages: filteredMessages };
        })
        .filter(Boolean) as CaptionThread[],
    })),

  resolveCaption: (captionId) =>
    set((state) => ({
      captions: state.captions.map((c) =>
        c.id === captionId
          ? { ...c, isResolved: true, updatedAt: new Date().toISOString() }
          : c,
      ),
    })),

  unresolveCaption: (captionId) =>
    set((state) => ({
      captions: state.captions.map((c) =>
        c.id === captionId
          ? { ...c, isResolved: false, updatedAt: new Date().toISOString() }
          : c,
      ),
    })),

  markAsRead: (captionId) =>
    set((state) => ({
      captions: state.captions.map((c) =>
        c.id === captionId ? { ...c, isRead: true } : c,
      ),
    })),

  setActiveCaptionId: (id) =>
    set((state) => ({
      activeCaptionId: id,
      isCaptionPanelOpen: id !== null ? true : state.isCaptionPanelOpen,
    })),

  toggleCaptionPanel: () =>
    set((state) => ({ isCaptionPanelOpen: !state.isCaptionPanelOpen })),

  setCaptionPanelOpen: (open) => set({ isCaptionPanelOpen: open }),

  setCaptionFilter: (filter) =>
    set((state) => ({
      captionFilter: { ...state.captionFilter, ...filter },
    })),

  updateCaption: (captionId, updates) =>
    set((state) => ({
      captions: state.captions.map((c) =>
        c.id === captionId ? { ...c, ...updates } : c,
      ),
    })),
});
