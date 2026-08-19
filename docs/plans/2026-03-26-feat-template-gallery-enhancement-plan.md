---
title: "feat: Template Gallery Enhancement"
type: feat
status: completed
date: 2026-03-26
deepened: 2026-03-26
---

# feat: Template Gallery Enhancement

## Enhancement Summary

**Deepened on:** 2026-03-26
**Sections enhanced:** 6
**Research agents used:** TypeScript Reviewer, Performance Oracle, Security Sentinel, Code Simplicity Reviewer, Architecture Strategist, Pattern Recognition, Best Practices Researcher, Framework Docs Researcher

### Key Improvements
1. localStorage 용량 제한 가드레일 추가 (5MB 한계 대응)
2. 보안 강화: XSS 방지, 프로토타입 오염 방지
3. 타입 안전성 개선: const assertion 패턴, 명시적 인터페이스

### New Considerations Discovered
- SVG 썸네일 XSS 취약점 (DOMPurify 필요)
- `templatesByCategory` 초기 객체에 `retro: []`, `todo: []` 추가 필요 (기존 계획에서 누락)
- `expandedCategories` 초기값 변경은 선택적 (새 카테고리는 닫힌 상태로 시작해도 무방)

---

## Overview

템플릿 갤러리 기능을 완성하기 위한 버그 수정 및 기능 추가. 기존 구현의 localStorage 영속화 버그를 수정하고, 새로운 카테고리(retro, todo)와 빌트인 템플릿을 추가합니다.

## Problem Statement / Motivation

현재 템플릿 갤러리의 핵심 기능은 구현되어 있으나 두 가지 문제가 있습니다:

1. **사용자 데이터 유실 버그**: `customTemplates`와 `recentTemplates`가 localStorage에 저장되지 않아 새로고침 시 유실됨
2. **카테고리 부족**: 팀 협업 워크샵용 `retro`, 개인 생산성용 `todo` 카테고리 미구현

## Proposed Solution

### Phase 1: localStorage 영속화 버그 수정 (Critical)

`store/index.ts`의 `partialize` 함수에 누락된 필드 추가:

```typescript
// store/index.ts:480-496
partialize: (state) => ({
  // ... existing fields
  favoriteTemplates: state.favoriteTemplates,
  customTemplates: state.customTemplates,    // 추가
  recentTemplates: state.recentTemplates,    // 추가
}),
```

#### Research Insights

**Type Safety (TypeScript Reviewer):**
```typescript
// 명시적 타입 정의 권장
interface PersistedTemplateState {
  favoriteTemplates: string[];
  customTemplates: TemplateDefinition[];
  recentTemplates: string[];
}

partialize: (state): PersistedTemplateState => ({
  favoriteTemplates: state.favoriteTemplates,
  customTemplates: state.customTemplates,
  recentTemplates: state.recentTemplates,
}),
```

**Performance Guardrails (Performance Oracle):**
```typescript
// constants/template.ts - 용량 제한 상수 추가 권장
export const TEMPLATE_LIMITS = {
  maxTemplates: 20,           // 최대 커스텀 템플릿 수
  maxObjectsPerTemplate: 50,  // 템플릿당 최대 객체 수
  maxTotalSizeBytes: 3 * 1024 * 1024, // 3MB (5MB 한계의 60%)
} as const;

// 저장 전 검증 함수
export function canAddTemplate(
  existingTemplates: TemplateDefinition[],
  newTemplate: TemplateDefinition
): { allowed: boolean; reason?: string } {
  if (existingTemplates.length >= TEMPLATE_LIMITS.maxTemplates) {
    return { allowed: false, reason: "Maximum templates reached" };
  }
  if (newTemplate.objects.length > TEMPLATE_LIMITS.maxObjectsPerTemplate) {
    return { allowed: false, reason: "Too many objects in template" };
  }
  return { allowed: true };
}
```

**QuotaExceeded Error Handling (Best Practices):**
```typescript
// localStorage 저장 실패 시 에러 처리
try {
  localStorage.setItem(key, JSON.stringify(value));
} catch (e) {
  if (e instanceof DOMException && e.name === "QuotaExceededError") {
    console.warn("[Storage] 용량 초과 - 오래된 템플릿 정리 필요");
    // UI에 경고 표시
  }
}
```

### Phase 2: 새 카테고리 추가

#### 2.1 타입 정의 확장

```typescript
// types.ts
export type TemplateCategory =
  | "flowchart"
  | "wireframe"
  | "orgChart"
  | "mindMap"
  | "kanban"
  | "timeline"
  | "brainstorm"
  | "retro"     // 추가
  | "todo"      // 추가
  | "custom";
```

#### Research Insights

**Const Assertion Pattern (TypeScript Reviewer, Framework Docs):**
```typescript
// 향후 개선: 단일 소스로 타입과 메타데이터 통합
export const TEMPLATE_CATEGORIES = [
  "flowchart", "wireframe", "orgChart", "mindMap",
  "kanban", "timeline", "brainstorm", "retro", "todo", "custom",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

// 런타임 타입 가드
export function isTemplateCategory(value: unknown): value is TemplateCategory {
  return TEMPLATE_CATEGORIES.includes(value as TemplateCategory);
}
```

**Naming Convention (Pattern Recognition):**
- `retro`, `todo` (lowercase) - 대부분의 기존 카테고리(`flowchart`, `wireframe`, `kanban`)와 일치
- `orgChart`, `mindMap`은 camelCase이나 소수

#### 2.2 카테고리 메타데이터 추가

```typescript
// data/templates.ts
export const TEMPLATE_CATEGORIES: TemplateCategoryInfo[] = [
  // ... existing categories
  { id: "retro", label: "Retrospective" },
  { id: "todo", label: "Todo List" },
];
```

#### 2.3 UI 초기값 업데이트

```typescript
// TemplatesPanel.tsx - expandedCategories 초기값 (선택적)
const [expandedCategories, setExpandedCategories] = useState({
  // ... existing
  retro: true,   // 또는 생략 가능 (기본 false)
  todo: true,
});

// ⚠️ 필수: templatesByCategory 초기 객체에 추가
const templatesByCategory = useMemo(() => {
  const grouped: Record<Exclude<TemplateCategory, "custom">, TemplateDefinition[]> = {
    // ... existing
    retro: [],   // 필수 추가
    todo: [],    // 필수 추가
  };
  // ...
}, [...]);
```

### Phase 3: 빌트인 템플릿 추가

#### 3.1 Retrospective 템플릿

**구조**: 3열 레이아웃 (FigJam/Miro 패턴)
- "What Went Well" (녹색 스티키노트 `#dcfce7`)
- "What to Improve" (노란색 스티키노트 `#fef08a`)
- "Action Items" (파란색 스티키노트 `#dbeafe`)

```typescript
// data/templates.ts
const RETRO_START_STOP_CONTINUE: TemplateDefinition = {
  id: "retro-start-stop-continue",
  name: "Start, Stop, Continue",
  description: "Classic retrospective format",
  category: "retro",
  tags: ["retrospective", "agile", "team"],
  objects: [
    // 헤더 텍스트
    { id: "h1", type: "textBox", x: 0, y: 0, width: 280, text: "Start" },
    { id: "h2", type: "textBox", x: 300, y: 0, width: 280, text: "Stop" },
    { id: "h3", type: "textBox", x: 600, y: 0, width: 280, text: "Continue" },
    // 컬럼 배경
    { id: "c1", type: "shape", shapeVariant: "rectangle", x: 0, y: 40, width: 280, height: 400, fill: "#dcfce7" },
    { id: "c2", type: "shape", shapeVariant: "rectangle", x: 300, y: 40, width: 280, height: 400, fill: "#fee2e2" },
    { id: "c3", type: "shape", shapeVariant: "rectangle", x: 600, y: 40, width: 280, height: 400, fill: "#dbeafe" },
    // 샘플 스티키
    { id: "s1", type: "stickyNote", x: 20, y: 60, width: 240, backgroundColor: "#bbf7d0", text: "Add your ideas..." },
  ],
};
```

#### 3.2 Todo List 템플릿

**구조**: 단순 스티키노트 목록 (체크박스 이모지 불필요 - 기존 컴포넌트 활용)

```typescript
const TODO_SIMPLE: TemplateDefinition = {
  id: "todo-simple",
  name: "Simple Todo",
  description: "Basic task list",
  category: "todo",
  tags: ["todo", "tasks", "personal"],
  objects: [
    { id: "title", type: "textBox", x: 0, y: 0, width: 300, text: "My Tasks", fontSize: 24 },
    { id: "t1", type: "stickyNote", x: 0, y: 50, width: 300, backgroundColor: "#fef08a", text: "Task 1" },
    { id: "t2", type: "stickyNote", x: 0, y: 170, width: 300, backgroundColor: "#fef08a", text: "Task 2" },
    { id: "t3", type: "stickyNote", x: 0, y: 290, width: 300, backgroundColor: "#fef08a", text: "Task 3" },
  ],
};
```

## Technical Considerations

### Architecture Impacts

- Store slice 변경 없음 (기존 구조 활용)
- 타입 확장만 필요 (TemplateCategory)

#### Research Insights (Architecture Strategist)

**카테고리 이중 정의 문제:**
- 현재: `TemplateCategory` (types.ts) + `TEMPLATE_CATEGORIES` (data/templates.ts) 분리
- 새 카테고리 추가 시 두 곳 수정 필요 (coupling)
- 향후 개선: `as const` 패턴으로 단일 소스화 권장

### Performance Implications

- localStorage 저장 데이터 증가 (customTemplates 배열)
- 대용량 템플릿 저장 시 성능 고려 필요 (향후 압축 검토)

#### Research Insights (Performance Oracle)

| 시나리오 | 템플릿 수 | 예상 크기 | 성능 |
|----------|-----------|-----------|------|
| 소규모 | 5개 | ~250KB | 양호 |
| 중규모 | 20개 | ~1MB | 주의 필요 |
| 대규모 | 50개+ | ~3MB+ | 한계 초과 |

**최적화 권장사항:**
1. 템플릿 저장 전 크기 검증
2. IntersectionObserver로 썸네일 지연 생성
3. 향후: lz-string 압축 적용 (60-80% 용량 절감)

### Security Considerations

#### Research Insights (Security Sentinel)

| 취약점 | 심각도 | 상태 | 권장 조치 |
|--------|--------|------|----------|
| XSS via SVG Thumbnail | HIGH | 취약 | DOMPurify 적용 |
| Prototype Pollution | HIGH | 취약 | 키 화이트리스트 검증 |
| localStorage DoS | MEDIUM | 취약 | 크기 제한 추가 |

**즉시 조치 (Phase 1과 함께):**
```typescript
// utils/templates.ts - SVG sanitize
import DOMPurify from 'dompurify';

export function generateTemplateThumbnail(template: TemplateDefinition): string {
  const svgContent = /* ... 기존 로직 ... */;
  return DOMPurify.sanitize(svgContent, { USE_PROFILES: { svg: true } });
}
```

**템플릿 적용 시 검증:**
```typescript
// 프로토타입 오염 방지
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

function sanitizeTemplateObject(obj: unknown): CanvasObject | null {
  if (typeof obj !== 'object' || obj === null) return null;
  for (const key of FORBIDDEN_KEYS) {
    if (key in obj) return null;
  }
  return obj as CanvasObject;
}
```

### Migration

- 기존 사용자의 localStorage에는 새 필드가 없음
- Zustand persist의 `merge` 옵션으로 자동 처리됨 (빈 배열로 초기화)

## Acceptance Criteria

### Phase 1: 버그 수정

- [ ] 커스텀 템플릿 저장 후 새로고침해도 유지됨
- [ ] 최근 사용 템플릿 목록이 새로고침 후에도 유지됨
- [ ] 기존 favoriteTemplates 동작에 영향 없음
- [ ] localStorage 용량 초과 시 사용자에게 경고 표시

### Phase 2: 카테고리 추가

- [ ] TemplatesPanel에 "Retrospective", "Todo List" 섹션 표시
- [ ] 새 카테고리 접기/펼치기 동작
- [ ] 검색 시 새 카테고리 템플릿도 포함

### Phase 3: 템플릿 콘텐츠

- [ ] Retro 템플릿 클릭 시 3열 레이아웃 생성
- [ ] Todo 템플릿 클릭 시 스티키노트 목록 생성
- [ ] 템플릿 적용 후 모든 객체 선택됨 (기존 동작 유지)

### Security (추가)

- [ ] SVG 썸네일 XSS 방지 (DOMPurify 적용)
- [ ] 커스텀 템플릿 크기 제한 (50개 객체, 20개 템플릿)

## Success Metrics

- 사용자 커스텀 템플릿 영속화 100% 동작
- 새 카테고리 템플릿 적용 성공률 100%
- localStorage 용량 초과 에러 0% (가드레일 적용 후)

## Dependencies & Risks

### Dependencies

- 없음 (기존 인프라 활용)
- 선택적: DOMPurify 라이브러리 (보안 강화 시)

### Risks

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| localStorage 용량 초과 | 낮음 | 중간 | TEMPLATE_LIMITS 상수로 가드레일 |
| 기존 데이터 마이그레이션 실패 | 낮음 | 낮음 | merge 옵션으로 자동 처리 |
| XSS 취약점 악용 | 낮음 | 높음 | DOMPurify로 SVG sanitize |
| 대형 템플릿 성능 저하 | 중간 | 중간 | 객체 수 제한 + 경고 표시 |

## Implementation Checklist

### store/index.ts

- [x] `partialize`에 `customTemplates` 추가
- [x] `partialize`에 `recentTemplates` 추가

### types.ts

- [x] `TemplateCategory`에 `"retro"` 추가
- [x] `TemplateCategory`에 `"todo"` 추가

### data/templates.ts

- [x] `TEMPLATE_CATEGORIES`에 retro, todo 추가
- [x] `DEFAULT_TEMPLATES`에 retro 템플릿 추가 (2개: WWN, 4Ls)
- [x] `DEFAULT_TEMPLATES`에 todo 템플릿 추가 (2개: Simple, Eisenhower Matrix)

### TemplatesPanel.tsx

- [x] `templatesByCategory` 초기 객체에 `retro: []`, `todo: []` 추가
- [x] `expandedCategories` 초기값에 retro, todo 추가

### constants/template.ts (신규)

- [x] `TEMPLATE_LIMITS` 상수 정의
- [x] `canAddTemplate()` 검증 함수 추가
- [x] `estimateTemplateSize()` 유틸리티 함수 추가

### utils/templates.ts (보안 강화)

- [x] `generateTemplateThumbnail`에 DOMPurify 적용
- [x] 템플릿 객체 sanitize 함수 추가 (`sanitizeTemplateObject`, `validateTemplate`)

## Sources & References

### Internal References

- Store persist 설정: `src/store/index.ts:480-496`
- 템플릿 타입: `src/types.ts:695-720`
- 기존 템플릿 데이터: `src/data/templates.ts`
- 템플릿 패널 UI: `src/components/TemplatesPanel.tsx`
- SVG 썸네일 생성: `src/utils/templates.ts:138-245`

### Codebase Patterns

- 템플릿 적용 패턴: `store/slices/templates.ts:74-176` (ID 재매핑, 위치 조정)
- 카테고리 구조: `data/templates.ts:13-21`
- Zod 스키마 검증: `src/schemas/index.ts`

### External References

- Zustand Persist Docs: https://zustand.docs.pmnd.rs/integrations/persisting-store-data
- DOMPurify: https://github.com/cure53/DOMPurify
- FigJam Retrospective Template: https://www.figma.com/templates/project-retrospective-template/
- MDN Storage Quotas: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API
