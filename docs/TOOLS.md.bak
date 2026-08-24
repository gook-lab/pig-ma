# Tools Guide

캔버스에서 사용 가능한 모든 도구를 상세히 설명할게요.

## Tool Overview

| 도구 | 단축키 | 설명 |
|------|--------|------|
| Select | V | 객체 선택 및 조작 |
| Hand | H | 캔버스 패닝 |
| Pencil | P | 자유 드로잉 |
| Shape | R | 도형 생성 (패널 열기) |
| Sticky Note | S | 메모지 생성 |
| TextBox | T | 텍스트 박스 생성 |
| Connector | L | 연결선/화살표 생성 |
| Caption | C | 댓글 추가 |
| Eraser | E | 드로잉 삭제 |

---

## 1. Select Tool (V)

객체를 선택하고 조작하는 기본 도구예요.

### 기능

| 동작 | 설명 |
|------|------|
| 클릭 | 단일 객체 선택 |
| Shift + 클릭 | 다중 선택에 추가/제거 |
| 빈 공간 드래그 | 마키(영역) 선택 |
| 객체 드래그 | 객체 이동 |
| Arrow Keys | 1px 이동 |
| Shift + Arrow | 10px 이동 |

### 잠금된 객체

- `locked: true`인 객체는 선택하거나 드래그할 수 없어요
- Transformer도 표시되지 않아요
- 잠금 해제는 우클릭 메뉴나 `Shift+Cmd+L`로 할 수 있어요

### 코드 예시

```typescript
// 선택 핸들러
const handleSelect = (id: string, e: KonvaEvent) => {
  if (isLocked) return
  if (tool !== 'select') return

  const targetObj = objects.find((obj) => obj.id === id)
  if (targetObj?.locked) return  // 잠긴 객체 선택 불가

  if (e.evt.shiftKey) {
    addToSelection(id)
  } else {
    setSelectedIds([id])
  }
}
```

---

## 2. Hand Tool (H)

캔버스를 패닝하는 전용 도구예요.

### 기능

- 드래그로 캔버스를 이동할 수 있어요
- 객체를 선택하거나 클릭할 수 없어요 (순수 패닝 전용)
- 화면 잠금 모드에서도 사용 가능해요

### 패닝 방식

| 방법 | 동작 |
|------|------|
| Hand 도구 + 드래그 | 캔버스 패닝 |
| 스크롤 (도구 무관) | 패닝 (2배속) |
| Cmd + 스크롤 | 줌 인/아웃 |

---

## 3. Pencil Tool (P)

자유롭게 그릴 수 있는 도구예요.

### 펜 타입

| 타입 | 두께 배율 | 투명도 | 설명 |
|------|-----------|--------|------|
| pen | 1x | 100% | 일반 펜 |
| marker | 2x | 70% | 마커 |
| highlighter | 4x | 40% | 형광펜 |

### 설정

펜의 설정을 하는 인터페이스예요.

```typescript
interface PenSettings {
  penType: 'pen' | 'marker' | 'highlighter'
  strokeColor: string   // 색상
  strokeWidth: number   // 기본 두께
}
```

### 드로잉 데이터

드로잉은 Line 객체로 저장돼요.

```typescript
// Line 객체
{
  type: 'line',
  x: startX,
  y: startY,
  points: [0, 0, dx1, dy1, dx2, dy2, ...],  // 시작점 기준 상대 좌표
  stroke: settings.strokeColor,
  strokeWidth: settings.strokeWidth * multiplier,
  penType: settings.penType,
  opacity: penTypeOpacity,
}
```

---

## 4. Shape Tools

### 4.1 Basic Shapes (R)

Shape 패널에서 선택해서 생성할 수 있어요.

**기본 도형:**
- rectangle, roundedRect, circle, ellipse
- triangle, triangleDown, diamond
- pentagon, hexagon, octagon
- star, star4, cross
- arrowRight/Left/Up/Down
- chevronRight/Left, speechBubble

**플로우차트 도형:**
- flowProcess, flowDecision, flowTerminal
- flowData, flowDocument, flowDatabase
- flowPredefined, flowManualInput
- flowPreparation, flowDelay
- flowOr, flowSumming

### 4.2 Sticky Note (S)

메모지 스타일의 텍스트 박스예요.

**특징:**
- 6가지 배경색을 선택할 수 있어요
- 작성자명이 하단에 표시돼요
- 리치 텍스트를 지원해요
- 그림자 효과가 있어요

**기본 색상:**
```typescript
const STICKY_COLORS = [
  '#fef08a',  // yellow
  '#fecaca',  // red
  '#bbf7d0',  // green
  '#bfdbfe',  // blue
  '#e9d5ff',  // purple
  '#fed7aa',  // orange
]
```

### 4.3 TextBox (T)

자유롭게 텍스트를 입력할 수 있는 영역이에요.

**특징:**
- 투명 배경이고 fill/stroke 설정이 가능해요
- 자동으로 높이가 조정돼요
- 리치 텍스트를 지원해요
- 폰트 크기 프리셋이 있어요 (S/M/L/XL/XXL)

**텍스트 옵션:**
- 색상: 텍스트 색상, 배경색, 테두리색을 설정해요
- 폰트: Pretendard, Noto Sans KR, Nanum Gothic 등을 선택할 수 있어요
- 스타일: 굵게, 취소선을 적용할 수 있어요
- 정렬: 왼쪽, 가운데, 오른쪽 정렬이 가능해요
- 리스트: 번호, 글머리 기호를 추가할 수 있어요

---

## 5. Connector Tool (L)

도형 간에 연결선을 그리는 도구예요.

### 생성 방식

1. **자유 배치**: 빈 공간에서 드래그해요
2. **도형 연결**: 도형 근처에서 시작하거나 종료하면 자동으로 스냅돼요

### 스냅 시스템

자동 연결을 위한 설정이에요.

```typescript
const SNAP_THRESHOLD = 30  // 자동 연결 거리 (px)
const GRID_SIZE = 10       // 그리드 스냅 단위
```

- 시작/끝점이 도형의 30px 이내면 자동으로 연결돼요
- 연결할 때 앵커(top/right/bottom/left/center)가 설정되어요
- 도형을 이동하면 커넥터도 함께 이동해요

### 스타일 옵션

| 옵션 | 값 | 설명 |
|------|-----|------|
| pathStyle | straight, curved, elbowed | 경로 스타일 |
| lineStyle | solid, dashed, dotted | 선 스타일 |
| startMarker | none, arrow, filledArrow, diamond, circle | 시작점 마커 |
| endMarker | none, arrow, filledArrow, diamond, circle | 끝점 마커 |
| label | string | 중앙 텍스트 레이블 |

### 연결 핸들

Shape을 선택하면 4방향에 파란색 핸들이 표시돼요:
- 클릭 시 가까운 도형이 있으면 그 도형과 연결해요
- 없으면 도형을 복제한 후 연결해요

---

## 6. Caption Tool (C)

FigJam 스타일의 댓글 시스템이에요.

### 기능

- 캔버스 위에 번호가 매겨진 마커가 표시돼요
- 스레드 방식으로 대화를 나눠요
- 해결/미해결 상태를 표시할 수 있어요
- 이미지 첨부가 가능해요 (Ctrl+V)
- 우측 패널에서 전체 목록을 관리해요

### 데이터 구조

```typescript
interface CaptionThread {
  id: string
  x: number           // 캔버스 좌표
  y: number
  messages: CommentMessage[]
  isResolved: boolean
  isRead: boolean
  createdAt: string
  updatedAt: string
}

interface CommentMessage {
  id: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
  attachments?: CommentAttachment[]
}
```

---

## 7. Eraser Tool (E)

드로잉(Line)을 지우는 도구예요.

### 크기 설정

| 크기 | 반경 |
|------|------|
| small | 10px |
| medium | 25px |
| large | 50px |

### 동작

- 드래그로 지나가는 Line 객체를 삭제해요
- Shape, TextBox 등은 영향을 받지 않아요

---

## Context Menu (우클릭)

### 객체 선택 시

| 메뉴 | 단축키 | 설명 |
|------|--------|------|
| 복사 | Cmd+C | 클립보드에 복사 |
| 붙여넣기 | Cmd+V | 커서 위치에 붙여넣기 |
| 붙여넣어 교체 | Shift+Cmd+R | 선택 삭제 후 붙여넣기 |
| 삭제 | Backspace | 선택 객체 삭제 |
| 맨 앞으로 | ] | Z-order 맨 앞 |
| 맨 뒤로 | [ | Z-order 맨 뒤 |
| 잠금 | Shift+Cmd+L | 이동/편집 잠금 |
| 모든 잠금 해제 | Opt+Shift+Cmd+L | 전체 잠금 해제 |

### 빈 공간 우클릭

| 메뉴 | 단축키 | 설명 |
|------|--------|------|
| 붙여넣기 | Cmd+V | 커서 위치에 붙여넣기 |
| 모든 잠금 해제 | Opt+Shift+Cmd+L | 전체 잠금 해제 |
| 커서 채팅 | / | 임시 말풍선 |
| UI 숨기기 | Cmd+\ | 툴바 등 숨김 |
| 댓글 숨기기 | - | 캡션 마커 숨김 |

---

## Options Bars

### TextOptionsBar

TextBox나 StickyNote를 선택하면 표시돼요:
- 배경색 (StickyNote만)
- Fill/Stroke 설정
- 텍스트 색상
- 폰트 선택
- 폰트 크기
- 굵게/취소선
- 정렬
- 리스트 스타일

### ShapeOptionsBar

Shape을 선택하면 표시돼요:
- Fill 색상과 모드 (Fill/Transparent/None)
- Stroke 색상과 스타일 (Solid/Dashed/Dotted)
- 텍스트 옵션

### ConnectorOptionsBar

Connector를 선택하면 표시돼요:
- 선 색상
- 경로 스타일 (직선/곡선/꺾인선)
- 선 스타일 (실선/점선/점)
- 시작/끝 마커
- 텍스트 레이블

### LineOptionsBar

Line(펜슬)을 선택하면 표시돼요:
- 선 색상
- 선 두께
