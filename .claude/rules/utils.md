# Utility Function Rules

> Applies to: `src/utils/**/*.ts`

## Naming

- Pure functions: verb + noun (`calculateBounds`, `createShape`)
- Type guards: `is` + type (`isConnector`, `hasTextContent`)
- Factory: `create` + type (`createRectangle`, `createStickyNote`)

## Pure Functions

All utilities should be pure (no side effects):

```typescript
// Good
export function calculateBounds(obj: CanvasObject): Bounds {
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
}

// Bad - modifies input
export function updateBounds(obj: CanvasObject): void {
  obj.x = 0; // Side effect!
}
```

## File Organization

| File | Purpose |
|------|---------|
| `factory.ts` | Object creation |
| `geometry.ts` | Bounds, intersection, alignment |
| `optionsBar.ts` | Options bar positioning |
| `elbowPath.ts` | Elbow connector paths |
| `richText.ts` | Text segment manipulation |
| `typeGuards.ts` | TypeScript narrowing |
| `chart.ts` | Chart utilities |
| `embed.ts` | Embed URL parsing (YouTube, Figma, Notion) |

## Export Pattern

Export from utils, re-export from `index.ts`:

```typescript
// utils/geometry.ts
export function calculateBounds(...) { ... }

// index.ts
export { calculateBounds } from "./utils/geometry";
```
