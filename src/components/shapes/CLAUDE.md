# Shape Components

Konva 기반 캔버스 도형 컴포넌트.

## 파일 목록

| 파일 | 설명 | ObjectType |
|------|------|------------|
| `Rectangle.tsx` | 사각형 | `rectangle` |
| `Circle.tsx` | 원 | `circle` |
| `Shape.tsx` | 확장 도형 (triangle, diamond 등) | `shape` |
| `StickyNote.tsx` | 메모지 | `stickyNote` |
| `TextBox.tsx` | 자유 텍스트 | `textBox` |
| `Line.tsx` | 펜슬 드로잉 | `line` |
| `Connector.tsx` | 연결선/화살표 (1:1) | `connector` |
| `BranchConnector.tsx` | 분기 커넥터 — 줄기 1개 + 갈래 N개 (마인드맵식) | `connector` (`targetIds` 있음) |
| `ConnectorLabel.tsx` | 커넥터 텍스트 라벨 | `connectorLabel` |
| `CanvasImage.tsx` | 이미지 | `image` |
| `Chart.tsx` | 차트 (bar/line/pie) | `chart` |
| `Embed.tsx` | 외부 콘텐츠 임베드 (YouTube/Figma/Notion) | `embed` |
| `ConnectionHandles.tsx` | 연결 포인트 (4방향) | - |

## Shape.tsx 지원 Variants

**Basic:** rectangle, roundedRect, circle, ellipse, triangle, diamond, pentagon, hexagon, octagon, star, star4, cross, arrows, chevrons, speechBubble

**Flowchart:** process, decision, terminal, data, document, database, predefined, manualInput, preparation, delay, or, summing

## Connector 특이사항

### 모드 구분

| 모드 | 조건 | 특징 |
|------|------|------|
| **Attached** | `sourceId` 또는 `targetId` 존재 | shape와 연결, shape 드래그 시 자동 추적 |
| **Standalone** | `sourceId`, `targetId` 모두 없음 | 독립적인 선 객체, 직접 드래그 가능 |
| **Branch** | `targetIds` 존재 | 줄기를 한 번만 그리고 분기점에서 갈래가 뻗는다. `BranchConnector.tsx` 가 렌더 (Connector.tsx 는 타지 않음) |

### 분기 커넥터 (2026-08-25)

한 소스에서 여러 타깃으로 갈 때 1:1 커넥터를 N개 얹으면 줄기 구간이 겹쳐
그려지고 갈라지는 자리에 갈고리가 생긴다. `targetIds` 가 있으면
`ConnectorShapeRenderer` 가 `BranchConnector` 로 분기한다.

| 필드 | 뜻 |
|------|-----|
| `targetIds` | 갈래 타깃 id 목록 (있으면 분기 모드) |
| `junctionT` | 소스→가장 가까운 타깃 사이 분기점 위치 (0~1, 기본 0.5) |
| `branchLabels` | 타깃 id → 갈래 라벨 |

- 경로는 `utils/branchPath.ts` (순수). 갈래는 **버스 → 드롭** 2구간이고
  범용 엘보우 라우터를 쓰지 않는다 — 그쪽은 타깃 박스를 피해 돌아서
  분기점이 가까우면 크게 우회한다 (실측: 80px 간격에서 260px 밖으로).
- ⚠️ 갈래 타깃 구독은 **원시값 키**로 한다. 셀렉터가 배열을 만들어 돌려주면
  매 렌더 새 참조라 무한 루프가 난다 ("getSnapshot should be cached").
- 편집 UX(+ 핸들로 타깃 추가, 분기점 드래그)는 아직 없다 — 선택 시 분기점만
  표시한다.

### 핵심 Refs

| Ref | 용도 |
|-----|------|
| `lineRef` | Arrow/Line Konva 노드. `points()`로 드래그 중 직접 업데이트 |
| `startHandleRef` | 시작 핸들 Circle. 드래그 중 `.position()` 직접 업데이트 |
| `endHandleRef` | 끝 핸들 Circle. 드래그 중 `.position()` 직접 업데이트 |
| `dragStartPosRef` | Standalone 드래그 시작 시점 스냅샷 (x, y, endX, endY, lineX, lineY) |

### 리렌더 격리 (2026-08 수리)

- Connector는 `objectsById` prop을 받지 않는다 — 스냅 대상 목록은 드래그
  이벤트 시점에 `useCanvasStore.getState().objects`로 읽는다 (reactive 구독
  금지: 아무 객체가 바뀌어도 모든 커넥터가 리렌더되던 누수의 원인)
- ConnectorShapeRenderer는 끝점 도형만 좁게 구독 (`objects.find` — 대상
  불변이면 같은 참조라 리렌더 없음), `__group:` 연결은 customBounds만 구독

## Chart.tsx 특이사항

### 차트 종류

| 종류 | 설명 |
|------|------|
| `bar` | 막대 차트 |
| `line` | 꺾은선 차트 (다중 시리즈 지원) |
| `pie` | 원형 차트 (도넛 변환 가능) |

### Pie Chart 스타일

`pieStyle` 필드로 5가지 스타일 제어:

| 스타일 | 설명 | innerRadius |
|--------|------|-------------|
| `default` | 기본 파이 | 0 |
| `donut` | 도넛형 | 40 |
| `3d` | 3D 입체 효과 (그림자) | 0 |
| `rounded` | Arc + 갭 + 둥근 끝 | 50 |
| `gradient` | 방사형 그라디언트 | 30 |

### 동적 크기 조절

차트 리사이즈 시 폰트/간격이 자동 스케일링됨:
- `dynamicFontScale`: barWidth 기반 폰트 크기 조절 (0.6~1.0)
- `minTextWidth`: 라벨 최소 너비 20px 보장
- 동적 gap 계산으로 막대 오버플로 방지

## CanvasImage 디코드 캐시

- 모듈 레벨 LRU 캐시(100개, src → HTMLImageElement) — 뷰포트 가상화로
  언마운트됐다 재진입해도 재디코드/깜빡임 없음 (캐시 히트면 첫 렌더에 표시)
- 디코드 중에는 회색 플레이스홀더 Rect를 그려 자리 유지 (선택·드래그 가능)

## Chart 더블클릭

- 본문 더블클릭 = 제목 편집 (헤더 더블클릭과 동일, `chart-edit-title`
  커스텀 이벤트). 헤더 숨김(`chartShowHeader === false`) 시엔 무동작.
