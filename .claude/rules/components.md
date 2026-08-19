# Component Rules

> Applies to: `src/components/**/*.tsx`

## Structure

```typescript
import { memo } from "react";
import type { ComponentProps } from "@/types";

interface MyComponentProps {
  // Props interface first
}

export const MyComponent = memo(function MyComponent({
  prop1,
  prop2,
}: MyComponentProps) {
  // 1. Hooks
  // 2. Derived state
  // 3. Handlers
  // 4. Render
  return <div>...</div>;
});
```

## Memoization

- Use `memo()` for all components that receive props
- Use `useMemo()` for expensive computations
- Use `useCallback()` for handlers passed to children

## Konva Components

Konva shape components follow this pattern:

```typescript
export const ShapeName = memo(function ShapeName({
  shape,
  isSelected,
  onSelect,
  onDragEnd,
  onUpdate,
}: ShapeProps) {
  // ...
});
```

## Options Bars

Options bar components:
- Positioned above selected element
- Use `calculateOptionsBarPosition()` utility
- All labels in English (see ui-text.md)

## File Organization

| Type | Location |
|------|----------|
| Main canvas | `Canvas.tsx` |
| Toolbar | `Toolbar.tsx` |
| Shapes | `shapes/*.tsx` |
| Captions | `captions/*.tsx` |
| Rich text | `tiptap/*.tsx` |
| Options bars | `*OptionsBar.tsx` |
| Panels | `*Panel.tsx` |
