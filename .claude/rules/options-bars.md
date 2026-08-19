# Options Bar Rules

> Applies to: `*OptionsBar.tsx`, `*Editor.tsx` (options bar sections)

## Overview

Options bars are floating toolbars that appear above selected objects. They provide context-specific editing controls.

## File Structure

| File | Target ObjectType | Description |
|------|-------------------|-------------|
| `TextOptionsBar.tsx` | stickyNote, textBox, shape | Rich text formatting |
| `ShapeOptionsBar.tsx` | shape, rectangle | Fill, stroke, shape type |
| `ConnectorOptionsBar.tsx` | connector | Path style, markers |
| `LineOptionsBar.tsx` | line | Pen stroke, color |
| `ChartOptionsBar.tsx` | chart | Chart type, data |
| `GroupOptionsBar.tsx` | group | Section name, lock |
| `ConnectorLabelOptionsBar.tsx` | connectorLabel | Label text |

## Required Patterns

### 1. Container Structure

```tsx
<div
  className="fixed"
  style={{
    left: position.x,
    top: position.y,
    zIndex: Z_OPTIONS_BAR,
  }}
  onMouseDown={(e) => e.preventDefault()}  // Prevent canvas deselect
  onKeyDown={(e) => e.stopPropagation()}   // Prevent shortcut propagation
>
  {/* Bar content */}
</div>
```

### 2. Position Calculation

Use `calculateOptionsBarPosition` from `utils/optionsBar.ts`:

```tsx
const position = calculateOptionsBarPosition({
  element: {
    x: selectedObject.x,
    y: selectedObject.y,
    width: selectedObject.width ?? 100,
    height: selectedObject.height ?? 100,
  },
  viewport,
  barHeight: OPTIONS_BAR_HEIGHT,  // 50
  barWidth: 400,  // Estimated width
});
```

### 3. Bar Container Styling

```tsx
// Main bar container
<div className="flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
  {/* Buttons and controls */}
</div>
```

### 4. Button Patterns

```tsx
// Standard button
<button
  onClick={handleClick}
  className="rounded p-2 transition-all hover:bg-gray-700"
  title="Button label"
>
  <Icon className="h-4 w-4 text-white" />
</button>

// Active/selected button
<button
  className={cn(
    "rounded p-2 transition-all",
    isActive ? "bg-violet-600 hover:bg-violet-700" : "hover:bg-gray-700"
  )}
>
  <Icon className="h-4 w-4 text-white" />
</button>

// Danger button (delete, etc.)
<button className="rounded bg-red-600 p-2 transition-all hover:bg-red-700">
  <Trash2 className="h-4 w-4 text-white" />
</button>

// Lock/Unlock toggle
<button
  onClick={() => updateObject(id, { locked: !obj.locked })}
  className={cn(
    "rounded p-1.5 transition-all hover:bg-gray-700",
    obj.locked && "bg-red-600 hover:bg-red-700"
  )}
>
  {obj.locked ? <Lock size={14} /> : <Unlock size={14} />}
</button>
```

### 5. Dropdown Menus

```tsx
// Dropdown trigger with position awareness
const [showDropdown, setShowDropdown] = useState(false);

// Check if dropdown should open upward
const dropdownAbove = position.above;

// Dropdown container
{showDropdown && (
  <div
    className={cn(
      "absolute left-0 rounded-lg bg-gray-800 p-3 shadow-lg",
      dropdownAbove ? "bottom-full mb-2" : "top-full mt-2"
    )}
    style={{ zIndex: Z_OPTIONS_BAR + 1 }}
  >
    {/* Dropdown content */}
  </div>
)}
```

### 6. Dividers

```tsx
// Vertical divider between button groups
<div className="mx-1 h-6 w-px bg-gray-600" />
```

### 7. Selection Filtering

```tsx
const selectedObject = useMemo(() => {
  if (selectedIds.length !== 1) return null;
  const obj = objects.find((o) => o.id === selectedIds[0]);
  if (!obj || obj.type !== "targetType") return null;
  return obj;
}, [objects, selectedIds]);

// Early return conditions
if (!selectedObject) return null;
if (selectedObject.locked) return null;  // Or show lock indicator
if (isLocked) return null;  // Canvas locked
```

### 8. Color Picker Integration

```tsx
// Color button with popup
<ColorPickerPopup
  color={currentColor}
  onChange={(color) => updateObject(id, { fill: color })}
  customColors={customColors}
  onAddCustomColor={addCustomColor}
>
  <button className="rounded p-2 hover:bg-gray-700">
    <div
      className="h-4 w-4 rounded border border-gray-500"
      style={{ backgroundColor: currentColor }}
    />
  </button>
</ColorPickerPopup>
```

## Common Controls

### Font Size Dropdown

```tsx
const FONT_SIZES = ["S", "M", "L", "XL"] as const;
const FONT_SIZE_MAP = { S: 14, M: 16, L: 20, XL: 28 };
```

### Stroke Width Slider

```tsx
<Slider
  value={[strokeWidth]}
  onValueChange={([v]) => updateObject(id, { strokeWidth: v })}
  min={1}
  max={20}
  step={1}
/>
```

### Text Formatting Buttons

```tsx
// Bold, Italic, Underline, Strikethrough
const TEXT_FORMAT_BUTTONS = [
  { icon: Bold, format: "bold", key: "fontWeight", value: "bold" },
  { icon: Italic, format: "italic", key: "fontStyle", value: "italic" },
  { icon: Underline, format: "underline", key: "textDecoration", value: "underline" },
  { icon: Strikethrough, format: "line-through", key: "textDecoration", value: "line-through" },
];
```

## z-index Reference

| Element | z-index |
|---------|---------|
| Options bar | `Z_OPTIONS_BAR` (200) |
| Dropdown menu | `Z_OPTIONS_BAR + 1` (201) |
| Color picker | `Z_OPTIONS_BAR + 10` |
| Text input overlay | `Z_TEXT_INPUT` (9999) |

## Best Practices

1. **Always prevent event propagation** - Options bar interactions should not affect canvas
2. **Use `position.above`** for dropdown direction when near screen bottom
3. **Show lock indicator** instead of hiding bar when object is locked
4. **Use consistent icon sizes** - 14-16px (`h-4 w-4`) for options bar buttons
5. **Add tooltips** via `title` attribute for accessibility
6. **Use `cn()` helper** for conditional classes
