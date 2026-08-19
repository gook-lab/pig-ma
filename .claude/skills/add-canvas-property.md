# Add Canvas Property Skill

CanvasObject에 새 속성을 추가하고 undo/redo 지원을 자동으로 설정합니다.

## Trigger

- 사용자가 "속성 추가", "add property", "새 필드" 등을 언급할 때
- `/add-canvas-property <propertyName> <type>` 형태로 호출

## Workflow

### Step 1: 속성 정보 수집

```
속성 이름: (예: fillOpacity)
타입: (예: number, string, boolean, CustomType)
기본값: (예: 1, undefined)
설명: (예: 도형 채우기 투명도)
적용 대상: (예: shape, stickyNote, 모든 객체)
```

### Step 2: types.ts 업데이트

```typescript
// src/types.ts - CanvasObject 인터페이스에 추가
export interface CanvasObject {
  // ... existing properties
  fillOpacity?: number;  // 도형 채우기 투명도
}
```

### Step 3: store equality 함수 업데이트

```typescript
// src/store/index.ts - equality 함수에 비교 로직 추가
if (pastObj.fillOpacity !== obj.fillOpacity) return false;
```

### Step 4: factory 함수 업데이트 (해당되는 경우)

```typescript
// src/utils/factory.ts - 기본값 설정
export function createRectangle(...): CanvasObject {
  return {
    // ... existing properties
    fillOpacity: 1,  // 기본값
  };
}
```

### Step 5: 검증

1. `npm run build:lib` 실행하여 타입 에러 확인
2. 속성 변경 후 Cmd+Z로 undo 동작 확인

## 체크리스트

- [ ] types.ts에 속성 추가
- [ ] store equality 함수에 비교 로직 추가
- [ ] factory 함수에 기본값 추가 (필요시)
- [ ] 관련 컴포넌트에서 속성 사용
- [ ] undo/redo 테스트

## 예시

```bash
/add-canvas-property fillOpacity number
```

결과:
1. `types.ts`의 CanvasObject에 `fillOpacity?: number` 추가
2. `store/index.ts`의 equality 함수에 비교 로직 추가
3. 관련 factory 함수 업데이트 제안
