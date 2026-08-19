# Utils

순수 유틸리티 함수 모음.

## 파일 목록

| 파일 | 설명 |
|------|------|
| `factory.ts` | CanvasObject 생성 함수 |
| `geometry.ts` | 기하학 계산 (바운딩 박스, 교차 검사) |
| `optionsBar.ts` | 옵션바 위치 계산 |
| `elbowPath.ts` | 엘보우 커넥터 경로 계산 |
| `richText.ts` | 리치 텍스트 파싱/렌더링 |
| `embed.ts` | 임베드 URL 파싱 (YouTube, Figma, Notion) |

## 주요 상수

```typescript
// factory.ts
GRID_SIZE = 10  // 그리드 스냅 단위

// geometry.ts
SNAP_THRESHOLD = 30  // 도형 자동 연결 거리 (px)
```

## 특징

- 모든 함수는 순수 함수 (side effect 없음)
- 입력값 변경 금지 (immutable)
