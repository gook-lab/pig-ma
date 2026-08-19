# Embed Service Integrator

새로운 embed 서비스 지원을 일관되게 추가하는 에이전트.

## Trigger

- "YouTube/Figma/Notion 외에 [서비스] 지원 추가"
- "Loom embed 추가", "Miro embed 추가" 등

## Current Services

| Service | Color | Default Size | Notes |
|---------|-------|--------------|-------|
| YouTube | #FF0000 | 480x270 | `youtube-nocookie.com` (GDPR) |
| Figma | #F24E1E | 400x300 | `/design/`, `/file/`, `/board/`, `/proto/` 경로만 |
| Notion | #000000 | 400x320 | 페이지 공개 공유 필수 |

## Implementation Checklist (7 Files)

새 서비스 추가 시 아래 7개 파일을 순서대로 업데이트:

### 1. src/types.ts

```typescript
// EmbedType에 서비스 추가
export type EmbedType = "youtube" | "figma" | "notion" | "NEW_SERVICE";

// EmbedMetadata에 서비스별 속성 추가
export interface EmbedMetadata {
  // ... existing
  // NEW_SERVICE specific
  newServiceId?: string;
}
```

### 2. src/utils/embed.ts

```typescript
// 1. parseXxxUrl 함수 추가
export function parseNewServiceUrl(url: string): EmbedMetadata | null {
  if (!url.includes("newservice.com")) return null;
  // URL 파싱 로직
  return { newServiceId: extractedId };
}

// 2. parseEmbedUrl에 분기 추가
if (normalizedUrl.includes("newservice.com")) {
  const metadata = parseNewServiceUrl(normalizedUrl);
  if (metadata) {
    return { type: "newService", url: normalizedUrl, metadata };
  }
}

// 3. getEmbedIframeUrl에 iframe URL 생성 추가
if (embedType === "newService" && metadata.newServiceId) {
  return `https://newservice.com/embed/${metadata.newServiceId}`;
}

// 4. getEmbedTypeLabel에 케이스 추가 (자주 누락됨!)
case "newService":
  return "New Service";
```

### 3. src/utils/factory.ts

```typescript
// createEmbed 함수의 switch문에 크기 추가
case "newService":
  width = 480;
  height = 270;
  break;
```

### 4. src/components/shapes/Embed.tsx

```typescript
// SERVICE_COLORS에 추가
const SERVICE_COLORS: Record<string, string> = {
  // ...existing
  newService: "#XXXXXX", // 브랜드 색상
};

// displayTitle 로직에 추가
(embedType === "newService" ? "New Service Content" : "Unknown")

// 서비스 배지 width 조정
width={embedType === "newService" ? 80 : ...}

// 플레이스홀더 아이콘 추가 (Play icon / service icon 섹션)
```

### 5. src/components/EmbedOptionsBar.tsx

```typescript
// serviceLabel 추가
const serviceLabel = embedType === "newService" ? "New Service" : ...;

// serviceColor 추가
const serviceColor = embedType === "newService" ? "#XXXXXX" : ...;
```

### 6. src/components/EmbedViewerOverlay.tsx

```typescript
// 썸네일 플레이스홀더 추가
} else if (embedType === "newService") {
  return (
    <div className="flex items-center justify-center ...">
      {/* Service icon */}
    </div>
  );
}
```

### 7. src/components/EmbedUrlModal.tsx

```typescript
// Supported services 섹션에 추가
<div className="flex items-center gap-1">
  <ServiceIcon className="h-4 w-4" />
  <span>New Service</span>
</div>

// 에러 메시지 업데이트
setError("Please enter a valid YouTube, Figma, Notion, or New Service URL");

// placeholder 업데이트
placeholder="Paste YouTube, Figma, Notion, or New Service URL..."

// Help content에 URL 형식 추가
```

## Validation Checklist

- [ ] TypeScript 빌드 성공 (`npm run build`)
- [ ] URL 파싱 정상 동작
- [ ] iframe 로드 확인
- [ ] 서비스 배지/아이콘 표시
- [ ] 에러 메시지에 서비스명 포함
- [ ] getEmbedTypeLabel 케이스 추가됨

## Common Mistakes

1. **getEmbedTypeLabel 누락** - default로 fallback되어 "Embed"로 표시됨
2. **EmbedUrlModal 텍스트 미업데이트** - 에러 메시지/placeholder에 새 서비스 미포함
3. **SERVICE_COLORS 누락** - undefined로 fallback되어 회색 표시

## Reference

- Embed 구현: `src/utils/embed.ts`
- Konva 컴포넌트: `src/components/shapes/Embed.tsx`
- HTML 오버레이: `src/components/EmbedViewerOverlay.tsx`
- 옵션 바: `src/components/EmbedOptionsBar.tsx`
- URL 모달: `src/components/EmbedUrlModal.tsx`
