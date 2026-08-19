# Canvas App - FigJam Style Drawing Application

## Language Rules

**모든 응답은 한글로 작성합니다.** 코드 주석, 변수명, 함수명은 영어로 유지하되, 사용자와의 대화 및 설명은 한글로 합니다.

> 상세 UI 텍스트 규칙은 `.claude/rules/ui-text.md` 참조

---

## Project Overview

React + TypeScript 기반의 FigJam 스타일 캔버스 드로잉 애플리케이션입니다.

### Tech Stack
- **Framework**: React 18 + TypeScript + Vite
- **Canvas**: React-Konva (Konva.js wrapper)
- **State**: Zustand + temporal (undo/redo) + persist (localStorage)
- **Styling**: TailwindCSS
- **Icons**: Lucide React

### Dev Server
```bash
# 일반 개발 서버 (기본 포트 3874)
npm run dev

# 테스트 서버 (Playwright 테스트 시에만)
npm run dev -- --port 5000
```

**포트 규칙:**
- **개발 서버**: 3874 (vite.config.ts)
- **테스트 서버**: 5000 (Playwright 테스트 전용)

---

## Architecture

```
src/
├── components/
│   ├── Canvas.tsx            # 메인 캔버스 (Stage, Layers)
│   ├── ShapeRenderer.tsx     # Shape 렌더링 래퍼 (memo 격리)
│   ├── Toolbar.tsx           # 하단 도구 모음 (원형 메뉴 포함)
│   ├── Header.tsx            # 상단 헤더 (File 드롭다운, Templates, Share)
│   ├── FigmaImportModal.tsx  # Figma Import 모달
│   ├── FigmaExportModal.tsx  # Figma Export 모달 (SVG/JSON)
│   ├── ExportPanel.tsx       # 이미지 다운로드 (PNG/JPEG/SVG, 배율 선택)
│   ├── MentionPanel.tsx      # @멘션 추적 패널
│   ├── shapes/               # 개별 도형 컴포넌트
│   ├── captions/             # 캡션/댓글 시스템 (멘션 지원)
│   └── tiptap/               # 리치 텍스트 에디터 (멘션 확장 포함)
├── figma/                    # Figma 연동 모듈
│   ├── types.ts              # Figma API 타입, PigmaShape, 에러 클래스
│   ├── mapper.ts             # figmaToPigma(), pigmaToFigma(), extractLeafNodes()
│   ├── client.ts             # REST API 클라이언트 (fetchFile, fetchNodes)
│   ├── export.ts             # pig-ma → Figma (SVG/JSON export)
│   ├── index.ts              # barrel export
│   └── __tests__/
│       └── mapper.test.ts    # 매퍼 테스트 (37개)
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useShortcuts.ts
│   ├── useMention.ts         # textarea @멘션 훅
│   └── useAutoSave.ts
├── utils/
│   ├── factory.ts        # 객체 생성 함수
│   ├── geometry.ts       # 기하학 유틸리티
│   ├── optionsBar.ts     # 옵션 바 위치 계산
│   ├── elbowPath.ts      # 엘보우 커넥터 경로
│   └── richText.ts       # 리치 텍스트 유틸리티
├── constants/
│   └── zIndex.ts         # z-index 상수 관리
├── store.ts              # Zustand 상태 관리
├── types.ts              # TypeScript 타입 정의
└── App.tsx               # 앱 엔트리
```

---

## Current Features

### Shape Tools
- **Rectangle** (R), **Circle** (C): 색상 선택, 텍스트 입력
- **Sticky Note** (S): 리치 텍스트 편집
- **TextBox** (T): 자유 텍스트
- **Code Block**: 신택스 하이라이팅 코드 블록 (21개 언어 지원)
- **Chart**: bar/line/pie 차트 (바 수직/수평, 5가지 파이 스타일, 동적 리사이징)
- **Embed**: YouTube/Figma/Notion 외부 콘텐츠 임베드
- **More Shapes**: triangle, diamond, flowchart 등

### Drawing Tools
- **Pencil** (P): pen/marker/highlighter
- **Connector** (L): straight/elbowed/curved, 마커 스타일

### Selection & Navigation
- **Select** (V): 단일/다중/영역 선택
- **Hand** (H): 캔버스 패닝 전용

### Canvas Features
- 무한 캔버스 (pan & zoom)
- 10px 그리드 스냅
- Undo/Redo, localStorage 저장
- 화면 잠금 (Cmd+L)
- **Search** (Cmd+F): 캔버스 내 텍스트/객체 검색
- **Export**: PNG/JPEG/SVG (배율 0.5x~4x, 선택 영역/전체, 미리보기)
- **Figma Import**: Figma 파일에서 도형 가져오기 (REST API, PAT 인증)
- **Figma Export**: SVG 클립보드 복사 + JSON 다운로드 + FigJam 플러그인
- **이미지 붙여넣기**: Cmd+V로 시스템 클립보드 이미지 → 캔버스 (최대 800px, canvas 리사이징 압축)

### Text Editing
- **TextOptionsBar**: 플로팅 서식 도구
- **Tiptap Editor**: contenteditable 기반 리치 텍스트
- 인라인 서식 (굵게, 취소선, 색상)
- **@멘션**: `@` 입력 시 사용자 드롭다운 (Tiptap mention 확장 + textarea 커스텀 훅)

### Reactions (Voting)
- 스티키노트 등 객체에 이모지 리액션 (👍 👎 ❤️ 🎉 🤔 👀)
- 리액션 집계 및 사용자 표시

### Caption/Comment System
- C 키로 마우스 위치에 캡션 생성
- 스레드 형식 답글, 이미지 첨부
- **@멘션 지원**: 댓글/답글에서 `@username` 하이라이트 (입력 중 실시간 + 렌더링 시)
- **MentionPanel**: 캔버스 전체 멘션 추적 (FloatingUtilityBar → Mentions 버튼)

---

## Keyboard Shortcuts

| 단축키 | 동작 |
|--------|------|
| V | Select 도구 |
| H | Hand 도구 |
| P | Pencil 도구 |
| R | Shape 도구 |
| S | Sticky Note |
| L | Connector |
| T | TextBox |
| C | 캡션 추가 |
| / | 커서 채팅 |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Cmd/Ctrl + S | 저장 |
| Cmd/Ctrl + F | 검색 |
| Cmd/Ctrl + L | 화면 잠금 |
| Backspace/Delete | 삭제 |
| Arrow Keys | 이동 (1px) |
| Shift + Arrow | 이동 (10px) |

---

## Rules Reference

상세 규칙은 `.claude/rules/` 디렉토리에서 관리됩니다:

| 파일 | 설명 | 적용 경로 |
|------|------|----------|
| `ui-text.md` | UI 텍스트 영문 규칙 | `*OptionsBar.tsx`, `*Panel.tsx` |
| `library.md` | npm 라이브러리 구조 | 전체 |
| `code-style.md` | Prettier, ESLint, 코딩 규칙 | 전체 |
| `git.md` | 커밋 메시지 형식 | 전체 |
| `testing.md` | Playwright 테스트 규칙 | `tests/**/*.ts` |
| `components.md` | 컴포넌트 패턴 | `src/components/**/*.tsx` |
| `shapes.md` | Shape 컴포넌트 규칙 | `src/components/shapes/**/*.tsx` |
| `utils.md` | 유틸리티 함수 규칙 | `src/utils/**/*.ts` |
| `hooks.md` | 커스텀 훅 규칙 | `src/hooks/**/*.ts` |
| `store.md` | Store 슬라이스 구조 | `src/store/**/*.ts` |
| `constants.md` | 공용 상수, View/Edit 일관성 | `src/constants/**/*.ts` |
| `patterns.md` | 성능, 상태 관리 패턴 | 전체 |
| `styling.md` | z-index 계층, UI 스타일링 | 전체 |
| `colors.md` | 색상 팔레트, 테마 | 전체 |
| `options-bars.md` | 옵션 바 공통 패턴 | `*OptionsBar.tsx` |
| `editors.md` | Editor 컴포넌트 패턴 | `*Editor.tsx` |
| `figma.md` | Figma 연동 매핑/클라이언트 규칙 | `src/figma/**/*.ts` |

---

## File Organization

### 스크린샷 저장 위치

| 유형 | 위치 |
|------|------|
| 테스트 캡처 | `tests/capture/` |
| 일반 스크린샷 | `captures/` |

**규칙:**
- 루트 디렉토리에 PNG 파일 두지 않음
- 테스트 관련 스크린샷은 `tests/capture/`에 저장
- 일반 디버깅/확인용 스크린샷은 `captures/`에 저장

---

## Quick Commands

```bash
# 개발
npm run dev                    # 개발 서버 (포트 3874)
npm run build:lib              # 라이브러리 빌드

# 포매팅 (코드 작성 후 필수)
./scripts/convert-format-code.sh

# 테스트
npm run dev -- --port 5000     # 테스트 서버
npx playwright test            # Playwright 테스트 실행
npx vitest run src/figma/      # Figma 매퍼 유닛 테스트
```

## Figma Integration

### Import (v0.1.0): Figma → pig-ma 읽기 (one-shot import)

- **매퍼**: `src/figma/mapper.ts` — `figmaToPigma()`, `pigmaToFigma()`, `importFigmaDocument()`, `svgPathToPoints()`
- **클라이언트**: `src/figma/client.ts` — REST API (`fetchFile`, `fetchImageUrls`, `renderNodes`, `parseFigmaFileUrl`)
- **UI**: `src/components/FigmaImportModal.tsx` — Header → File → Figma Import

### Export (v0.2.0): pig-ma → Figma 내보내기

- **Export 모듈**: `src/figma/export.ts` — `exportToSvg()`, `exportToFigmaJson()`, `copyToFigmaClipboard()`, `downloadSvgFile()`, `downloadFigmaJson()`
- **UI**: `src/components/FigmaExportModal.tsx` — Header → File → Figma Export
- **SVG 클립보드**: 개별 요소(`<rect>`, `<ellipse>`, `<text>`)로 Figma에 붙여넣기
- **JSON + 플러그인**: `figma-plugin/` 폴더 — FigJam 플러그인으로 개별 편집 가능 노드 생성 (TODO: 디버깅 필요)
- **인증**: Figma Personal Access Token (PAT), `file_content:read` 스코프 필요 (1일 유효)
- **지원 노드**: RECTANGLE, ELLIPSE, TEXT, STICKY, FRAME(배경), LINE, VECTOR, CONNECTOR, IMAGE fill
- **SECTION → 그룹**: 중첩 지원, customBounds로 영역 표시
- **이미지**: IMAGE fill 감지 → CDN URL 해결, imageTransform 있으면 node render API(PNG)
- **프리핸드 드로잉**: strokeGeometry 대신 node render API (외곽선 vs 중심선 이슈)
- **텍스트**: textColor, fontWeight, fontSize, textAlign 매핑, Figma Hand 폰트 50% width 버퍼
- **스케일**: import 시 0.75 배율 적용
- **50개 유닛 테스트**

## 텍스트 렌더링 아키텍처

**뷰 모드**: Konva Text (Canvas 내부, DOM 없음)
**편집 모드**: Tiptap Editor (HTML overlay)
**혼합 스타일** (부분 bold, 다중 색상): TextViewerOverlay(Tiptap HTML) 폴백

- `extractFirstTextStyle()` — tiptapContent에서 첫 텍스트 노드 스타일 추출
- `hasMixedStyles()` — 혼합 인라인 스타일 또는 mention 노드 감지
- TEXT_CONFIG padding/lineHeight로 에디트/뷰 일관성 유지
- Shape도 tiptapContent 우선 사용 (legacy richText fallback)

## 그룹/섹션 시스템

- **`__group:` 가상 선택 마커**: 섹션 선택 시 개별 object selection 숨김
- **중첩 그룹**: Date > Team member 구조. customBounds로 부모 영역 표시
- **isParentGroup**: 직접 멤버 없는 그룹 → 전체 영역 드래그 가능
- **커넥터 → 그룹 스냅**: findSnapTarget에 groups 파라미터, ConnectorShapeRenderer에서 __group: 해결
- **섹션 커넥터 연결**: connector 도구에서 GroupBoundary 클릭 시 그룹 선택 방지, __group: ID에 대한 offset 계산
- **selectGroup**: __group: 마커 사용, 실제 objects selectedIds에 안 넣음
- **moveGroupObjects**: customBounds 안의 objects 이동 + 자식 GroupBoundary 실시간 이동
- **deleteObjects**: customBounds 그룹은 bounds 안에 objects 있을 때만 유지

## Toolbar UI

- **원형 메뉴 (+)**: Table, Chart, Code, Embed, Image를 FigJam 스타일 원형 메뉴로 통합
  - SVG 파이 섹터 + 아이콘 + 라벨, 호버 시 섹터 하이라이트 (hoveredSector 동기화)
  - Chart는 서브메뉴 (Bar/Line/Pie)
  - `radial-menu-enter` 애니메이션 (scale 0.85→1, CSS keyframe)
- **File 드롭다운**: Header에서 Import/Export/Download를 하나의 File 메뉴로 통합
- **popover-enter 애니메이션**: 모든 옵션바/팝오버에 통일된 scale(0.92→1) 애니메이션 적용
- **도구 상호 배타**: + 메뉴 열 때 현재 도구 해제, 잠금 시 팝오버 닫기

## @멘션 시스템

- **Tiptap**: `@tiptap/extension-mention` + `tippy.js` suggestion 팝업
- **Caption/Comment**: `useMention` 훅 — textarea에서 `@` 트리거 + `MentionDropdown` 컴포넌트
- **MentionTextarea**: textarea 위에 투명 하이라이트 div 겹쳐서 입력 중 실시간 보라색 표시
- **MentionPanel**: `scanAllMentions()` — tiptapContent + 댓글에서 멘션 스캔, 사용자별 그룹핑
- **hasMixedStyles**: mention 노드 감지 시 항상 TextViewerOverlay (HTML) 사용

## 성능 최적화

- **TextViewerOverlay 제거**: 읽기 전용 → Konva Text (Tiptap DOM 인스턴스 0개)
- **그리드**: CSS background-image pattern (Stage container에 적용, GPU 가속)
- **Line 캐싱**: CachedLine — 20+ 포인트 → node.cache({ pixelRatio: 2 })
- **뷰포트 가상화**: padding 150px, boundsCache/occlusion 30개 임계값

---

## Pending Tasks

- [x] 키보드 단축키 커스터마이징 패널
- [x] 이미지 붙여넣기 개선
- [x] @멘션 기능
- [ ] Figma Export 플러그인 디버깅 (FigJam에서 노드 생성 안 됨 — `figma-plugin/` 폴더, createShapeWithText 확인 필요)

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
