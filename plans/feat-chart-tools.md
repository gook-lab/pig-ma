# feat: 차트 도구 추가

## Overview

하단 Toolbar에 차트 기능을 추가합니다. 바차트, 꺾은선차트, 원형차트(파이/도넛)를 캔버스에서 생성하고 편집할 수 있습니다.

## 차트 종류 (3개)

| 차트 | Konva 컴포넌트 | 비고 |
|------|---------------|------|
| 바차트 | `Rect` | 가로/세로는 rotation으로 처리 |
| 꺾은선차트 | `Line` + `Circle` | 데이터 포인트 연결 |
| 원형차트 | `Wedge` | innerRadius > 0이면 도넛 |

> **단순화**: barHorizontal은 bar + rotation:90, donut은 pie + innerRadius로 처리

---

## 타입 정의 (`types.ts`)

```typescript
// ObjectType, Tool 추가
type ObjectType = ... | "chart";
type Tool = ... | "chart";

// 차트 종류 (3개)
type ChartVariant = "bar" | "line" | "pie";

// 차트 데이터 항목 (id 없이 단순화)
interface ChartDataItem {
  label: string;
  value: number;
  color: string;  // fill 대신 color
}

// ChartData 캡슐화 (tableData 패턴)
interface ChartData {
  variant: ChartVariant;
  items: ChartDataItem[];
  showLabels: boolean;      // 라벨+값 통합 표시
  innerRadius?: number;     // pie → donut (0이면 pie)
}

// CanvasObject 확장
interface CanvasObject {
  // ... 기존 필드
  chartData?: ChartData;    // 단일 객체로 캡슐화
}
```

---

## 파일 구조 (기존 패턴 준수)

```
src/
├── components/
│   ├── shapes/
│   │   └── Chart.tsx           # 신규: 차트 렌더링
│   ├── ChartOptionsBar.tsx     # 신규: 옵션바 (기존 경로 패턴)
│   ├── ChartDataEditor.tsx     # 신규: 사이드 패널 에디터
│   └── Toolbar.tsx             # 수정: 차트 도구 추가
├── utils/
│   └── factory.ts              # 수정: createChart 추가
├── constants/
│   └── colors.ts               # 수정: CHART_COLORS 추가
└── types.ts                    # 수정: 타입 추가
```

> **삭제**: `chart/` 폴더, `ChartPreview.tsx` 불필요

---

## Chart.tsx 구현

```typescript
// src/components/shapes/Chart.tsx
export const Chart = memo(function Chart({ shape, ... }: ChartProps) {
  const { chartData } = shape;
  if (!chartData) return null;

  switch (chartData.variant) {
    case "bar":
      return <BarChartRenderer data={chartData} width={shape.width} height={shape.height} />;
    case "line":
      return <LineChartRenderer data={chartData} width={shape.width} height={shape.height} />;
    case "pie":
      return <PieChartRenderer data={chartData} width={shape.width} height={shape.height} />;
  }
});

// 내부 헬퍼 (별도 파일 분리 불필요)
function PieChartRenderer({ data, width, height }) {
  const radius = Math.min(width, height) / 2;
  const innerRadius = data.innerRadius ?? 0;  // 0이면 pie, >0이면 donut
  const total = data.items.reduce((sum, d) => sum + d.value, 0);
  let startAngle = 0;

  return (
    <Group x={width/2} y={height/2}>
      {data.items.map((item, i) => {
        const angle = (item.value / total) * 360;
        const wedge = (
          <Wedge
            key={i}
            angle={angle}
            rotation={startAngle - 90}
            radius={radius}
            innerRadius={innerRadius}
            fill={item.color}
          />
        );
        startAngle += angle;
        return wedge;
      })}
    </Group>
  );
}
```

---

## Factory 함수 (`factory.ts`)

```typescript
import { CHART_COLORS } from "@/constants/colors";

export function createChart(
  x: number,
  y: number,
  variant: ChartVariant,
): CanvasObject {
  return {
    id: nanoid(),
    type: "chart",
    x,
    y,
    width: 200,
    height: 150,
    chartData: {
      variant,
      items: [
        { label: "A", value: 30, color: CHART_COLORS[0] },
        { label: "B", value: 50, color: CHART_COLORS[1] },
        { label: "C", value: 20, color: CHART_COLORS[2] },
      ],
      showLabels: true,
      innerRadius: variant === "pie" ? 0 : undefined,
    },
    rotation: 0,
    opacity: 1,
  };
}
```

---

## Toolbar 통합

```typescript
// Toolbar.tsx 또는 별도 ChartToolbarPopover.tsx
<Popover>
  <PopoverTrigger>
    <BarChart3 className="h-5 w-5" />
  </PopoverTrigger>
  <PopoverContent>
    <div className="grid grid-cols-3 gap-2">
      <ChartButton variant="bar" icon={<BarChart3 />} label="Bar" />
      <ChartButton variant="line" icon={<TrendingUp />} label="Line" />
      <ChartButton variant="pie" icon={<PieChartIcon />} label="Pie" />
    </div>
  </PopoverContent>
</Popover>
```

---

## ChartOptionsBar

선택된 차트에 대한 옵션바 (사이드 패널 방식):

- **데이터 편집**: 항목 추가/수정/삭제
- **라벨 표시**: on/off 토글
- **도넛 변환**: innerRadius 슬라이더 (pie 선택 시)
- **가로 전환**: rotation 90도 토글 (bar 선택 시)

---

## 구현 순서

1. `types.ts`에 ChartVariant, ChartData, ChartDataItem 추가
2. `constants/colors.ts`에 CHART_COLORS 추가
3. `factory.ts`에 createChart 추가
4. `Chart.tsx` 컴포넌트 생성 (bar, line, pie 렌더러 포함)
5. `Canvas.tsx`에 chart 렌더링 추가
6. `Toolbar.tsx`에 차트 도구 버튼 추가
7. `ChartOptionsBar.tsx` 생성
8. `ChartDataEditor.tsx` 생성 (사이드 패널)

---

## 수정 파일 목록

| 파일 | 변경 |
|------|------|
| `src/types.ts` | ChartVariant, ChartData, ChartDataItem 추가 |
| `src/constants/colors.ts` | CHART_COLORS 추가 |
| `src/utils/factory.ts` | createChart 함수 추가 |
| `src/components/shapes/Chart.tsx` | **신규** |
| `src/components/ChartOptionsBar.tsx` | **신규** |
| `src/components/ChartDataEditor.tsx` | **신규** |
| `src/components/Toolbar.tsx` | 차트 도구 버튼 추가 |
| `src/components/Canvas.tsx` | 차트 렌더링 로직 추가 |

---

## Acceptance Criteria

- [ ] 3종류 차트 생성 가능 (bar, line, pie)
- [ ] pie 차트에서 innerRadius 조절로 도넛 변환
- [ ] bar 차트에서 가로/세로 전환 (rotation)
- [ ] 데이터 항목 추가/수정/삭제
- [ ] 항목별 색상 커스터마이징
- [ ] 라벨 표시 on/off
- [ ] 차트 선택 시 옵션바 표시
- [ ] Undo/Redo 지원 (Zustand temporal 자동)
- [ ] 리사이즈 지원 (Transformer)

---

## 고려 사항

### 키보드 단축키
- 사용 가능한 키 확인 필요 (예: K?)

### 리사이징 동작
- 차트 크기 조절 시 비율 유지
- 라벨 폰트 크기 자동 계산: `Math.max(10, chartWidth / 15)`

### 테스트
- Playwright 테스트 작성 (차트 생성, 데이터 편집, 리사이즈)

---

## References

- Konva Wedge: https://konvajs.org/docs/shapes/Wedge.html
- 기존 Table 패턴: `src/components/shapes/Table.tsx`, `tableData` 구조
- 옵션바 패턴: `src/components/ShapeOptionsBar.tsx`
