# Pig-ma

FigJam-style infinite canvas library for React with rich text editing, shapes, connectors, and comments.

> **한 줄 요약** — React용 FigJam 스타일 무한 캔버스 라이브러리. 도형·리치 텍스트·커넥터·
> 댓글·Figma 연동을 포함하며, npm 패키지로 배포 가능한 형태로 만든 토이 프로젝트다.
> 설계 문서는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)에 한국어로 정리되어 있다.

## Installation

```bash
npm install pig-ma
```

## Quick Start

```tsx
import { Canvas, Toolbar, ZoomControls, useKeyboardShortcuts } from 'pig-ma';
import 'pig-ma/styles.css';

function App() {
  useKeyboardShortcuts();

  return (
    <div className="w-screen h-screen">
      <Canvas />
      <Toolbar />
      <ZoomControls />
    </div>
  );
}
```

## Features

- **Infinite Canvas** - Pan and zoom with smooth interactions
- **Rich Text Editing** - Inline formatting (bold, strikethrough, links, font sizes)
- **Shapes** - Rectangle, circle, sticky notes, and 20+ flowchart shapes
- **Connectors** - Smart arrows with multiple path styles (straight, elbowed, curved)
- **Drawing** - Freehand pencil with pen, marker, and highlighter modes
- **Comments** - FigJam-style caption/comment system with threads
- **Keyboard Shortcuts** - Full shortcut support with customization
- **Undo/Redo** - Built-in history management
- **Auto-save** - localStorage persistence
- **Figma Import** - Import shapes from Figma files via REST API

## Components

### Core

| Component | Description |
|-----------|-------------|
| `Canvas` | Main infinite canvas with all interactions |
| `Toolbar` | Bottom toolbar with tool selection |
| `ZoomControls` | Zoom in/out controls |
| `Header` | Top header bar |

### Shapes

| Component | Description |
|-----------|-------------|
| `Shape` | Generic shape renderer — all variants incl. rectangle, circle, ellipse, flowchart shapes |
| `StickyNote` | Sticky note with rich text editing |
| `TextBox` | Freeform text box |
| `Connector` | Smart connector/arrow |
| `Line` | Freehand drawing line |
| `CanvasImage` | Image element |
| `Chart` | Bar / line / pie chart |
| `Table` | Table |
| `CodeBlock` | Syntax-highlighted code block |
| `Embed` | YouTube / Figma / Notion embed |
| `Rectangle` | **Deprecated** — use `Shape` with `shapeVariant="rectangle"` |

> There is no `Circle` component. Render a circle with
> `<Shape shapeVariant="circle" ... />`, or create one with
> `createShape(x, y, 'circle', settings)`.

### UI Components

| Component | Description |
|-----------|-------------|
| `TextOptionsBar` | Text formatting toolbar |
| `ShapeOptionsBar` | Shape styling toolbar |
| `ConnectorOptionsBar` | Connector styling toolbar |
| `ShapesPanel` | Extended shapes picker |
| `ContextMenu` | Right-click context menu |
| `CaptionPanel` | Comments panel |

## Figma Import

Import shapes from any Figma file directly into your canvas.

```tsx
import { FigmaImportModal } from 'pig-ma';

// Or use the programmatic API:
import {
  fetchFile,
  extractLeafNodes,
  figmaToPigma,
  parseFigmaFileUrl,
} from 'pig-ma';

const fileKey = parseFigmaFileUrl('https://www.figma.com/design/...');
const file = await fetchFile(fileKey, 'figd_your_token');
const nodes = extractLeafNodes(file.document);
const shapes = nodes.map(figmaToPigma).filter(Boolean);
```

Requires a Figma Personal Access Token with `file_content:read` scope.
Supported: Rectangle, Ellipse, Text, Sticky Note, Frame.

## Hooks

```tsx
import {
  useKeyboardShortcuts,
  useImageDrop,
  useHistoryStore,
  useShortcutsStore,
} from 'pig-ma';
```

| Hook | Description |
|------|-------------|
| `useKeyboardShortcuts()` | Enable keyboard shortcuts |
| `useImageDrop()` | Handle image drag & drop |
| `useHistoryStore` | Access save/load history |
| `useShortcutsStore` | Customize keyboard shortcuts |

## Store & State

```tsx
import {
  useCanvasStore,
  useObjects,
  useSelectedIds,
  useTool,
  useViewport,
  undo,
  redo,
} from 'pig-ma';
```

### Selectors

| Selector | Returns |
|----------|---------|
| `useObjects()` | All canvas objects |
| `useSelectedIds()` | Currently selected object IDs |
| `useTool()` | Current active tool |
| `useViewport()` | Viewport position and zoom |
| `usePenSettings()` | Pen/drawing settings |
| `useShapeSettings()` | Default shape settings |
| `useCaptions()` | All comment threads |

### Actions

```tsx
const store = useCanvasStore();

// Objects
store.addObject(object);
store.updateObject(id, updates);
store.deleteObjects([id1, id2]);   // note: plural — there is no deleteObject(id)
store.deleteSelected();

// Selection
store.setSelectedIds([id1, id2]);
store.clearSelection();

// Tools
store.setTool('select' | 'hand' | 'pencil' | 'shape' | ...);

// Viewport
store.setViewport({ x, y, zoom });

// History
undo();
redo();
```

## Factory Functions

Every factory returns a `CanvasObject`; hand it to `store.addObject()`.

```tsx
import { createStickyNote, createShape, createTextBox, useCanvasStore } from 'pig-ma';

const store = useCanvasStore.getState();

// Sticky note at (100, 100) — 3rd arg is a background colour, not an options object
store.addObject(createStickyNote(100, 100, '#FEF08A'));

// Any shape variant (rectangle, circle, ellipse, diamond, flowchart shapes, ...)
store.addObject(createShape(100, 300, 'circle', store.shapeSettings));

store.addObject(createTextBox(100, 500));
```

| Factory | Signature |
|---|---|
| `createShape` | `(x, y, variant: ShapeVariant, settings: ShapeSettings, author?)` |
| `createRectangle` | `(x, y, settings: ShapeSettings, author?)` — delegates to `createShape` |
| `createStickyNote` | `(x, y, backgroundColor?, author?)` |
| `createTextBox` | `(x, y, author?)` |
| `createLine` | `(x, y, points: number[], settings: PenSettings)` |
| `createImage` | `(x, y, src, width, height)` |
| `createConnector` | `(sourceId, targetId, sourceAnchor, targetAnchor)` |
| `createArrow` | `(startX, startY, endX, endY, options?)` |
| `createCodeBlock` · `createEmbed` · `cloneShape` | see `docs/API.md` |

> There is no `createCircle`. Use `createShape(x, y, 'circle', settings)`.

## Types

```tsx
import type {
  CanvasObject,
  Tool,
  ShapeVariant,
  TextSegment,
  CaptionThread,
  PenSettings,
  ShapeSettings,
} from 'pig-ma';
```

## Keyboard Shortcuts

Tool shortcuts are user-remappable through `useShortcutsStore` (defaults below).

| Key | Action |
|-----|--------|
| `V` | Select tool |
| `H` | Hand tool (pan) |
| `R` | Shape tool |
| `P` | Pencil tool |
| `E` | Eraser |
| `S` | Sticky note |
| `T` | Text box |
| `L` | Connector |
| `K` | Chart |
| `Delete` / `Backspace` | Delete selected |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |

Fixed (not remappable):

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + A` | Select all (skips locked objects) |
| `Cmd/Ctrl + C` / `+ V` | Copy / paste (paste accepts system clipboard images) |
| `Cmd/Ctrl + Shift + R` | Paste and replace |
| `Cmd/Ctrl + G` | Group selection |
| `[` / `]` | Send to back / bring to front |
| `Cmd/Ctrl + S` | Save |
| `Cmd/Ctrl + L` | Lock canvas (locked → only Hand tool is allowed) |
| `Cmd/Ctrl + /` | Toggle UI chrome |
| `Cmd/Ctrl + F` | Search (handled by `SearchPanel`) |
| `Arrow keys` | Move selected (1px) |
| `Shift + Arrow` | Move selected (10px) |
| `Escape` | Cancel current interaction |

### Host-app shortcuts

`C` (add caption) and `/` (cursor chat) are **not** handled inside the library.
`useKeyboardShortcuts` dispatches a window `CustomEvent` and the host app decides
what to do — see *Custom Events* below. The bundled demo (`src/App.tsx`) is the
reference implementation.

## Custom Events

The library talks to its host through window `CustomEvent`s rather than props, so
panels can live outside the canvas tree. Listen for the ones you want to support:

| Event | Dispatched when | Typical handler |
|---|---|---|
| `open-caption-input` | `C` pressed with a selection | Open the caption/comment composer |
| `toggle-mention-panel` | Mention panel toggled | Show/hide your mention panel (the demo's `MentionPanel` is app-side, not exported) |
| `open-export-panel` | Export requested | Show `ExportPanel` |
| `canvas-unlock-request` | `Cmd+L` on a locked canvas | Show `UnlockConfirmDialog` |
| `chart-edit-title` / `codeblock-edit-title` | Title double-clicked | Open the inline title editor |
| `alignment-guides-update` | During drag | Draw alignment guides |

```tsx
useEffect(() => {
  const onCaption = (e: Event) => openCaptionComposer((e as CustomEvent).detail);
  window.addEventListener('open-caption-input', onCaption);
  return () => window.removeEventListener('open-caption-input', onCaption);
}, []);
```

## Styling

The library uses Tailwind CSS. Import the bundled styles:

```tsx
import 'pig-ma/styles.css';
```

Or if you're using Tailwind in your project, you can extend your config to include pig-ma's source files for better tree-shaking.

## Development

This repo is both the published library and its demo app.

```bash
npm install
npm run dev          # demo app on port 3874
npm run dev -- --port 5000   # test server (Playwright specs expect this port)

npm run build        # demo app build
npm run build:lib    # library build (dist/) + type declarations
npm run lint
npm test             # vitest unit tests (471)
npm run test:watch

npx playwright test  # E2E specs in tests/
```

### Connector routing

Elbow connectors are routed from the **anchor normals**: the path leaves along the
source anchor's outward direction and arrives along the target anchor's, then the
two stubs are joined with an axis-aligned path. When the two anchors face away from
each other (target behind source), the path detours around both shapes instead of
cutting back across them.

Pass shape sizes so the detour clearance scales with the shapes — without them a
default 50px allowance is used, which is too small for tall or wide shapes:

```tsx
calculateElbowPath(start, end, bends, 'sharp', 8, sourceAnchor, targetAnchor, {
  sourceSize: { width: 100, height: 60 },
  targetSize: { width: 100, height: 60 },
});
```

`Connector` passes these automatically from `sourceObject` / `targetObject`.
Routing is covered by `src/utils/elbowPath.test.ts`, which asserts the path never
enters either shape's interior.

### Repo layout

| Path | Contents |
|---|---|
| `src/` | Library + demo source (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)) |
| `src/figma/` | Figma REST client, mapper, import/export |
| `figma-plugin/` | FigJam plugin (`manifest.json`, `code.js`, `ui.html`) for pasting exported JSON |
| `tests/` | Playwright E2E specs |
| `docs/` | ARCHITECTURE · API · TYPES · TOOLS |
| `plans/` | Design/refactor plans |

### Docs

| Document | Contents |
|---|---|
| [docs/README.md](docs/README.md) | Korean docs index / feature overview |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Flat object model, layer/viewport systems, drag coordinator, grid virtualization, performance notes (Korean) |
| [docs/API.md](docs/API.md) | Public API |
| [docs/TYPES.md](docs/TYPES.md) | Type reference |
| [docs/TOOLS.md](docs/TOOLS.md) | Tool behaviour |
| [CLAUDE.md](CLAUDE.md) | Working conventions |

### Test layout

| Suite | Covers |
|---|---|
| `src/utils/elbowPath.test.ts` | Connector routing — anchor normals, shape crossing, backtracking, segment axis classification |
| `src/utils/geometry.test.ts` | Bounds, anchors, rect predicates, viewport virtualization |
| `src/utils/alignment.test.ts` | Alignment guides, connector snap / dead zone |
| `src/utils/table.structure.test.ts` | Table row/column insert, delete, reorder — cell-key remapping invariants |
| `src/utils/table.test.ts` | Canvas ↔ editor cell content box parity |
| `src/store/core.test.ts` | Object CRUD, selection, canvas bounds growth, connector label cleanup |
| `src/store/table.test.ts` | Table slice — sizing sync, editing-cell reindexing, auto-fit row height |
| `src/utils/applyBends.test.ts` | Stored-bend path building — staircases, out-of-range coords, reversed layouts |
| `src/utils/factory.test.ts` | Object factories — valid bounds, id uniqueness, clone isolation |
| `src/utils/richText.test.ts` | Segment merge/split/toggle — text is never altered by styling |
| `src/store/clipboard.test.ts` | Copy/paste id remapping, connector + label rewiring, z-order, lock |
| `src/store/groups.test.ts` | Grouping, regrouping cleanup, ungroup, group move, metadata |
| `src/utils/migrateConnectorGeometry.test.ts` | Legacy connector geometry migration (v4→v5) |
| `src/figma/__tests__/mapper.test.ts` | Figma node mapping |

Store tests run in Node with a minimal `localStorage` stub (`src/test/setup.ts`) — no jsdom needed.
| [TODO-library-packaging.md](TODO-library-packaging.md) | Remaining work to publish as a package |
| `plans/` | [chart tools](plans/feat-chart-tools.md) · [canvas object data structure refactor](plans/refactor-canvas-object-data-structure.md) · [rendering optimization](plans/rendering-optimization.md) · [elbow connector refactor](docs/elbow-refactoring-plan.md) |

## Peer Dependencies

- React 18+ or 19+
- React DOM 18+ or 19+

## License

MIT
