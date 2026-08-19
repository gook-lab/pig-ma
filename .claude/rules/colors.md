# Color Rules

## UI Colors (Dark Theme)

Options bars, dropdowns, and floating UI use dark theme consistently.

### Backgrounds

| Color | Hex | Usage |
|-------|-----|-------|
| `bg-gray-800` | #1f2937 | Primary background (bars, dropdowns) |
| `bg-gray-700` | #374151 | Hover state, inputs |
| `bg-gray-900` | #111827 | Deeper background |

### Text

| Color | Hex | Usage |
|-------|-----|-------|
| `text-white` | #ffffff | Primary text |
| `text-gray-400` | #9ca3af | Secondary/muted text |
| `text-gray-500` | #6b7280 | Disabled text |

### Borders

| Color | Hex | Usage |
|-------|-----|-------|
| `border-gray-600` | #4b5563 | Input borders |
| `border-gray-500` | #6b7280 | Color swatch borders |
| `border-gray-200` | #e5e7eb | Light theme borders |

### Accent Colors

| Color | Hex | Usage |
|-------|-----|-------|
| `bg-violet-600` | #7c3aed | Active/selected state |
| `bg-violet-700` | #6d28d9 | Active hover |
| `bg-blue-500` | #3b82f6 | Primary action |
| `bg-blue-600` | #2563eb | Primary hover |
| `bg-red-600` | #dc2626 | Danger/delete |
| `bg-red-700` | #b91c1c | Danger hover |

### Focus States

```tsx
"focus:ring-2 focus:ring-violet-500 focus:outline-none"
"focus:border-violet-500"
```

## Shape Colors

### Sticky Note Backgrounds

```typescript
const STICKY_COLORS = [
  "#fef08a", // yellow (default)
  "#fecaca", // red
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#e9d5ff", // purple
  "#fed7aa", // orange
];
```

### Default Shape Colors

| Property | Default | Description |
|----------|---------|-------------|
| `fill` | #3b82f6 | Blue fill |
| `stroke` | #1e3a5f | Dark blue stroke |
| `strokeWidth` | 2 | Default stroke width |

### CodeBlock Theme Colors

```typescript
// Dark theme
backgroundColor: "#383838"
textColor: "#d4d4d4"
headerColor: "#2d2d2d"

// Light theme
backgroundColor: "#ffffff"
textColor: "#1e1e1e"
headerColor: "#f3f4f6"
```

## Chart Colors

Defined in `constants/colors.ts`:

```typescript
export const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];
```

## Language Badge Colors

```typescript
const LANGUAGE_COLORS: Record<string, string> = {
  javascript: "#f7df1e",
  typescript: "#3178c6",
  python: "#3776ab",
  java: "#b07219",
  go: "#00add8",
  rust: "#dea584",
  ruby: "#cc342d",
  php: "#777bb4",
  swift: "#fa7343",
  kotlin: "#a97bff",
  html: "#e34c26",
  css: "#264de4",
  json: "#292929",
  yaml: "#cb171e",
  sql: "#e38c00",
  bash: "#4eaa25",
  default: "#6b7280",
};
```

## Connector Colors

```typescript
// Default connector
stroke: "#374151"  // gray-700
strokeWidth: 2

// Selection handles
fill: "#3b82f6"  // blue-500
```

## Color Picker Presets

```typescript
const PRESET_COLORS = [
  // Row 1: Primary colors
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e",
  // Row 2: Neutral colors
  "#000000", "#374151", "#6b7280", "#9ca3af", "#d1d5db",
  "#e5e7eb", "#f3f4f6", "#ffffff",
];
```

## Usage Guidelines

1. **Consistency** - Use Tailwind classes when possible
2. **Custom colors** - Define in `constants/colors.ts`
3. **Dynamic colors** - Use `style={{ backgroundColor: color }}`
4. **Accessibility** - Ensure sufficient contrast (4.5:1 for text)
5. **Dark theme** - Options bars always use dark theme regardless of canvas
