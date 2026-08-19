# Styling Rules

## z-index Management

All z-index values defined in `constants/zIndex.ts`. **Never use arbitrary z-index values.**

```typescript
import { Z_OPTIONS_BAR, Z_MODAL_CONTENT, getCanvasOverlayZIndex } from "@/constants/zIndex";
```

### Layer Hierarchy (low to high)

| z-index | Constant | Usage |
|---------|----------|-------|
| 10-39 | `Z_CANVAS_OVERLAY_BASE` | Canvas overlays (TextViewer, CodeBlock) |
| 40 | `Z_SIDE_PANEL` | Side panels (Shapes, History) |
| 50 | `Z_TOOLBAR`, `Z_FLOATING_UTILITY` | Toolbar, ZoomControls, FloatingUtilityBar |
| 60-61 | `Z_LOCK_OVERLAY` | Lock overlay, badge |
| 90 | `Z_CAPTION_PANEL` | Caption panel |
| 100 | `Z_HEADER` | Header, share button |
| 150-161 | `Z_CAPTION_POPUP` | Caption popup, emoji picker |
| 200 | `Z_OPTIONS_BAR`, `Z_CONTEXT_MENU` | Options bars, context menus |
| 200-201 | `Z_MODAL_*` | Modal backdrop/content |
| 9999 | `Z_TEXT_INPUT` | Text input overlays (always top) |

### Canvas Overlays

Canvas overlays are capped at z-39 to stay below floating UI:

```typescript
// Returns value between 10-39
const zIndex = getCanvasOverlayZIndex(objectIndex);
```

### Tailwind z-index Classes

| Class | Use Case |
|-------|----------|
| `z-40` | Side panels (deprecated, use z-50) |
| `z-50` | Floating UI (toolbar, utility bar, shortcut panel) |
| `z-[200]` | Options bars (when not using constant) |

## TailwindCSS

### Spacing

- Use Tailwind spacing scale: `p-2`, `m-4`, `gap-3`
- Avoid arbitrary values unless necessary
- Common gaps: `gap-1` (4px), `gap-2` (8px), `gap-3` (12px)

### Colors

- UI components: `bg-gray-800`, `text-white` (dark theme)
- Hover states: `hover:bg-gray-700`
- Active/selected: `bg-violet-600`, `bg-blue-500`
- Borders: `border-gray-600`, `border-gray-200`

### Common Component Patterns

```tsx
// Dark floating bar
"rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg"

// Button (dark theme)
"rounded p-2 transition-all hover:bg-gray-700"

// Active button
"rounded bg-violet-600 p-2 hover:bg-violet-700"

// Danger button
"rounded bg-red-600 p-2 hover:bg-red-700"

// Input (dark theme)
"rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white outline-none focus:border-violet-500"

// Dropdown
"rounded-lg bg-gray-800 p-3 shadow-lg"
```

### Responsive

```typescript
// Mobile-first
<div className="flex-col md:flex-row">
```

## Konva Styling

- Position via props, not CSS
- Colors as hex strings
- Stroke widths in pixels

```typescript
<Rect
  x={10}
  y={20}
  fill="#3b82f6"
  stroke="#1d4ed8"
  strokeWidth={2}
/>
```

## Icon Sizes

| Context | Size | Class |
|---------|------|-------|
| Options bar button | 14-16px | `h-4 w-4` |
| Toolbar button | 20-24px | `h-5 w-5` |
| Header button | 20px | `h-5 w-5` |
