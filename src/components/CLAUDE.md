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

## 하위 폴더

| 폴더 | 설명 |
|------|------|
| `shapes/` | Konva 기반 Shape 컴포넌트 |
| `captions/` | 캡션/댓글 시스템 |
| `tiptap/` | 리치 텍스트 에디터 (Tiptap 기반) |
| `options-bars/` | 플로팅 옵션바 컴포넌트 |

## Canvas Layer 구조

```
1. Grid Layer      - 배경 그리드 (listening=false)
2. Objects Layer   - shapes, images, sticky notes
3. Connectors Layer - 화살표/연결선
4. Drawing Layer   - 펜슬, 미리보기, 선택 영역
```
