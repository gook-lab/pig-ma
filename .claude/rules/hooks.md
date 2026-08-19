# Custom Hook Rules

> Applies to: `src/hooks/**/*.ts`

## Naming

All hooks start with `use`:
- `useKeyboardShortcuts`
- `useAutoSave`
- `useVisibleObjects`

## Structure

```typescript
import { useState, useCallback, useEffect } from "react";

export function useMyHook(options: Options) {
  // 1. State
  const [state, setState] = useState(initialValue);

  // 2. Callbacks (memoized)
  const handler = useCallback(() => {
    // ...
  }, [dependencies]);

  // 3. Effects
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    };
  }, [dependencies]);

  // 4. Return
  return { state, handler };
}
```

## Return Types

Prefer object return for multiple values:

```typescript
// Good
return { objects, isLoading, error };

// Avoid for >2 values
return [objects, isLoading, error];
```

## Zustand Selectors

Create selector hooks for store access:

```typescript
// store/index.ts
export const useObjects = () => useCanvasStore((s) => s.objects);
export const useSelectedIds = () => useCanvasStore((s) => s.selectedIds);
```

## Existing Hooks

| Hook | Purpose |
|------|---------|
| `useKeyboardShortcuts` | Global keyboard handling |
| `useAutoSave` | localStorage persistence |
| `useVisibleObjects` | Viewport virtualization |
| `useDragCoordinator` | Multi-object drag |
| `useCustomColors` | Color picker state |
| `useMention` | textarea @멘션 드롭다운 (댓글/답글용) |
