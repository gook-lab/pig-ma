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
    └── mapper.test.ts  # vitest 유닛 테스트 (50개)
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

### 폰트 width 버퍼

Figma 폰트(특히 Figma Hand)는 pig-ma 기본 폰트보다 좁음:
- `textAutoResize: "WIDTH_AND_HEIGHT"` → 50% 버퍼
- Figma 전용 폰트 → 50% 버퍼
- 기타 → 20% 버퍼

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
