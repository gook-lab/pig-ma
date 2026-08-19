---
title: Embed Feature - YouTube, Figma, Link Preview
date: 2026-03-26
status: complete
---

# Embed Feature Brainstorm

## What We're Building

캔버스에 외부 콘텐츠(YouTube, Figma 등)를 임베드할 수 있는 기능.

### 핵심 기능
- **URL 붙여넣기 자동 감지**: Cmd+V로 URL 붙이면 임베드 카드 자동 생성
- **툴바 버튼**: 임베드 도구 선택 후 URL 입력 모달
- **썸네일 카드**: 기본은 썸네일 + 메타정보 표시
- **클릭 시 재생**: 썸네일 클릭하면 실제 iframe 로드

### MVP 지원 서비스
1. **YouTube**: 영상 썸네일 + 제목, 클릭 시 재생
2. **Figma**: 파일/프로토타입 미리보기

### 향후 확장 (Out of Scope)
- Twitter/X 트윗
- GitHub 저장소/이슈
- Notion 페이지
- 일반 링크 Open Graph 미리보기

## Why This Approach

### 단일 Embed ObjectType 선택 이유
CodeBlock이 `codeLanguage`로 21개 언어를 처리하듯이, `embedType`으로 서비스를 구분.

**장점:**
- 새 서비스 추가 시 타입만 추가하면 됨
- 공통 로직 재사용 (드래그, 리사이즈, 선택)
- 코드베이스 단순화

**대안 (타입별 분리) 기각 이유:**
- 파일 수 증가 (youtube.tsx, figma.tsx, ...)
- 공통 로직 중복
- 새 서비스마다 전체 파이프라인 수정 필요

### 썸네일 + 클릭 재생 선택 이유
- **성능**: 여러 임베드가 있어도 iframe 미로드로 빠름
- **UX**: 사용자가 원할 때만 콘텐츠 로드
- **배터리/네트워크**: 불필요한 리소스 사용 방지

## Key Decisions

| 결정 | 선택 | 이유 |
|------|------|------|
| ObjectType | 단일 `embed` | CodeBlock 패턴, 확장성 |
| 생성 방식 | 붙여넣기 + 툴바 | 편의성 + 명시적 옵션 |
| 렌더링 | 썸네일 → 클릭 시 iframe | 성능 최적화 |
| YouTube 비율 | 16:9 고정 | 영상 표준 비율 |
| Figma 비율 | 자유 리사이즈 | 디자인 파일 특성 |
| 아키텍처 | Konva + HTML Overlay | CodeBlock 패턴 따름 |

## Technical Approach

### 새로운 타입 정의

```typescript
// types.ts
type EmbedType = "youtube" | "figma";

interface EmbedMetadata {
  title?: string;
  thumbnailUrl?: string;
  videoId?: string;      // YouTube
  fileKey?: string;      // Figma
}

// CanvasObject 확장
embedUrl?: string;
embedType?: EmbedType;
embedMetadata?: EmbedMetadata;
isPlaying?: boolean;     // iframe 활성화 여부
```

### 컴포넌트 구조

```
shapes/Embed.tsx           # Konva 프레임 (썸네일, 헤더)
EmbedViewerOverlay.tsx     # HTML 오버레이 (썸네일 또는 iframe)
EmbedEditor.tsx            # 옵션 바
```

### URL 파싱 로직

```typescript
// YouTube
// https://www.youtube.com/watch?v=VIDEO_ID
// https://youtu.be/VIDEO_ID
const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;

// Figma
// https://www.figma.com/file/FILE_KEY/...
// https://www.figma.com/design/FILE_KEY/...
const figmaRegex = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/;
```

### 썸네일 URL 생성

```typescript
// YouTube 썸네일
`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

// Figma 썸네일 (API 필요 또는 기본 아이콘)
// Figma는 공개 썸네일 API가 없어서 기본 Figma 아이콘 사용
```

## Resolved Questions

1. **Figma 썸네일**: 공개 API 없음
   - **결정**: 기본 Figma 아이콘 + 파일명 표시

2. **URL 붙여넣기 위치**
   - **결정**: 마우스 위치 (다른 객체와 동일)

## Success Criteria

- [ ] YouTube URL 붙여넣기 → 썸네일 카드 생성
- [ ] Figma URL 붙여넣기 → Figma 카드 생성
- [ ] 썸네일 클릭 → iframe 활성화 (YouTube 재생, Figma 표시)
- [ ] 드래그, 리사이즈, 선택 정상 동작
- [ ] Undo/Redo 지원

## Related Files

| 파일 | 역할 |
|------|------|
| `types.ts` | EmbedType, 메타데이터 타입 추가 |
| `factory.ts` | createEmbed 함수 |
| `shapes/Embed.tsx` | Konva 컴포넌트 |
| `EmbedViewerOverlay.tsx` | HTML 오버레이 |
| `EmbedEditor.tsx` | 옵션 바 |
| `Canvas.tsx` | 렌더링 + 붙여넣기 핸들링 |
| `Toolbar.tsx` | 임베드 버튼 |
| `store/index.ts` | equality 함수에 embed 속성 추가 |
