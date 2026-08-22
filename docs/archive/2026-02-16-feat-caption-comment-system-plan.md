---
title: 캡션/댓글 시스템 추가
type: feat
status: active
date: 2026-02-16
---

# 캡션/댓글 시스템 추가

## Overview

FigJam 스타일의 캡션(댓글) 시스템을 캔버스 앱에 추가합니다. 사용자가 캔버스 특정 위치에 댓글을 남기고, 스레드 형식으로 대화하며, 우측 패널에서 모든 캡션을 관리할 수 있습니다.

## Problem Statement / Motivation

현재 캔버스 앱에는 협업 시 피드백을 주고받을 수 있는 기능이 없습니다. 디자인 리뷰, 아이디어 논의 시 특정 위치에 댓글을 남기고 스레드로 대화할 수 있는 기능이 필요합니다.

## Proposed Solution

### 핵심 기능

1. **캡션 생성**: `C` 키를 눌러 마우스 위치에 캡션 입력창 표시
2. **캡션 마커**: 캔버스에 파란색 원형 아바타로 캡션 위치 표시
3. **우측 캡션 패널**: 모든 캡션 목록 표시, 검색 및 필터링
4. **스레드 대화**: 캡션 클릭 시 답글 달기 가능
5. **캡션 관리**: 해결됨 표시, 읽지 않음 표시, 링크 복사, 삭제

### UI 컴포넌트

```
┌─────────────────────────────────────────────────────────────────┐
│ Canvas                                              [캡션패널] │
│                                                     ┌─────────┐│
│    [S] ← 캡션 마커 (아바타)                         │🔍 검색  ││
│     │                                               │≡ 필터   ││
│     └── 캡션 팝업 ──┐                               │─────────││
│         ┌──────────────────┐                        │ #2      ││
│         │ 댓글        ⋯ ☑ ✕│                        │ User    ││
│         │ [S] User   방금  │                        │ 내용... ││
│         │     ㄴ○          │                        │ 1개답글 ││
│         │ [답변 입력...]   │                        │─────────││
│         └──────────────────┘                        │ ...     ││
│                                                     └─────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Technical Approach

### 1. 타입 정의 (`types.ts`)

```typescript
// 댓글 메시지
export interface CommentMessage {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  attachments?: CommentAttachment[];
  reactions?: CommentReaction[];
}

// 첨부파일
export interface CommentAttachment {
  id: string;
  type: 'image';
  url: string; // base64 또는 blob URL
  name: string;
}

// 이모지 반응
export interface CommentReaction {
  emoji: string;
  userIds: string[];
}

// 캡션 스레드
export interface CaptionThread {
  id: string;
  x: number; // 캔버스 좌표
  y: number;
  messages: CommentMessage[];
  isResolved: boolean;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

// 사용자 (확장 가능)
export interface User {
  id: string;
  name: string;
  avatarColor?: string; // 기본 아바타 색상
  avatarUrl?: string; // 추후 이미지 지원
}
```

### 2. Store 확장 (`store.ts`)

```typescript
interface CanvasState {
  // ... 기존 상태
  captions: CaptionThread[];
  currentUser: User;
  isCaptionPanelOpen: boolean;
  activeCaptionId: string | null; // 열린 캡션 팝업
}

interface CanvasActions {
  // ... 기존 액션
  // 캡션 CRUD
  addCaption: (x: number, y: number, message: string) => void;
  addReply: (captionId: string, message: string) => void;
  updateMessage: (captionId: string, messageId: string, content: string) => void;
  deleteCaption: (captionId: string) => void;
  deleteMessage: (captionId: string, messageId: string) => void;

  // 캡션 상태
  resolveCaption: (captionId: string, resolved: boolean) => void;
  markAsRead: (captionId: string, read: boolean) => void;

  // UI 상태
  setActiveCaptionId: (id: string | null) => void;
  toggleCaptionPanel: () => void;

  // 사용자
  setCurrentUser: (user: User) => void;
}
```

### 3. 컴포넌트 구조

```
src/components/
├── captions/
│   ├── CaptionMarker.tsx       # 캔버스 위 아바타 마커
│   ├── CaptionPopup.tsx        # 캡션 팝업 (스레드 표시)
│   ├── CaptionInput.tsx        # 댓글 입력창 (이모지, 멘션, 이미지)
│   ├── CaptionMessage.tsx      # 개별 메시지 아이템
│   ├── CaptionPanel.tsx        # 우측 캡션 목록 패널
│   ├── CaptionPanelItem.tsx    # 패널 내 캡션 아이템
│   ├── CaptionFilters.tsx      # 필터 드롭다운
│   └── EmojiPicker.tsx         # 이모지 선택기 (간단한 버전)
```

### 4. 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| C | 마우스 위치에 캡션 입력창 열기 |
| O | Circle 도구 (기존 C에서 변경) |
| ESC | 캡션 입력창/팝업 닫기 |

**단축키 변경**: Circle 도구를 `O`로 변경하고 `C`를 캡션에 사용

**추가 수정 필요**:
- `src/hooks/useKeyboardShortcuts.ts` - Circle 단축키 C → O로 변경
- `CLAUDE.md` - 단축키 문서 업데이트

### 5. 캡션 마커 (Konva)

```typescript
// CaptionMarker.tsx
const CaptionMarker = memo(({ caption, zoom, onClick }) => {
  return (
    <Group
      x={caption.x}
      y={caption.y}
      onClick={onClick}
    >
      {/* 아바타 원 */}
      <Circle
        radius={16 / zoom}
        fill="#2563eb" // blue-600
        stroke="white"
        strokeWidth={2 / zoom}
      />
      {/* 이니셜 텍스트 */}
      <Text
        text={getInitial(caption.messages[0].authorName)}
        fill="white"
        fontSize={12 / zoom}
        align="center"
        verticalAlign="middle"
        offsetX={6 / zoom}
        offsetY={6 / zoom}
      />
      {/* 미해결 표시 (빨간 점) */}
      {!caption.isResolved && (
        <Circle
          x={12 / zoom}
          y={-12 / zoom}
          radius={4 / zoom}
          fill="#ef4444" // red-500
        />
      )}
    </Group>
  );
});
```

### 6. 캡션 팝업 스타일

```typescript
// CaptionPopup.tsx
<div className="fixed z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-200">
  {/* 헤더 */}
  <div className="flex items-center justify-between px-4 py-2 border-b">
    <span className="text-sm font-medium text-gray-600">댓글</span>
    <div className="flex items-center gap-1">
      <button>⋯</button> {/* 더보기 메뉴 */}
      <button>☑</button> {/* 해결 토글 */}
      <button>✕</button> {/* 닫기 */}
    </div>
  </div>

  {/* 메시지 목록 */}
  <div className="max-h-64 overflow-y-auto p-4 space-y-4">
    {messages.map(msg => <CaptionMessage key={msg.id} message={msg} />)}
  </div>

  {/* 입력창 */}
  <CaptionInput onSubmit={handleReply} />
</div>
```

### 7. 캡션 입력창 기능

```typescript
// CaptionInput.tsx
interface CaptionInputProps {
  onSubmit: (content: string, attachments?: CommentAttachment[]) => void;
  placeholder?: string;
}

// 기능:
// - 텍스트 입력
// - 😊 이모지 버튼 → EmojiPicker 팝업
// - @ 멘션 → 사용자 목록 드롭다운 (추후 구현 대비)
// - 📎 이미지 첨부 → 파일 선택 또는 Ctrl+V 붙여넣기
// - Enter로 전송, Shift+Enter로 줄바꿈
```

### 8. 우측 캡션 패널

```typescript
// CaptionPanel.tsx
<div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-40">
  {/* 헤더 */}
  <div className="p-4 border-b">
    <div className="flex items-center gap-2">
      <input
        type="search"
        placeholder="검색"
        className="flex-1 px-3 py-2 bg-gray-100 rounded-lg"
      />
      <button>≡</button> {/* 필터 */}
      <button>⋯</button> {/* 더보기 */}
      <button>✕</button> {/* 닫기 */}
    </div>
  </div>

  {/* 빈 상태 */}
  {captions.length === 0 && (
    <div className="p-8 text-center text-gray-500">
      피드백을 추가하거나, 질문을 하거나, 감사의 말을 남기세요.
      댓글을 남기려면 파일에서 아무 곳이나 클릭하세요.
    </div>
  )}

  {/* 캡션 목록 */}
  <div className="overflow-y-auto">
    {filteredCaptions.map(caption => (
      <CaptionPanelItem key={caption.id} caption={caption} />
    ))}
  </div>
</div>
```

### 9. 필터 기능

```typescript
type CaptionFilter = {
  showResolved: boolean;    // 해결된 캡션 표시
  onlyMyThreads: boolean;   // 내 스레드만
  sortBy: 'date' | 'unread'; // 정렬 기준
};

// 필터 드롭다운 옵션:
// - ☑ 해결된 캡션 표시
// - ☐ 내 스레드만
// - 정렬: 날짜순 / 읽지 않은 항목순
```

### 10. 데이터 저장

```typescript
// store.ts - persist 설정 수정
partialize: (state) => ({
  objects: state.objects,
  viewport: state.viewport,
  recentShapes: state.recentShapes,
  favoriteShapes: state.favoriteShapes,
  captions: state.captions,        // 추가
  currentUser: state.currentUser,  // 추가
}),
```

## Acceptance Criteria

### 기본 기능
- [ ] `C` 키 누르면 마우스 위치에 캡션 입력창 표시
- [ ] 캡션 입력 후 엔터 → 캔버스에 마커 추가, 패널에 목록 추가
- [ ] 캡션 마커 클릭 → 팝업으로 스레드 표시
- [ ] 팝업에서 답글 입력 가능

### 캡션 팝업
- [ ] 더보기 메뉴: 읽지 않음 표시, 링크 복사, 스레드 삭제
- [ ] 해결 버튼: 상태 토글
- [ ] 닫기 버튼

### 우측 패널
- [ ] 검색 기능: 캡션 내용으로 필터링
- [ ] 필터: 해결 캡션 / 내 스레드만 / 정렬
- [ ] 캡션 아이템 클릭 → 해당 위치로 이동 + 팝업 열기

### 입력창 기능
- [ ] 이모지 선택기
- [ ] 이미지 첨부 (파일 선택)
- [ ] Ctrl+V로 이미지 붙여넣기
- [ ] @멘션 UI (목업 사용자 목록)

### 저장
- [ ] localStorage에 캡션 데이터 저장
- [ ] 새로고침 후에도 유지

## Dependencies & Risks

### 의존성
- 기존 CursorChat 패턴 활용
- 플로팅 옵션바 위치 계산 로직 재사용
- Konva Group/Circle/Text 컴포넌트

### 리스크
- **성능**: 많은 캡션 마커가 있을 때 렌더링 최적화 필요
- **이미지 저장**: base64로 localStorage에 저장 시 용량 제한 (5-10MB)
- **Lock 모드**: 잠금 시 캡션 생성 비활성화 필요
- **줌 레벨**: 극단적 줌 아웃 시 마커 클릭 어려움

### 리스크 완화
- 캡션 마커에 `memo()` 적용
- 이미지 압축: 최대 1MB, 형식 제한 (PNG/JPG)
- 캡션 많을 때 뷰포트 밖 마커는 렌더링 스킵
- Lock 모드 시 C 키 비활성화 (기존 도구와 동일)
- 마커 최소 클릭 영역 보장 (16px 반경)

## Edge Cases & Validation

### 입력 검증
- 빈 캡션 허용 안 함 (whitespace만 있는 경우 포함)
- 최대 텍스트 길이: 2000자
- 최대 이미지 크기: 1MB
- 허용 이미지 형식: PNG, JPG, GIF

### 엣지 케이스 처리
- **화면 가장자리 입력**: 팝업이 화면 밖으로 나가지 않도록 위치 조정
- **캡션 삭제 확인**: 답글이 있는 캡션 삭제 시 확인 다이얼로그
- **동일 위치 캡션**: 여러 캡션이 겹치면 10px 오프셋으로 분리
- **ESC 취소**: 입력 중 ESC 시 빈 캡션 생성 안 함
- **클릭 외부**: 캡션 팝업 외부 클릭 시 닫기

### Lock 모드 동작
- C 키 비활성화
- 기존 캡션 마커 클릭/보기 가능 (읽기 전용)
- 답글 추가 불가

## Implementation Phases

### Phase 1: 기본 구조
- [ ] 타입 정의 (`types.ts`)
- [ ] Store 확장 (`store.ts`)
- [ ] 기본 컴포넌트 생성

### Phase 2: 캡션 생성 및 표시
- [ ] 키보드 단축키 연동 (C키 또는 대체키)
- [ ] CaptionMarker 컴포넌트 (Konva)
- [ ] CaptionPopup 컴포넌트
- [ ] CaptionInput 컴포넌트

### Phase 3: 우측 패널
- [ ] CaptionPanel 컴포넌트
- [ ] 검색 기능
- [ ] 필터 기능
- [ ] 캡션 클릭 시 위치 이동

### Phase 4: 고급 기능
- [ ] 이모지 선택기
- [ ] 이미지 첨부 및 붙여넣기
- [ ] @멘션 UI
- [ ] 더보기 메뉴 액션

### Phase 5: 마무리
- [ ] localStorage 저장 연동
- [ ] 성능 최적화
- [ ] 에러 처리

## File Changes

### 신규 파일
- `src/types.ts` - 타입 추가
- `src/components/captions/CaptionMarker.tsx`
- `src/components/captions/CaptionPopup.tsx`
- `src/components/captions/CaptionInput.tsx`
- `src/components/captions/CaptionMessage.tsx`
- `src/components/captions/CaptionPanel.tsx`
- `src/components/captions/CaptionPanelItem.tsx`
- `src/components/captions/CaptionFilters.tsx`
- `src/components/captions/EmojiPicker.tsx`

### 수정 파일
- `src/store.ts` - 캡션 상태 및 액션 추가
- `src/App.tsx` - 캡션 패널, 단축키 연동
- `src/components/Canvas.tsx` - CaptionMarker 렌더링
- `src/hooks/useKeyboardShortcuts.ts` - C키 핸들러

## References

### 내부 참조
- CursorChat 패턴: `src/components/CursorChat.tsx`
- 플로팅 옵션바: `src/components/TextOptionsBar.tsx`
- Store 패턴: `src/store.ts`
- 키보드 단축키: `src/hooks/useKeyboardShortcuts.ts`

### 외부 참조
- FigJam 댓글 시스템 UI (스크린샷 참고)
