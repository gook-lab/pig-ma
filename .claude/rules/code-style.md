# Code Style Rules

## Formatting

**Prettier** with Tailwind plugin handles all formatting:

```bash
./scripts/convert-format-code.sh  # Run after changes
```

## TypeScript

- Use `type` for object shapes, `interface` for extendable contracts
- Prefer `unknown` over `any`
- Use type guards for narrowing (`isShape()`, `isConnector()`)
- Export types from `types.ts`, not inline

## Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `ShapeOptionsBar` |
| Hook | camelCase with `use` | `useKeyboardShortcuts` |
| Utility | camelCase | `calculateBounds` |
| Constant | SCREAMING_SNAKE | `GRID_SIZE` |
| Type/Interface | PascalCase | `CanvasObject` |

## Imports

Order (enforced by Prettier):
1. React/external libraries
2. `@/` aliased imports
3. Relative imports
4. CSS imports

```typescript
import { memo } from "react";
import { Group, Rect } from "react-konva";
import { useCanvasStore } from "@/store";
import { calculateBounds } from "./utils";
import "./styles.css";
```

## Comments

- JSDoc for exported functions/types
- Inline comments for non-obvious logic only
- Korean comments allowed for implementation notes
