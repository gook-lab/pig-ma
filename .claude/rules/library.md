# Library Build Rules

## Package Structure

```
pig-ma/
├── dist/
│   ├── pig-ma.js      # ESM bundle
│   ├── pig-ma.cjs     # CommonJS bundle
│   ├── index.d.ts     # TypeScript declarations
│   └── styles.css     # Compiled CSS
├── src/
│   └── index.ts       # Public API exports
└── package.json
```

## Export Guidelines

### What to Export

- **Components**: Canvas, Toolbar, Shape components, Options bars
- **Hooks**: Custom hooks that consumers need
- **Types**: All public TypeScript interfaces/types
- **Utilities**: Factory functions, geometry helpers
- **Constants**: z-index values, zoom levels

### What NOT to Export

- Internal implementation details
- Development-only components (App.tsx, main.tsx)
- Test utilities
- Internal state slices (unless needed for advanced use)

## Adding New Exports

1. Add export to `src/index.ts` under appropriate section
2. Add JSDoc comment if complex
3. Run `npm run build:lib` to verify
4. Update this doc if adding new category

## Peer Dependencies

React and React-DOM are peer dependencies:
```json
"peerDependencies": {
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0"
}
```

## Build Commands

```bash
npm run build:lib    # Production library build
npm run build:types  # Generate .d.ts files only
```
