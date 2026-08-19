# Hooks

커스텀 React 훅 모음.

## 파일 목록

| 파일 | 설명 |
|------|------|
| `useKeyboardShortcuts.ts` | 전역 키보드 단축키 처리 |
| `useShortcuts.ts` | 단축키 설정 저장소 (Zustand) |
| `useAutoSave.ts` | 자동 저장 히스토리 관리 |
| `useDragCoordinator.ts` | 드래그 성능 최적화 (React state 우회) |

## 특징

- **useKeyboardShortcuts**: App.tsx에서 한 번만 호출, 텍스트 편집 중 비활성화
- **useDragCoordinator**: 드래그 중 store 업데이트 없이 Konva 직접 렌더링 → 성능 최적화

## useDragCoordinator API

`dragCoordinator` 싱글톤이 export됩니다 (훅 형태가 아님).

| 메서드 | 용도 |
|--------|------|
| `setPosition(id, x, y)` | 드래그 위치 발행 (shape/connector onDragMove에서 호출) |
| `getPosition(id)` | 현재 드래그 위치 조회 (동기) |
| `subscribe(id, cb)` | 위치 변경 구독 → unsubscribe 함수 반환 |
| `clear(id)` | 드래그 종료 시 위치 초기화 + null 알림 |
| `setLayer(layer)` | Connector 레이어 등록 (배치 드로우용) |
| `scheduleDraw()` | rAF으로 batchDraw 스케줄링 (중복 방지) |

**구독자:** `Connector.tsx`, `ConnectorLabel.tsx`, `ConnectionHandles.tsx`, `GroupBoundary.tsx`
