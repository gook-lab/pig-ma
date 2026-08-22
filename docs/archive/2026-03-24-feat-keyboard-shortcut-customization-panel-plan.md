---
title: "feat: Add keyboard shortcut customization panel"
type: feat
status: active
date: 2026-03-24
---

# Keyboard Shortcut Customization Panel

## Overview

사용자가 키보드 단축키를 자유롭게 커스터마이징할 수 있는 패널을 구현합니다. 현재 읽기 전용인 `ShortcutPanel.tsx`를 확장하여 편집 기능을 추가합니다.

## Problem Statement / Motivation

현재 상태:
- 단축키는 `useShortcuts.ts`에서 관리되며 `updateShortcut()`, `resetToDefaults()`가 이미 구현됨
- `ShortcutPanel.tsx`는 단축키 목록만 표시 (읽기 전용)
- 사용자가 단축키를 변경할 수 있는 UI가 없음

필요성:
- 사용자마다 선호하는 단축키 조합이 다름
- 다른 도구(Figma, Photoshop 등)에서 익숙한 단축키로 변경하고 싶은 수요
- 실수로 자주 누르는 단축키를 비활성화하고 싶은 경우

## Proposed Solution

기존 `ShortcutPanel.tsx`를 확장하여 편집 기능 추가:

1. **편집 모드**: 각 단축키 항목 클릭 시 키 입력 캡처 모드 진입
2. **충돌 감지**: 다른 단축키와 중복 시 해결 옵션 제공
3. **저장/취소**: 변경사항 즉시 적용 또는 취소
4. **기본값 복원**: 전체 또는 개별 단축키 리셋

## Technical Considerations

### Architecture (Simplified - Technical Review Applied)

```
ShortcutPanel.tsx (확장 - 모든 로직 단일 파일)
└── 인라인 편집 모드 (~80줄 추가)

useShortcuts.ts (확장)
├── isCapturing 플래그 추가 (전역 단축키 충돌 방지)
└── bindingsEqual() 함수 추가
```

**단순화 적용 사항:**
- ❌ 별도 컴포넌트 파일 3개 → ✅ 단일 파일 유지
- ❌ swap 기능 → ✅ overwrite/cancel만
- ❌ ConflictDialog 모달 → ✅ 인라인 confirm()
- ❌ partialBinding 상태 → ✅ 완료 시에만 표시

### 기존 코드 활용

| 파일 | 활용 내용 |
|------|----------|
| `src/hooks/useShortcuts.ts` | `updateShortcut()`, `resetToDefaults()`, `formatBinding()` |
| `src/components/ShortcutPanel.tsx` | 패널 구조, 단축키 목록 렌더링 |
| `src/components/ExportPanel.tsx` | 모달 패턴 참조 |
| `src/constants/zIndex.ts` | `Z_MODAL_BACKDROP`, `Z_MODAL_CONTENT` |

### 키 입력 캡처 로직

```typescript
function handleKeyCapture(e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();

  // 시스템 키는 무시 (Tab, Escape, Enter는 패널 조작용)
  if (['Tab', 'Escape', 'Enter'].includes(e.key)) {
    if (e.key === 'Escape') cancelEdit();
    if (e.key === 'Enter') saveEdit();
    return;
  }

  // Modifier만 눌린 경우 대기
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    setPartialBinding({ modifiers: getCurrentModifiers(e) });
    return;
  }

  // 최종 키 입력 - 캡처 완료
  const binding: KeyBinding = {
    key: e.code, // 비영문 키보드 지원
    modifiers: getCurrentModifiers(e),
  };

  checkConflictAndApply(binding);
}
```

### 충돌 해결 전략

```typescript
interface ConflictResolution {
  type: 'overwrite' | 'swap' | 'cancel';
  conflictingAction: ShortcutAction;
}

function resolveConflict(resolution: ConflictResolution) {
  switch (resolution.type) {
    case 'overwrite':
      // 기존 단축키 삭제 후 새 값 적용
      updateShortcut(conflictingAction, { key: '', modifiers: [] });
      updateShortcut(currentAction, newBinding);
      break;
    case 'swap':
      // 두 단축키 교환
      swapShortcuts(currentAction, conflictingAction);
      break;
    case 'cancel':
      // 변경 취소
      break;
  }
}
```

## System-Wide Impact

### Interaction Graph

1. **ShortcutPanel** → `useShortcutsStore.updateShortcut()` → localStorage 저장
2. `useKeyboardShortcuts.ts` ← `useShortcutsStore` 구독 → 실시간 단축키 반영
3. `Toolbar.tsx` 툴팁 ← `formatBinding()` → 동적 단축키 표시
4. `FloatingUtilityBar.tsx` 키보드 시각화 ← 커스텀 값 반영

### API Surface Parity

| 인터페이스 | 업데이트 필요 |
|-----------|--------------|
| Toolbar 툴팁 | `formatBinding()` 사용으로 자동 반영 |
| FloatingUtilityBar | 현재 설정값 표시 확인 필요 |
| 키보드 시각화 모달 | 커스텀 값 반영 확인 필요 |

## Acceptance Criteria

### Core Requirements

- [ ] 단축키 패널에서 각 항목을 클릭하여 편집 모드 진입
- [ ] 키 입력 시 실시간으로 현재 입력 표시 (예: "Ctrl + ...")
- [ ] Modifier 키(Ctrl, Shift, Alt, Meta) 조합 지원
- [ ] 충돌 감지 및 해결 옵션 제공 (덮어쓰기, 스왑, 취소)
- [ ] ESC로 편집 취소, Enter로 저장
- [ ] "Reset to Defaults" 버튼으로 전체 리셋 (확인 대화상자 포함)
- [ ] 변경사항 localStorage에 자동 저장

### Edge Cases

- [ ] Tab, Escape, Enter 키는 단축키로 설정 불가 (패널 조작용 예약)
- [ ] Modifier 키만 단독으로는 단축키 설정 불가
- [ ] 비영문 키보드(한글 등) 지원 - `e.code` 기반 매칭
- [ ] 브라우저 기본 단축키(Ctrl+S 등) 설정 시 경고 표시
- [ ] 편집 중 외부 클릭 시 취소 처리
- [ ] 단축키를 "없음"으로 설정 가능 (Backspace로 삭제)

### Accessibility

- [ ] 키보드만으로 패널 탐색 가능 (Tab 순서)
- [ ] 편집 모드 진입/종료 시 포커스 관리
- [ ] 스크린 리더용 ARIA 레이블 제공

## Success Metrics

- 단축키 커스터마이징 사용률 측정 (localStorage 데이터 기반)
- 기본값 대비 변경된 단축키 개수 추적
- 충돌 해결 시 사용자 선택 패턴 분석

## Dependencies & Risks

### Dependencies

- 기존 `useShortcuts.ts` 스토어 구조 유지
- `ShortcutPanel.tsx` 기존 UI 확장

### Risks

| 리스크 | 영향 | 완화 방안 |
|--------|-----|----------|
| 브라우저 단축키 충돌 | 일부 단축키가 예상대로 동작하지 않음 | 경고 메시지 표시 |
| 비영문 키보드 호환성 | 일부 키 인식 안 됨 | `e.code` 기반 + 테스트 |
| 모바일/태블릿 | 키보드 없이 사용 불가 | 외부 키보드 연결 시에만 표시 |

## Implementation Plan

### MVP

#### ShortcutPanel.tsx 수정

```tsx
// 편집 상태 추가
const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null);
const [pendingBinding, setPendingBinding] = useState<KeyBinding | null>(null);

// 항목 클릭 핸들러
<ShortcutItem
  config={shortcut}
  isEditing={editingAction === shortcut.action}
  onEdit={() => setEditingAction(shortcut.action)}
  onSave={(binding) => handleSave(shortcut.action, binding)}
  onCancel={() => setEditingAction(null)}
/>
```

#### ShortcutItem.tsx (신규)

```tsx
interface ShortcutItemProps {
  config: ShortcutConfig;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (binding: KeyBinding) => void;
  onCancel: () => void;
}

export function ShortcutItem({ config, isEditing, onEdit, onSave, onCancel }: ShortcutItemProps) {
  if (isEditing) {
    return <KeyCaptureInput binding={config.binding} onSave={onSave} onCancel={onCancel} />;
  }

  return (
    <button onClick={onEdit} className="flex justify-between w-full p-2 hover:bg-gray-100">
      <span>{config.label}</span>
      <kbd>{formatBinding(config.binding)}</kbd>
    </button>
  );
}
```

#### KeyCaptureInput.tsx (신규)

```tsx
export function KeyCaptureInput({ binding, onSave, onCancel }: Props) {
  const [currentInput, setCurrentInput] = useState<string>('Press a key...');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key === 'Enter') { onSave(capturedBinding); return; }
      if (e.key === 'Backspace') { onSave({ key: '', modifiers: [] }); return; }

      // Modifier만 눌린 경우 대기
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        setCurrentInput(formatPartialBinding(e));
        return;
      }

      // 최종 키 캡처
      const newBinding = captureBinding(e);
      setCurrentInput(formatBinding(newBinding));
      setCapturedBinding(newBinding);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <input
      ref={inputRef}
      value={currentInput}
      readOnly
      className="w-full p-2 border-2 border-blue-500 rounded text-center"
    />
  );
}
```

#### useShortcuts.ts 확장

```typescript
// 충돌 검사 함수 추가
export function findConflict(
  shortcuts: ShortcutConfig[],
  binding: KeyBinding,
  excludeAction?: ShortcutAction
): ShortcutConfig | null {
  return shortcuts.find(s =>
    s.action !== excludeAction &&
    bindingsEqual(s.binding, binding)
  ) ?? null;
}

// 스왑 함수 추가
swapShortcuts: (action1, action2) => set((state) => ({
  shortcuts: state.shortcuts.map(s => {
    if (s.action === action1) {
      const other = state.shortcuts.find(x => x.action === action2);
      return { ...s, binding: other?.binding ?? s.binding };
    }
    if (s.action === action2) {
      const other = state.shortcuts.find(x => x.action === action1);
      return { ...s, binding: other?.binding ?? s.binding };
    }
    return s;
  }),
})),
```

## Sources & References

### Internal References

- `src/hooks/useShortcuts.ts` - 단축키 스토어 (기존 패턴)
- `src/components/ShortcutPanel.tsx` - 현재 패널 구조
- `src/components/ExportPanel.tsx` - 모달 패턴 참조
- `src/hooks/useKeyboardShortcuts.ts` - 키보드 이벤트 핸들링

### Related Work

- CLAUDE.md Pending Tasks에 등록됨: "키보드 단축키 커스터마이징 패널"
