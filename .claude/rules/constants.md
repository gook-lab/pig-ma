# Constants Rules

> Applies to: `src/constants/**/*.ts`

## Overview

공용 상수는 `src/constants/` 디렉토리에서 관리합니다. View 모드(Konva)와 Edit 모드(HTML)에서 동일한 값을 사용하여 UI 일관성을 보장합니다.

## File Structure

| 파일 | 설명 |
|------|------|
| `index.ts` | 모든 상수 re-export |
| `zIndex.ts` | z-index 계층 상수 |
| `colors.ts` | 색상 팔레트 상수 |
| `fonts.ts` | 폰트 토큰 → 스택 레지스트리 (기본 폰트·드롭다운 목록 정본) |
| `text.ts` | 텍스트/타이포그래피 설정 |
| `table.ts` | 테이블 셀 설정 |
| `zoom.ts` | 줌 레벨 상수 |

## Usage Pattern

```typescript
// Good: constants에서 import
import { TEXT_CONFIG, TABLE_CELL } from "@/constants";

// Good: 특정 파일에서 직접 import
import { TABLE_CELL } from "@/constants/table";

// Bad: 하드코딩
const padding = 8; // ❌
const padding = TABLE_CELL.padding.left; // ✅
```

## FONTS — 폰트 토큰과 스택

`FontFamily` 는 **토큰**이지 CSS 패밀리명이 아니다. 렌더·측정에 넘기기 직전에
`fontStack()` 으로 풀어서 쓴다.

```typescript
import { DEFAULT_FONT_FAMILY, fontStack } from "@/constants/fonts";

// 저장할 값(토큰)
fontFamily: DEFAULT_FONT_FAMILY

// Konva / CSS / measureTextWidth 에 넘길 값(스택)
<Text fontFamily={fontStack(shape.fontFamily)} />
```

**폰트명을 그대로 넘기지 않는다.** 폴백 없는 이름 하나만 넘어가면 그 폰트가
설치·로드되지 않았을 때 브라우저 기본 폰트(대개 세리프)로 떨어진다. 기본값이던
`"Pretendard"` 가 어디에서도 로드되지 않아 캔버스 텍스트 전부가 세리프로
그려지고 있었다 (2026-08-25 수리).

폰트를 추가할 때 손대야 하는 곳:

1. `types.ts` 의 `FontFamily` 유니온
2. `schemas/canvasObject.ts` 의 `FontFamilySchema` (빠뜨리면 그 폰트가 담긴
   `.pigma` 가 검증에서 튕긴다)
3. `constants/fonts.ts` 의 `FONTS` — `Record<FontFamily, …>` 라 빠뜨리면
   타입 에러로 잡힌다
4. 웹폰트면 `index.html` 의 Google Fonts 링크

드롭다운 목록(`FONT_OPTIONS`)과 Figma 매퍼의 허용 목록은 레지스트리에서
파생되므로 따로 고치지 않는다.

## TEXT_CONFIG

텍스트 컴포넌트별 설정:

```typescript
TEXT_CONFIG.stickyNote.padding  // { left: 12, right: 12, top: 8, bottom: 12 }
TEXT_CONFIG.textBox.padding     // { left: 4, right: 4, top: 4, bottom: 4 }
TEXT_CONFIG.shape.padding       // { left: 8, right: 8, top: 8, bottom: 8 }
TEXT_CONFIG.connectorLabel.padding // { left: 6, right: 6, top: 6, bottom: 6 }
```

**사용처:**
- `TextViewerOverlay.tsx` - View 모드 렌더링
- `TextEditorOverlay.tsx` - Edit 모드 오버레이
- `ShapeTextEditor.tsx` - Shape 텍스트 편집
- `Rectangle.tsx` - Konva 텍스트 렌더링

## TABLE_CELL

테이블 셀 설정:

```typescript
TABLE_CELL.padding     // { left: 8, right: 8, top: 4, bottom: 4 }
TABLE_CELL.minRowHeight  // 24
TABLE_CELL.minColWidth   // 40
TABLE_CELL.fontSize      // 14
TABLE_CELL.verticalAlign // "middle"
```

**사용처:**
- `Table.tsx` - Konva 셀 텍스트 렌더링
- `TableCellEditor.tsx` - 셀 편집 오버레이
- `table.ts` (store slice) - 리사이즈 최소값

## TABLE_DEFAULTS

테이블 기본 크기:

```typescript
TABLE_DEFAULTS.colWidth    // 120
TABLE_DEFAULTS.rowHeight   // 40
TABLE_DEFAULTS.rowCount    // 2
TABLE_DEFAULTS.colCount    // 2
TABLE_DEFAULTS.borderColor // "#E0E0E0"
```

## View/Edit 일관성 보장

View 모드와 Edit 모드에서 동일한 상수를 사용해야 텍스트 위치가 일치합니다.

### 왜 중요한가?

View 모드(Konva 렌더링)와 Edit 모드(HTML 오버레이)는 서로 다른 렌더링 엔진을 사용합니다.
**하드코딩된 값이 다르면 편집 시작/종료 시 텍스트가 점프하는 현상**이 발생합니다.

```typescript
// ❌ Bad: 하드코딩으로 인한 불일치
// Rectangle.tsx
const padding = 8;  // 하드코딩

// ShapeTextEditor.tsx
const padding = 10;  // 다른 값!

// ✅ Good: 공용 상수 사용
// Rectangle.tsx
const { padding } = TEXT_CONFIG.shape;

// ShapeTextEditor.tsx
const { padding } = TEXT_CONFIG.shape;  // 동일한 값 보장
```

### 체크리스트

새 컴포넌트 추가 시:
1. View 컴포넌트(Konva)에서 사용하는 padding, fontSize 등 확인
2. Edit 컴포넌트(HTML)에서 동일한 상수 import
3. 수동 테스트: 편집 모드 진입/종료 시 텍스트 위치 변화 없는지 확인

### 예시:

```typescript
// Table.tsx (View - Konva)
<Text
  x={bounds.x + TABLE_CELL.padding.left}
  y={bounds.y + TABLE_CELL.padding.top}
  width={bounds.width - TABLE_CELL.padding.left - TABLE_CELL.padding.right}
  height={bounds.height - TABLE_CELL.padding.top - TABLE_CELL.padding.bottom}
  verticalAlign={TABLE_CELL.verticalAlign}
/>

// TableCellEditor.tsx (Edit - HTML)
const style = {
  padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
  display: "flex",
  alignItems: "center", // verticalAlign: "middle" 대응
};
```

## Helper Functions

```typescript
// CSS padding 문자열 생성
getPaddingString("stickyNote") // "8px 12px 12px 12px"

// 텍스트 영역 크기 계산
getTextAreaSize("textBox", 200, 40) // { width, height, x, y }
```

## Adding New Constants

1. 해당 도메인 파일에 상수 추가 (또는 새 파일 생성)
2. `index.ts`에서 export
3. 하드코딩된 값을 상수로 교체
4. View/Edit 양쪽에서 동일 상수 사용 확인

## Migration from Legacy

기존 `@/utils/textConfig`는 `@/constants/text`로 이전되었습니다.
하위 호환성을 위해 `textConfig.ts`는 re-export만 수행합니다.

```typescript
// Deprecated (works but not recommended)
import { TEXT_CONFIG } from "@/utils/textConfig";

// Recommended
import { TEXT_CONFIG } from "@/constants/text";
// or
import { TEXT_CONFIG } from "@/constants";
```
