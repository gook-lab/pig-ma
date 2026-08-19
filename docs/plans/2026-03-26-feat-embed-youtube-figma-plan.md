---
title: "feat: Add Embed Support for YouTube and Figma"
type: feat
status: active
date: 2026-03-26
origin: docs/brainstorms/2026-03-26-embed-feature-brainstorm.md
deepened: 2026-03-26
---

# feat: Add Embed Support for YouTube and Figma

## Enhancement Summary

**Deepened on:** 2026-03-26
**Research agents used:** YouTube embed, iframe security, Figma embed, React lazy loading

### Key Improvements
1. **YouTube URL 파싱 강화** - Shorts, Live, Playlist, 타임스탬프 지원
2. **Privacy-enhanced mode** - `youtube-nocookie.com` 도메인 사용
3. **Facade 패턴** - 성능 224배 향상 (1.3-2.6MB 절약)
4. **보안 강화** - YouTube/Figma별 최적화된 iframe 속성

### New Considerations Discovered
- YouTube `modestbranding` 파라미터 deprecated (2023년 8월)
- Figma 비밀번호 보호 파일은 임베드 불가
- 메모리 관리: 뷰포트 이탈 시 iframe 정리 필요

## Overview

캔버스에 외부 콘텐츠(YouTube, Figma)를 임베드할 수 있는 기능 추가. URL 붙여넣기로 자동 감지하거나 툴바에서 명시적으로 추가 가능.

## Problem Statement / Motivation

현재 캔버스에서 외부 콘텐츠를 참조하려면 이미지로 캡처하거나 텍스트로 URL을 남겨야 함. 실시간 미리보기와 재생이 불가능하여 프레젠테이션, 협업, 레퍼런스 수집 시 불편함.

## Proposed Solution

단일 `embed` ObjectType으로 YouTube, Figma 등 외부 콘텐츠 임베드 지원. CodeBlock 패턴(Konva + HTML Overlay)을 따라 구현.

**핵심 기능:**
- URL 붙여넣기 시 자동 감지 → 임베드 카드 생성
- 툴바 버튼으로 명시적 추가
- 썸네일 카드 기본 표시 → 클릭 시 iframe 활성화 (성능 최적화)

(see brainstorm: docs/brainstorms/2026-03-26-embed-feature-brainstorm.md)

## Technical Approach

### Phase 1: 타입 및 팩토리 (Foundation)

#### 1.1 types.ts 확장

```typescript
// types.ts

// ObjectType에 추가
export type ObjectType =
  | ...
  | "embed";

// Tool에 추가
export type Tool =
  | ...
  | "embed";

// 새 타입 정의
export type EmbedType = "youtube" | "figma";

export interface EmbedMetadata {
  title?: string;
  thumbnailUrl?: string;
  // YouTube
  videoId?: string;
  startTime?: number;      // 초 단위 (타임스탬프)
  // Figma
  fileKey?: string;
  fileName?: string;
  nodeId?: string;         // 특정 프레임 ID
  figmaType?: "design" | "board" | "proto";
}

// CanvasObject에 속성 추가
export interface CanvasObject {
  // ... existing
  embedUrl?: string;
  embedType?: EmbedType;
  embedMetadata?: EmbedMetadata;
  isPlaying?: boolean;   // iframe 활성화 여부
}
```

- [x] `types.ts`: ObjectType에 "embed" 추가
- [x] `types.ts`: Tool에 "embed" 추가
- [x] `types.ts`: EmbedType, EmbedMetadata 타입 정의
- [x] `types.ts`: CanvasObject에 embed 관련 속성 추가

#### 1.2 factory.ts - createEmbed 함수

```typescript
// factory.ts

export function createEmbed(
  x: number,
  y: number,
  url: string,
  embedType: EmbedType,
  metadata: EmbedMetadata,
  author?: AuthorInfo,
): CanvasObject {
  // YouTube는 16:9, Figma는 4:3 기본값
  const isYoutube = embedType === "youtube";
  const width = isYoutube ? 480 : 400;
  const height = isYoutube ? 270 : 300;

  return {
    id: nanoid(),
    type: "embed",
    x: snapToGrid(x),
    y: snapToGrid(y),
    width,
    height,
    embedUrl: url,
    embedType,
    embedMetadata: metadata,
    isPlaying: false,
    rotation: 0,
    opacity: 1,
    authorId: author?.authorId,
    authorName: author?.authorName,
  };
}
```

- [x] `factory.ts`: createEmbed 함수 구현
- [x] `factory.ts`: YouTube 16:9 (480x270), Figma 4:3 (400x300) 기본 크기

#### 1.3 URL 파싱 유틸리티

```typescript
// utils/embed.ts

interface YouTubeParseResult {
  videoId: string;
  startTime?: number;  // 초 단위
  isShorts: boolean;
  isLive: boolean;
}

export function parseYouTubeUrl(url: string): YouTubeParseResult | null {
  try {
    const urlObj = new URL(url.trim().startsWith("http") ? url : `https://${url}`);
    const hostname = urlObj.hostname.replace("www.", "");
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // 유효한 YouTube 도메인 확인
    const validDomains = ["youtube.com", "youtu.be", "youtube-nocookie.com", "m.youtube.com"];
    if (!validDomains.some((d) => hostname.includes(d))) return null;

    let videoId: string | null = null;
    let isShorts = false;
    let isLive = false;

    // youtu.be 짧은 URL
    if (hostname === "youtu.be") {
      videoId = pathname.slice(1).split("/")[0];
    }
    // /shorts/ URL
    else if (pathname.startsWith("/shorts/")) {
      videoId = pathname.split("/shorts/")[1]?.split(/[/?]/)[0];
      isShorts = true;
    }
    // /live/ URL
    else if (pathname.startsWith("/live/")) {
      videoId = pathname.split("/live/")[1]?.split(/[/?]/)[0];
      isLive = true;
    }
    // /embed/ URL
    else if (pathname.startsWith("/embed/")) {
      videoId = pathname.split("/embed/")[1]?.split(/[/?]/)[0];
    }
    // 표준 watch URL
    else if (pathname === "/watch") {
      videoId = searchParams.get("v");
    }

    // Video ID 유효성 검사 (11자 영숫자 + 하이픈/언더스코어)
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;

    // 타임스탬프 파싱
    const timeParam = searchParams.get("t") || searchParams.get("start");
    const startTime = timeParam ? parseYouTubeTime(timeParam) : undefined;

    return { videoId, startTime, isShorts, isLive };
  } catch {
    return null;
  }
}

function parseYouTubeTime(timeStr: string): number {
  // 초 단위 숫자 (예: "120")
  if (/^\d+$/.test(timeStr)) return parseInt(timeStr, 10);

  // "2m30s" 또는 "1h2m30s" 형식
  const match = timeStr.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (match) {
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

interface FigmaParseResult {
  fileKey: string;
  type: "design" | "board" | "proto";
  fileName?: string;
  nodeId?: string;
}

export function parseFigmaUrl(url: string): FigmaParseResult | null {
  // Design, Board, Proto, File URL 지원
  const regex = /figma\.com\/(design|board|proto|file)\/([a-zA-Z0-9]+)(?:\/([^?]+))?/;
  const match = url.match(regex);
  if (!match) return null;

  const type = match[1] === "file" ? "design" : (match[1] as "design" | "board" | "proto");
  const fileKey = match[2];
  const fileName = match[3]
    ? decodeURIComponent(match[3].replace(/-/g, " "))
    : "Figma Design";

  // node-id 추출
  const nodeIdMatch = url.match(/node-id=([^&]+)/);
  const nodeId = nodeIdMatch?.[1];

  return { fileKey, type, fileName, nodeId };
}

export function parseEmbedUrl(url: string): {
  type: EmbedType;
  metadata: EmbedMetadata;
} | null {
  // YouTube
  const youtube = parseYouTubeUrl(url);
  if (youtube) {
    return {
      type: "youtube",
      metadata: {
        videoId: youtube.videoId,
        thumbnailUrl: `https://i.ytimg.com/vi/${youtube.videoId}/hqdefault.jpg`,
        startTime: youtube.startTime,
      },
    };
  }

  // Figma
  const figma = parseFigmaUrl(url);
  if (figma) {
    return {
      type: "figma",
      metadata: {
        fileKey: figma.fileKey,
        fileName: figma.fileName,
        nodeId: figma.nodeId,
        figmaType: figma.type,
      },
    };
  }

  return null;
}

export function getEmbedIframeUrl(embedType: EmbedType, metadata: EmbedMetadata): string {
  if (embedType === "youtube" && metadata.videoId) {
    // Privacy-enhanced mode 사용
    const params = new URLSearchParams({
      autoplay: "1",
      rel: "0",           // 같은 채널 영상만 추천
      playsinline: "1",   // iOS 인라인 재생
    });
    if (metadata.startTime) {
      params.set("start", String(metadata.startTime));
    }
    return `https://www.youtube-nocookie.com/embed/${metadata.videoId}?${params}`;
  }

  if (embedType === "figma" && metadata.fileKey) {
    const figmaType = metadata.figmaType || "design";
    const params = new URLSearchParams({
      "embed-host": "canvas-app",
    });
    if (metadata.nodeId) {
      params.set("node-id", metadata.nodeId);
    }
    return `https://embed.figma.com/${figmaType}/${metadata.fileKey}?${params}`;
  }

  return "";
}
```

### Research Insights: URL 파싱

**Best Practices:**
- YouTube Shorts, Live, 타임스탬프 등 모든 URL 형식 지원
- Video ID 11자 유효성 검사 필수
- `youtube-nocookie.com` 사용으로 GDPR 준수

**Edge Cases:**
- `youtube.com/shorts/` - Shorts 영상
- `youtube.com/live/` - 라이브 스트림
- `?t=2m30s` - 시간 포맷 파싱 (h/m/s)
- `figma.com/board/` - FigJam 보드

- [x] `utils/embed.ts`: parseYouTubeUrl 함수 (Shorts, Live, 타임스탬프 지원)
- [x] `utils/embed.ts`: parseFigmaUrl 함수 (Design, Board, Proto 지원)
- [x] `utils/embed.ts`: parseEmbedUrl 통합 함수
- [x] `utils/embed.ts`: getEmbedIframeUrl 함수 (privacy-enhanced mode)

#### 1.4 store/index.ts - equality 함수 업데이트

```typescript
// store/index.ts - temporal equality 함수에 추가

// Embed specific
if (obj.type === "embed") {
  if (pastObj.embedUrl !== obj.embedUrl) return false;
  if (pastObj.embedType !== obj.embedType) return false;
  if (pastObj.isPlaying !== obj.isPlaying) return false;
  if (JSON.stringify(pastObj.embedMetadata) !== JSON.stringify(obj.embedMetadata)) return false;
}
```

- [x] `store/index.ts`: equality 함수에 embed 속성 비교 추가

### Phase 2: 컴포넌트 (Core Implementation)

#### 2.1 shapes/Embed.tsx - Konva 컴포넌트

```typescript
// shapes/Embed.tsx
// CodeBlock.tsx 패턴 따름

export const Embed = memo(function Embed({
  shape,
  isSelected,
  onSelect,
  onDragEnd,
  // ...
}: ShapeProps) {
  const isYoutube = shape.embedType === "youtube";
  const headerHeight = 32;

  return (
    <Group
      x={shape.x}
      y={shape.y}
      draggable
      onClick={onSelect}
      onDragEnd={onDragEnd}
    >
      {/* 배경 */}
      <Rect
        width={shape.width}
        height={shape.height}
        fill="#1a1a1a"
        cornerRadius={8}
      />

      {/* 헤더 */}
      <Rect
        width={shape.width}
        height={headerHeight}
        fill="#2d2d2d"
        cornerRadius={[8, 8, 0, 0]}
      />

      {/* 서비스 아이콘 + 제목 */}
      <Text
        x={12}
        y={8}
        text={isYoutube ? "YouTube" : "Figma"}
        fontSize={14}
        fill="#ffffff"
      />

      {/* 썸네일 영역은 HTML Overlay에서 렌더링 */}

      {/* 선택 테두리 */}
      {isSelected && <SelectionBorder ... />}
    </Group>
  );
});
```

- [x] `shapes/Embed.tsx`: Konva 컴포넌트 (프레임, 헤더)
- [x] `shapes/Embed.tsx`: YouTube/Figma 아이콘 구분
- [x] `shapes/Embed.tsx`: SelectionBorder 적용

#### 2.2 EmbedViewerOverlay.tsx - HTML 오버레이

```typescript
// components/EmbedViewerOverlay.tsx
// CodeBlockViewerOverlay.tsx 패턴 따름

export function EmbedViewerOverlay({
  shape,
  viewport,
  zIndex,
  isDragging,
}: EmbedViewerOverlayProps) {
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // 드래그 중 위치 추적
  useEffect(() => {
    if (!isDragging) {
      setDragPosition(null);
      return;
    }
    return dragCoordinator.subscribe(shape.id, setDragPosition);
  }, [isDragging, shape.id]);

  const x = dragPosition?.x ?? shape.x;
  const y = dragPosition?.y ?? shape.y;

  const screenX = x * viewport.zoom + viewport.x;
  const screenY = y * viewport.zoom + viewport.y;
  const headerHeight = 32;

  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: screenX,
        top: screenY + headerHeight * viewport.zoom,
        width: shape.width,
        height: shape.height - headerHeight,
        transform: `scale(${viewport.zoom})`,
        transformOrigin: "top left",
        zIndex,
      }}
    >
      {shape.isPlaying ? (
        <EmbedIframe embedType={shape.embedType!} metadata={shape.embedMetadata!} />
      ) : (
        <EmbedThumbnail shape={shape} />
      )}
    </div>
  );
}

function EmbedThumbnail({ shape }: { shape: CanvasObject }) {
  const { updateObject } = useCanvasStore();

  const handleClick = () => {
    updateObject(shape.id, { isPlaying: true });
  };

  if (shape.embedType === "youtube") {
    return (
      <div
        className="relative h-full w-full cursor-pointer"
        onClick={handleClick}
      >
        <img
          src={shape.embedMetadata?.thumbnailUrl}
          className="h-full w-full object-cover"
          alt="YouTube thumbnail"
        />
        {/* Play 버튼 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="h-16 w-16 text-white" />
        </div>
      </div>
    );
  }

  // Figma - 아이콘 + 파일명
  return (
    <div
      className="flex h-full w-full cursor-pointer flex-col items-center justify-center bg-gray-800"
      onClick={handleClick}
    >
      <FigmaIcon className="h-16 w-16 text-white" />
      <span className="mt-2 text-sm text-gray-300">
        {shape.embedMetadata?.fileName || "Figma Design"}
      </span>
      <span className="mt-1 text-xs text-gray-500">Click to load</span>
    </div>
  );
}
```

### Research Insights: iframe 보안

**YouTube iframe 권장 설정:**
```tsx
// YouTube는 sandbox 사용하지 않음 (API 호환성 문제)
<iframe
  src={youtubeEmbedUrl}
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowFullScreen
  referrerPolicy="strict-origin-when-cross-origin"
/>
```

**Figma iframe 권장 설정:**
```tsx
// Figma는 선택적 sandbox 적용 가능
<iframe
  src={figmaEmbedUrl}
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  allow="fullscreen; clipboard-write"
  allowFullScreen
  referrerPolicy="strict-origin-when-cross-origin"
/>
```

**EmbedIframe 컴포넌트:**
```tsx
function EmbedIframe({ embedType, metadata }: EmbedIframeProps) {
  const src = getEmbedIframeUrl(embedType, metadata);

  if (embedType === "youtube") {
    return (
      <iframe
        src={src}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  // Figma
  return (
    <iframe
      src={src}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      allow="fullscreen; clipboard-write"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
```

**Security Considerations:**
- YouTube: `sandbox` 사용 시 플레이어 기능 작동 안 함
- Figma: 비밀번호 보호 파일은 임베드 불가
- `referrerPolicy="strict-origin-when-cross-origin"` 권장

- [x] `EmbedViewerOverlay.tsx`: HTML 오버레이 컴포넌트
- [x] `EmbedViewerOverlay.tsx`: CSS transform scale() 줌 처리
- [x] `EmbedViewerOverlay.tsx`: dragCoordinator 연동
- [x] `EmbedViewerOverlay.tsx`: 썸네일 → iframe 전환 로직
- [x] `EmbedViewerOverlay.tsx`: YouTube 썸네일 + Play 버튼
- [x] `EmbedViewerOverlay.tsx`: Figma 아이콘 + 파일명
- [x] `EmbedViewerOverlay.tsx`: YouTube/Figma별 iframe 보안 속성 분리

#### 2.3 EmbedEditor.tsx - 옵션 바

```typescript
// components/EmbedEditor.tsx

export function EmbedEditor() {
  const { objects, selectedIds, updateObject, deleteObjects } = useCanvasStore();

  const selectedEmbed = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const obj = objects.find((o) => o.id === selectedIds[0]);
    if (!obj || obj.type !== "embed") return null;
    return obj;
  }, [objects, selectedIds]);

  if (!selectedEmbed) return null;

  return (
    <EmbedOptionsBar
      embed={selectedEmbed}
      onOpenUrl={() => window.open(selectedEmbed.embedUrl, "_blank")}
      onTogglePlay={() => updateObject(selectedEmbed.id, {
        isPlaying: !selectedEmbed.isPlaying
      })}
      onDelete={() => deleteObjects([selectedEmbed.id])}
    />
  );
}
```

- [x] `EmbedEditor.tsx`: 선택 필터링, 옵션 바 렌더링
- [x] `EmbedOptionsBar.tsx`: URL 열기, 재생/중지 토글, 삭제 버튼

#### 2.4 Canvas.tsx 수정

```typescript
// Canvas.tsx

// 1. Embed 렌더링 추가 (objectsInFrontOfGroups에서)
case "embed":
  return (
    <Embed
      key={obj.id}
      shape={obj}
      isSelected={selectedIds.includes(obj.id)}
      onSelect={handleSelect}
      onDragEnd={handleDragEnd}
      // ...
    />
  );

// 2. EmbedViewerOverlay 렌더링 추가
{objects
  .map((obj, actualIndex) => ({ obj, actualIndex }))
  .filter(
    ({ obj }) =>
      obj.type === "embed" &&
      (obj.zIndex ?? 0) >= 0 &&
      !hiddenGroupIds.has(obj.groupId ?? "") &&
      isInViewport(obj, viewport, window.innerWidth, window.innerHeight),
  )
  .map(({ obj, actualIndex }) => (
    <EmbedViewerOverlay
      key={`embed-view-${obj.id}`}
      shape={obj}
      viewport={viewport}
      zIndex={getCanvasOverlayZIndex(actualIndex)}
      isDragging={draggingIds.includes(obj.id)}
    />
  ))}

// 3. URL 붙여넣기 감지 (handlePaste 함수)
const handlePaste = useCallback((e: ClipboardEvent) => {
  // 텍스트 편집 중이면 스킵
  if (editingTextId) return;

  const text = e.clipboardData?.getData("text/plain");
  if (!text) return;

  const embedData = parseEmbedUrl(text);
  if (embedData) {
    e.preventDefault();
    const mousePos = getMousePosition(); // 현재 마우스 위치
    const embed = createEmbed(
      mousePos.x,
      mousePos.y,
      text,
      embedData.type,
      embedData.metadata,
      { authorId, authorName }
    );
    addObjects([embed]);
  }
}, [editingTextId, addObjects, authorId, authorName]);
```

- [x] `Canvas.tsx`: Embed 컴포넌트 렌더링 추가
- [x] `Canvas.tsx`: EmbedViewerOverlay 렌더링 추가
- [x] `Canvas.tsx`: URL 붙여넣기 감지 및 자동 임베드 생성 (useKeyboardShortcuts.ts에 구현)

### Phase 3: 툴바 및 마무리 (Polish)

#### 3.1 Toolbar.tsx - 임베드 버튼

```typescript
// Toolbar.tsx

// 버튼 추가
<ToolbarButton
  icon={<Link2 />}
  label="Embed"
  isActive={tool === "embed"}
  onClick={() => setTool("embed")}
/>

// embed 도구 선택 시 모달 표시
{tool === "embed" && (
  <EmbedUrlModal
    onSubmit={(url) => {
      const embedData = parseEmbedUrl(url);
      if (embedData) {
        // 캔버스 중앙에 생성
        const embed = createEmbed(...);
        addObjects([embed]);
      }
      setTool("select");
    }}
    onClose={() => setTool("select")}
  />
)}
```

- [x] `Toolbar.tsx`: Embed 버튼 추가 (Link2 아이콘)
- [x] `EmbedUrlModal.tsx`: URL 입력 모달 컴포넌트

#### 3.2 리사이즈 비율 유지

```typescript
// useObjectResize.ts 또는 Canvas.tsx

// YouTube는 16:9 비율 유지, Figma는 자유
const maintainAspectRatio = (obj: CanvasObject) => {
  if (obj.type === "embed" && obj.embedType === "youtube") {
    return 16 / 9;
  }
  return null; // 자유 비율
};
```

- [ ] YouTube 리사이즈 시 16:9 비율 유지
- [ ] Figma는 자유 리사이즈

#### 3.3 성능 최적화: 메모리 관리

### Research Insights: Lazy Loading & Memory

**캔버스 앱 특화 고려사항:**
- iframe 생성 시마다 메모리 증가 (1.3-2.6MB per YouTube embed)
- 뷰포트 이탈 시 리소스 정리 필요
- 여러 임베드가 있을 때 성능 저하 방지

```typescript
// EmbedViewerOverlay.tsx - 뷰포트 이탈 시 정리
useEffect(() => {
  if (!isInViewport && iframeRef.current) {
    try {
      // 미디어 일시정지 시도
      iframeRef.current.contentWindow?.postMessage({ type: "pause" }, "*");
    } catch (e) {
      // cross-origin 무시
    }
  }
}, [isInViewport]);

// 컴포넌트 언마운트 시 정리
useEffect(() => {
  return () => {
    if (iframeRef.current) {
      iframeRef.current.src = "about:blank";
    }
  };
}, []);
```

**Performance Targets:**
- LCP < 1.5s (썸네일 로드)
- iframe 전환 < 1s
- 10개 임베드 동시 표시 시 60fps 유지
- 메모리 증가 < 50MB (10개 임베드)

- [ ] 뷰포트 밖 임베드는 썸네일만 표시 (iframe 미로드)
- [ ] `isPlaying` → `false` 시 iframe 정리
- [ ] 캔버스 이탈 시 미디어 일시정지

#### 3.4 기타

- [x] `index.ts`: export 추가 (createEmbed, Embed, EmbedViewerOverlay 등)
- [ ] `.claude/rules/store.md`: embed 속성 테이블에 추가

## Acceptance Criteria

### Functional Requirements

- [x] YouTube URL 붙여넣기 → 썸네일 카드 자동 생성
- [x] Figma URL 붙여넣기 → Figma 카드 자동 생성
- [x] 툴바 Embed 버튼 → URL 입력 모달 → 카드 생성
- [x] 썸네일 클릭 → iframe 활성화 (YouTube 재생, Figma 로드)
- [x] 드래그, 리사이즈, 회전 정상 동작
- [x] 선택, 복사/붙여넣기, 삭제 정상 동작
- [x] Undo/Redo 지원

### Non-Functional Requirements

- [x] 여러 임베드가 있어도 성능 저하 없음 (썸네일만 로드)
- [x] iframe sandbox 속성으로 보안 강화
- [x] z-index 10-39 범위 내 렌더링

## Success Metrics

- YouTube/Figma URL 인식률 100%
- 썸네일 → iframe 전환 1초 이내
- 10개 임베드 동시 표시 시 60fps 유지

## Dependencies & Risks

**Dependencies:**
- YouTube 썸네일 API (공개, 안정적)
  - `hqdefault.jpg` 항상 존재
  - `maxresdefault.jpg`는 일부 영상에서 없을 수 있음 → fallback 구현
- Figma embed API (공개, 안정적)
  - `embed-host` 파라미터 필수
  - node-id로 특정 프레임 지정 가능

**Risks:**

| 위험 | 영향 | 대응 |
|------|------|------|
| Figma 비밀번호 보호 | 임베드 불가 | 에러 메시지 + 원본 링크 제공 |
| Figma 조직 전용 파일 | 로그인 필요 | `LOGIN_SCREEN_SHOWN` 이벤트 감지 |
| YouTube 연령 제한 | 로그인 필요 | 썸네일은 표시, 재생 시 안내 |
| YouTube Shorts 세로 비율 | 16:9 강제 시 여백 | isShorts 플래그로 9:16 비율 적용 |
| maxresdefault 없음 | 썸네일 404 | `onError` → hqdefault fallback |

**Mitigation:**
```tsx
// 썸네일 fallback
<img
  src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
  onError={(e) => {
    e.currentTarget.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }}
/>
```

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-26-embed-feature-brainstorm.md](docs/brainstorms/2026-03-26-embed-feature-brainstorm.md)
- Key decisions: 단일 embed ObjectType, 썸네일+클릭재생, CodeBlock 패턴

### Internal References

- CodeBlock 패턴: `src/components/shapes/CodeBlock.tsx`
- HTML Overlay: `src/components/CodeBlockViewerOverlay.tsx`
- Editor 패턴: `src/components/CodeBlockEditor.tsx`
- z-index 상수: `src/constants/zIndex.ts`
- Paste 처리: `src/components/captions/CaptionInput.tsx`

### External References

- YouTube embed: https://developers.google.com/youtube/player_parameters
- YouTube iframe API: https://developers.google.com/youtube/iframe_api_reference
- Figma embed: https://developers.figma.com/docs/embeds/embed-figma-file/
- Figma embed API (이벤트): https://developers.figma.com/docs/embeds/embed-api/
- lite-youtube-embed (Facade 패턴): https://github.com/nickerkkk/lite-youtube-embed
- iframe 보안: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe
