# Utils

순수 유틸리티 함수 모음.

## 파일 목록

| 파일 | 설명 |
|------|------|
| `factory.ts` | CanvasObject 생성 함수 (createRectangle/createCircle/createShape 등) |
| `geometry.ts` | 기하학 계산 (바운딩 박스, 교차 검사, 스냅/정렬 가이드) |
| `optionsBar.ts` | 옵션바 위치 계산 |
| `elbowPath.ts` | 엘보우 커넥터 경로 계산 + 핸들 분류 (Y/X-정체 + 공선 런 병합) |
| `elbowHandlers.ts` | 엘보우 드래그 조정 헬퍼 — 미리보기/커밋이 반드시 공유 |
| `connectorPath.ts` | 커넥터 경로 소비자 단일 소스 (endpoints/path points) |
| `translateElbowBends.ts` | bend 절대좌표 강체 이동 — 델타 이동 경로 전부가 사용 |
| `align.ts` | 정렬/분배 순수 계산 (커넥터는 elbowBends 도 강체 이동) |
| `pigmaFile.ts` | .pigma 프로젝트 파일 저장/열기/검증/백업 |
| `chart.ts` | 차트 데이터/포맷 헬퍼 (formatChartValue, getLabelStep 등) |
| `richText.ts` | 리치 텍스트 파싱/렌더링 (measureTextWidth 는 DOM 없으면 추정 폴백) |
| `toast.ts` | react-hot-toast 래퍼 — alert 대신 공용 진입점 |
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
