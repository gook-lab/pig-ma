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
- **테스트 서버**: 5006 (playwright.config.ts `webServer`가 자동 기동 — 수동으로 띄울 필요 없음)

---

## Architecture

```
src/
├── components/
│   ├── Canvas.tsx            # 메인 캔버스 (Stage, Layers)
│   ├── ShapeRenderer.tsx     # Shape 렌더링 래퍼 (memo 격리)
│   ├── Toolbar.tsx           # 하단 도구 모음 (원형 메뉴 포함)
│   ├── Header.tsx            # 상단 헤더 (File 드롭다운, Templates, Share)
│   ├── FileMenu.tsx          # File 드롭다운 (.pigma 저장/열기/백업복원, Excalidraw/Mermaid/Figma)
│   ├── FigmaImportModal.tsx  # Figma Import 모달
│   ├── FigmaExportModal.tsx  # Figma Export 모달 (SVG/JSON)
│   ├── MermaidImportModal.tsx # Mermaid flowchart 붙여넣기 모달
│   ├── ExportPanel.tsx       # 이미지 다운로드 (PNG/JPEG/SVG, 배율 선택)
│   ├── MultiSelectEditor.tsx # 다중 선택(2+) 정렬/분배 옵션바
│   ├── AlignOptionsBar.tsx   # 정렬/분배 버튼 UI
│   ├── LockedObjectsPanel.tsx # 잠금 객체 칩/패널 (좌하단)
│   ├── MentionPanel.tsx      # @멘션 추적 패널
│   ├── shapes/               # 개별 도형 컴포넌트
│   ├── captions/             # 캡션/댓글 시스템 (멘션 지원)
│   └── tiptap/               # 리치 텍스트 에디터 (멘션 확장 포함)
├── figma/                    # Figma 연동 모듈
│   ├── types.ts              # Figma API 타입, PigmaShape, 에러 클래스
│   ├── mapper.ts             # figmaToPigma(), pigmaToFigma(), 리치텍스트 오버라이드 매핑
│   ├── client.ts             # REST API 클라이언트 (fetchFile, fetchNodes)
│   ├── export.ts             # pig-ma → Figma (SVG/JSON export)
│   ├── index.ts              # barrel export
│   └── __tests__/            # 매퍼 테스트 (70+개)
├── excalidraw/               # Excalidraw 양방향 변환 모듈 (로컬 JSON — 인증 불필요)
│   ├── types.ts              # ExcalidrawElement/Data 타입, 에러 클래스
│   ├── mapper.ts             # convertExcalidraw(), parseExcalidrawFile()
│   ├── import.ts             # importExcalidrawToCanvas() — 뷰포트 중앙 배치
│   ├── export.ts             # convertToExcalidraw() — chart 등은 Konva 래스터화
│   └── __tests__/            # 43개 (라운드트립 포함)
├── mermaid/                  # Mermaid flowchart import (라이브러리 의존성 없음)
│   ├── parser.ts             # flowchart 서브셋 자체 파서
│   ├── layout.ts             # Kahn 위상정렬 레이어드 레이아웃
│   ├── import.ts             # convertMermaid(), importMermaidToCanvas()
│   └── __tests__/            # 21개
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useShortcuts.ts
│   ├── useMention.ts         # textarea @멘션 훅
│   ├── useImageDrop.ts       # 드래그&드롭 (.pigma/.excalidraw/이미지 분기)
│   └── useAutoSave.ts
├── utils/
│   ├── factory.ts        # 객체 생성 함수
│   ├── geometry.ts       # 기하학 유틸리티
│   ├── pigmaFile.ts      # .pigma 파일 직렬화/파싱/자동백업
│   ├── align.ts          # 정렬/분배 순수 계산
│   ├── optionsBar.ts     # 옵션 바 위치 계산
│   ├── elbowPath.ts      # 엘보우 커넥터 경로
│   ├── translateElbowBends.ts # 커넥터 강체 이동 (elbowBends 절대좌표)
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
- **정렬/분배**: 다중 선택(2+) 시 옵션바 — 좌/중/우·상/중/하 정렬, 3+ 등간격 분배
- **잠금 관리**: 잠금 배지(Selection UI 레이어) + LockedObjectsPanel 일괄 해제
- **이미지 붙여넣기**: Cmd+V로 시스템 클립보드 이미지 → 캔버스 (최대 800px, canvas 리사이징 압축)

### File I/O (File 메뉴 + 드래그&드롭)
- **.pigma 저장/열기**: 프로젝트 전체(모든 페이지) 직렬화. 열기 시 자동 백업 → "Restore last backup"으로 스왑 복원 (`utils/pigmaFile.ts`)
- **Excalidraw Import/Export**: `.excalidraw` 양방향 변환. export 시 chart/codeBlock/table/embed 는 Konva 래스터화(PNG) — 뷰포트 밖 객체는 스킵(알려진 한계) (`src/excalidraw/`)
- **Mermaid Import**: flowchart 텍스트 붙여넣기 → 도형+attached 커넥터 자동 배치 (`src/mermaid/`, 의존성 없음)
- **이미지 Export**: PNG/JPEG/SVG (배율 0.5x~4x, 선택 영역/전체, 미리보기)
- **Figma Import**: Figma 파일에서 도형 가져오기 (REST API, PAT 인증, 리치텍스트 오버라이드 매핑)
- **Figma Export**: SVG 클립보드 복사 + JSON 다운로드 + FigJam 플러그인
- 성공/실패 피드백은 전부 `utils/toast` (alert 금지)

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
npx vite build --mode lib      # 라이브러리 빌드 (preserveModules, konva/tiptap peer 외부화)

# 검증 (커밋 전 필수)
./scripts/convert-format-code.sh  # 포매팅
npm run typecheck              # tsc 0건 유지 (전량 청산됨 — 신규 에러 금지)
npm run lint:gate              # lint 신규 위반 0 (기존 부채는 베이스라인으로 통과)
npx vitest run                 # 유닛 테스트 전체
npx playwright test            # E2E (포트 5006 자동 기동)
```

### Lint 게이트

`eslint .` 에는 ESLint 도입 전부터 쌓인 기존 위반이 남아 있다(2026-08-20 기준
107건). 전부 고칠 때까지 게이트를 세우지 못하면 새 위반이 계속 섞이므로,
**파일별 위반 수를 베이스라인으로 고정하고 늘어난 파일만 실패**시킨다.

```bash
npm run lint                # 전체 현황 (기존 부채 포함)
npm run lint:gate           # 신규 위반만 검사 — 커밋 전 실행
npm run lint:gate:update    # 파일을 정리해 위반이 줄었을 때 베이스라인 고정
```

**점진 청산 방침**: 별도 대규모 청산 작업을 잡지 않는다. 도메인 작업으로
파일을 건드릴 때 그 파일의 기존 위반도 함께 정리하고 `lint:gate:update` 로
베이스라인을 낮춘다 — 베이스라인은 한 방향으로만 조여진다.

> ⚠️ **파이프 뒤에서 종료코드를 읽지 말 것.** `npm run lint:gate | tail` 처럼
> 파이프를 걸면 `$?` 가 마지막 명령(tail)의 코드라 실패가 0으로 보인다.
> 게이트가 조용히 무력화되는 전형적 경로다 — CI/훅에 붙일 때는 파이프 없이
> 직접 실행하거나 `set -o pipefail` 을 켠다. (모든 검증 커맨드에 해당)

`react-hooks/rules-of-hooks`(실제 버그 클래스)는 **전량 청산되어 0건**이다.
남은 부채는 `set-state-in-effect` / `exhaustive-deps` / `react-refresh` 계열로,
케이스별 판단이 필요해 일괄 수정하지 않는다.

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

> 상세 현황은 `docs/plans/2026-08-19-roadmap-checklist.md` (2세션 협업 작업 로그) 참조

- [ ] Figma Export 플러그인 디버깅 (FigJam에서 노드 생성 안 됨 — `figma-plugin/` 폴더, createShapeWithText 확인 필요. FigJam 실기 테스트 필요)
- [ ] Figma OAuth2 인증 (앱 등록 필요 — 사용자 결정 대기)
- [ ] CSV/TSV 붙여넣기 → 테이블/차트 변환
- [ ] PDF export (jsPDF — dynamic import 권장)
- [ ] WebGL 전환 검토 (PixiJS, 대형 보드 벤치마크 후)

## 라이브러리 배포 주의

- konva/react-konva/@tiptap/* 는 **peerDependencies** (devDeps에도 유지). vite lib external 은 서브패스까지 정규식 매칭, `output.interop: 'auto'` 필수 (기본값이면 @tiptap CJS require 깨짐)
- **preserveModules** 빌드 — 모듈별 dist 파일. 팩토리-only 소비자 번들 ~1.4KB. 번들 의존성은 `dist/vendor/` (node_modules 경로 금지)

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
