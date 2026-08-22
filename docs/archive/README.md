# 아카이브

**구현이 끝난 계획서·브레인스톰.** 기록으로만 남긴다 — 여기 적힌 설계는 당시의
것이고, 현재 코드와 어긋날 수 있다. **현재 동작을 알고 싶으면 코드나
`docs/ARCHITECTURE.md` 를 봐라.**

정리 시점: 2026-08-22. 아래 항목은 전부 코드에 실제로 존재하는 것을 확인하고 옮겼다.

| 계획서 | 결과물 |
|---|---|
| `2026-02-16-feat-caption-comment-system-plan` | `src/components/captions/` |
| `2026-02-18-refactor-tiptap-rich-text-editor-plan` | `src/components/tiptap/` |
| `2026-02-19-feat-powerpoint-style-multi-select-plan` | `MultiSelectEditor.tsx` |
| `2026-02-23-feat-elbow-connector-midpoint-handles-plan` | `utils/connectorPath.ts` |
| `2026-03-02-feat-canvas-table-insert-plan` | `shapes/Table.tsx` · `constants/table.ts` |
| `2026-03-24-feat-keyboard-shortcut-customization-panel-plan` | `ShortcutPanel.tsx` |
| `2026-03-26-003-refactor-canvas-performance-optimization-plan` | `useVisibleObjects` · `ShapeRenderer` 격리 |
| `2026-03-26-feat-embed-youtube-figma-plan` | `utils/embed.ts` · Embed 도형 |
| `2026-03-26-embed-feature-brainstorm` | ↑ 위 계획의 발단 |
| `2026-03-26-feat-template-gallery-enhancement-plan` | `TemplatesPanel.tsx` |
| `2026-04-01-001-refactor-constants-zod-validation-plan` | `src/constants/` · `src/schemas/` |
| `2026-04-30-001-feat-npm-publish-v010-plan` | npm `pig-ma` |
| `2026-xx-refactor-elbow-connector-plan` | `utils/connectorPath.ts` · `elbowBends` |
| `2026-xx-feat-chart-tools-plan` | `shapes/Chart.tsx` (bar/line/pie 5스타일) |
| `2026-xx-refactor-rendering-optimization-plan` | 커넥터 좁은 구독 · `dragCoordinator` |
| `2026-08-library-packaging-todo` | peerDeps 외부화 · `preserveModules` 빌드 |

> `2026-xx-` 접두사는 원본 파일에 날짜가 없어 시기를 특정하지 못한 것들이다.
