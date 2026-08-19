# Figma Integration Rules

> Applies to: `src/figma/**/*.ts`

## 모듈 구조

```
src/figma/
├── types.ts      # FigmaNode, PigmaShape, 에러 클래스
├── mapper.ts     # 변환 함수 (figmaToPigma, pigmaToFigma, importFigmaDocument)
├── client.ts     # REST API 클라이언트
├── export.ts     # pig-ma → Figma 내보내기 (SVG, JSON, clipboard)
├── index.ts      # barrel export
└── __tests__/
    └── mapper.test.ts  # vitest 유닛 테스트 (63개)
```

## 매핑 규칙

### IMAGE fill 우선

모든 노드 타입에서 IMAGE fill을 먼저 체크. IMAGE fill이 있으면 `image` 타입으로 변환:
- `imageTransform`이 있으면 (크롭된 이미지) → `node:nodeId`로 render API 사용
- 없으면 → `imageRef`로 CDN URL 사용

### TEXT fills = 텍스트 색상

Figma TEXT 노드의 `fills`는 배경색이 아니라 **텍스트 색상**.
`shape.fill`이 아닌 `shape.textColor`에 매핑.

### VECTOR (프리핸드 드로잉)

`strokeGeometry`는 stroke의 **아웃라인**(닫힌 외곽선)이지 중심선이 아님.
`fillGeometry`가 있으면 line으로 변환, 없으면 `node:nodeId`로 render API(PNG).

### CONNECTOR pathStyle

```typescript
connectorLineType === "CURVED"  → pathStyle: "curved"
connectorLineType === "ELBOWED" → pathStyle: "elbowed"
default                         → pathStyle: "straight"
```

### FRAME (clipsContent)

자식이 있는 FRAME은 빈 사각형으로 만들지 않는다 — 크롭된 콘텐츠가
사라진다. `node:nodeId` render API 래스터화로 변환 (크롭이 서버 렌더링에
반영됨). 자식 없는 FRAME만 rectangle.

### 폰트 매핑 / TEXT 폭 (2026-08 개편)

- `mapFigmaFontFamily`: pig-ma FontFamily 유니온에 있는 폰트만 통과
  (대소문자 정규화), 손글씨 계열(Figma Hand/Virgil 등) → Nanum Gothic,
  그 외 → undefined(기본 폰트). **임의 폰트명 캐스팅 금지.**
- TEXT 폭: 상수 버퍼(1.2/1.5×) 대신 pig-ma 렌더 폰트로 가장 긴 줄을
  `measureTextWidth`로 실측 (DOM 없으면 추정 폴백).
  고정 박스(`textAutoResize: "NONE"`)는 bbox 폭 그대로 존중.

### 리치텍스트 (characterStyleOverrides ↔ Tiptap)

- import: 오버라이드 id 런 → TextSegment → `textSegmentsToTiptap`
  (bold/strike/fontSize/색). 오버라이드가 전부 0이면 tiptapContent 생성 안 함.
- export: `tiptapToFigmaOverrides` — 동일 스타일은 dedupe 된 id 테이블 재사용.
- **인덱싱은 코드포인트 단위** (`[...characters]`, `for..of`) — UTF-16
  코드유닛으로 세면 이모지/서로게이트 페어에서 스타일 경계가 어긋난다.

## Import 흐름

1. `fetchFile(fileKey, token)` — `?geometry=paths` 포함
2. `importFigmaDocument(file.document)` — shapes + groups 반환
3. 이미지 해결: `fetchImageUrls()` + `renderNodes()` (크롭/프리핸드)
4. 스케일 적용 (IMPORT_SCALE = 0.75)
5. 뷰포트 중앙 배치 (bounding box 중심 → 화면 중앙)
6. objects 추가 + groups 추가 (customBounds + offset)

## 테스트

```bash
npx vitest run src/figma/__tests__/mapper.test.ts
```

새 매핑 추가 시 반드시 테스트 추가:
- `figmaToPigma` 변환 테스트
- 라운드트립 테스트 (figmaToPigma → pigmaToFigma)
- `extractLeafNodes` / `importFigmaDocument` 트리 탐색 테스트
