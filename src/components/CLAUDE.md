# Components

UI 컴포넌트 모음.

## 주요 파일

| 파일 | 설명 |
|------|------|
| `Canvas.tsx` | 메인 캔버스 (Konva Stage, Layer 관리) |
| `Toolbar.tsx` | 하단 도구 모음 |
| `ZoomControls.tsx` | 줌 컨트롤 (우측 하단) |
| `Minimap.tsx` | 미니맵 |
| `FloatingUtilityBar.tsx` | 유틸리티 버튼 (키보드, 히스토리) |
| `ShapeRenderer.tsx` | Shape 렌더링 래퍼 (memo 격리, getState 콜백) |
| `FileMenu.tsx` | File 드롭다운 (.pigma 저장/열기, Excalidraw/Mermaid import·export) |
| `LockedObjectsPanel.tsx` | 잠금 객체 칩+패널 (좌하단, 개별/전체 해제 + 팬 이동) |
| `MultiSelectEditor.tsx` | 다중 선택(2+) 정렬/분배 옵션바 마운트 |
| `EmbedViewerOverlay.tsx` | 임베드 재생 오버레이 (유튜브는 16:9 fit — 여백 클릭 시 선택) |

## 하위 폴더

| 폴더 | 설명 |
|------|------|
| `shapes/` | Konva 기반 Shape 컴포넌트 |
| `captions/` | 캡션/댓글 시스템 |
| `tiptap/` | 리치 텍스트 에디터 (Tiptap 기반) |
| `options-bars/` | 플로팅 옵션바 컴포넌트 |

## Canvas Layer 구조

```
1. Grid Layer        - 배경 그리드 (listening=false)
2. Objects Layer     - shapes, images, sticky notes
3. Selection UI Layer - Transformer 핸들 + 잠금 배지
4. Connectors Layer  - 화살표/연결선
5. Drawing Layer     - 펜슬, 미리보기, 선택 영역
```

**Selection UI Layer**: 선택 상호작용 UI는 항상 최상단에 보여야 한다.
마운트 시 이 레이어의 캔버스 엘리먼트만 CSS `z-index: Z_SELECTION_UI(40)` +
`pointer-events: none`으로 승격 — HTML 뷰어 오버레이(CodeBlock/Embed,
z≤39)도 가리지 못한다 (paint 전용 승격, 이벤트 흐름은 불변).
