# UI Text Rules

> Applies to: `*OptionsBar.tsx`, `*Panel.tsx`, `*Editor.tsx`

## Language

**All UI text must be in English.** This ensures:
- Consistency across the codebase
- Easier internationalization (i18n) in the future
- Professional appearance for library consumers

## Examples

| Component | Good | Bad |
|-----------|------|-----|
| Button label | "Add Shape" | "도형 추가" |
| Tooltip | "Click to select" | "선택하려면 클릭" |
| Placeholder | "Enter text..." | "텍스트 입력..." |
| Error message | "Failed to load" | "로드 실패" |

## Formatting

- Use sentence case for labels: "Add new item" not "Add New Item"
- Keep labels concise (2-4 words)
- Avoid abbreviations unless standard (e.g., "px", "deg")

## Accessibility

- Provide `aria-label` for icon-only buttons
- Use meaningful `title` attributes for tooltips
