---
title: "feat: npm publish pig-ma v0.1.0"
type: feat
status: active
date: 2026-04-30
origin: ~/.gstack/projects/pig/kyb-ontact-main-design-20260430-134537.md
---

# feat: npm publish pig-ma v0.1.0

## Summary

pig-ma 캔버스 라이브러리의 첫 npm 배포를 완료한다. TS 빌드 에러는 이미 수정되었고, peer deps와 README도 준비되어 있다. git 초기화, 메타데이터 보충, 로컬 통합 테스트 후 npm publish v0.1.0을 실행한다.

---

## Requirements

- R1. `npm install pig-ma`로 외부 React 프로젝트에서 설치 가능
- R2. `<Canvas />` 컴포넌트 렌더링 및 기본 도형 조작 동작
- R3. TypeScript 타입 선언(.d.ts) 정상 제공
- R4. CSS(`styles.css`)가 호스트 앱과 충돌 없이 동작
- R5. `npm run build:lib` 에러 없이 통과

---

## Scope Boundaries

- npm 레지스트리 배포만 수행, GitHub Actions CI/CD는 v0.1.0 배포를 차단하지 않음 (별도 설정)
- 번들 크기 최적화(tree-shaking, code splitting)는 이번 범위 외
- sonix-viviane 통합 테스트는 수동 확인만 수행
- **전제조건**: npmjs.com 계정 로그인 필요 (`npm login` — U1 이전에 확인)

### Deferred to Follow-Up Work

- 번들 크기 최적화 (3.8MB → 목표 미정): 별도 이터레이션
- GitHub repository URL, homepage, bugs URL 설정: GitHub 레포 생성 후
- Storybook, CHANGELOG.md: Phase 2 품질 단계에서
- @google/genai dependency 분리 검토: AI Phase에서

---

## Context & Research

### Relevant Code and Patterns

- `vite.config.ts` — lib 모드 빌드 설정, rollupOptions external
- `src/index.ts` — 200+ public API barrel export
- `tsconfig.lib.json` — 라이브러리용 strict 설정
- `package.json` — exports 필드, files 배열, prepublishOnly 훅
- `.gitignore` — dist/, node_modules/, *.tgz 등 제외 설정 완료

### Key Facts

- peer deps(react, react-dom): 이미 peerDependencies에 올바르게 설정됨
- README.md: 246줄, 설치/사용법/API 예제 포함
- prepublishOnly: `npm run build:lib` 자동 실행
- dist/ 출력: pig-ma.js(3.8MB ESM), pig-ma.cjs(2.4MB CJS), styles.css(69KB), index.d.ts + 서브트리

---

## Key Technical Decisions

- **git init 후 단일 초기 커밋**: 히스토리 없이 시작, 향후 커밋부터 conventional commit
- **npm pack 로컬 테스트 우선**: npm publish 전에 tarball로 sonix-viviane에서 통합 확인
- **CSS 격리는 수동 확인**: Tailwind v4 빌드 CSS는 자체 `@theme` 스코프 사용, 대부분 유틸리티 클래스로 충돌 가능성 낮음

---

## Implementation Units

- U1. **git 초기화 및 초기 커밋**

**Goal:** 프로젝트를 git 리포지토리로 초기화하고 현재 상태를 커밋

**Requirements:** R1 (npm publish 전제조건)

**Dependencies:** None

**Files:**
- Create: `.git/` (git init)

**Approach:**
- `git init` 실행
- `.gitignore` 이미 적절하게 설정되어 있으므로 수정 불필요
- 전체 프로젝트를 단일 초기 커밋으로 추가 (`feat: initial commit - pig-ma v0.1.0`)
- `node_modules/`, `dist/`, `*.tgz` 등 .gitignore 대상 파일이 실수로 포함되지 않는지 확인

**Patterns to follow:**
- `.claude/rules/git.md` 커밋 메시지 규칙

**Test expectation:** none -- git 초기화는 빌드/런타임 동작에 영향 없음

**Verification:**
- `git log --oneline` 결과에 초기 커밋 표시
- `git status`에 untracked 파일 없음

---

- U2. **package.json 메타데이터 보충**

**Goal:** npm 레지스트리에 표시될 메타데이터를 최소한으로 보충

**Requirements:** R1

**Dependencies:** U1

**Files:**
- Modify: `package.json`

**Approach:**
- `keywords` 필드 추가: `["canvas", "react", "figma", "drawing", "konva", "whiteboard"]`
- `repository`, `homepage`, `bugs` URL은 GitHub 레포 생성 전이므로 빈 문자열 유지 (npm publish의 차단 조건 아님, 배포 후 backfill 가능)
- `author` 필드 확인/추가
- `license` 필드 확인 (MIT)

**Test expectation:** none -- 메타데이터 변경은 런타임에 영향 없음

**Verification:**
- `npm pack --dry-run` 출력에서 메타데이터 확인
- 패키지 tarball에 포함되는 파일 목록 확인

---

- U3. **라이브러리 빌드 최종 확인 및 npm pack**

**Goal:** 빌드 성공을 재확인하고 배포용 tarball 생성

**Requirements:** R1, R3, R5

**Dependencies:** U2

**Files:**
- Verify: `dist/pig-ma.js`, `dist/pig-ma.cjs`, `dist/styles.css`, `dist/index.d.ts`

**Approach:**
- `npm run build:lib` 실행, 에러 0개 확인
- `npm pack` 실행, tarball 생성 확인
- tarball 내용 검사: `tar tzf pig-ma-0.1.0.tgz` 로 포함 파일 확인
- dist/, README.md, LICENSE, package.json만 포함되는지 검증

**Test scenarios:**
- Happy path: `npm run build:lib` 에러 없이 성공, dist/ 에 ESM+CJS+CSS+d.ts 생성
- Happy path: `npm pack` 결과 tarball에 불필요한 파일(src/, node_modules/, .claude/) 미포함

**Verification:**
- tarball 크기 합리적 (source map 제외 시 ~5MB 예상, source map 포함 시 ~15MB)
- tarball 파일 목록에 `package/dist/pig-ma.js`, `package/dist/styles.css`, `package/README.md` 존재

---

- U4. **sonix-viviane 로컬 통합 테스트**

**Goal:** 실제 소비자 프로젝트에서 pig-ma가 동작하는지 수동 확인

**Requirements:** R1, R2, R3, R4

**Dependencies:** U3

**Files:**
- Verify: sonix-viviane 프로젝트에서 `npm install ../pig/pig-ma-0.1.0.tgz`

**Approach:**
- sonix-viviane에서 tarball로 로컬 설치
- 테스트 페이지에 `<Canvas />` + `<Toolbar />` 렌더링
- CSS import (`import 'pig-ma/styles.css'`) 후 호스트 앱 스타일과 충돌 여부 확인
- Zustand store 격리 확인 (pig-ma store와 호스트 앱 store 독립 동작)
- TypeScript 타입 자동완성 동작 확인 (IDE에서 import 시 타입 추론)

**Test scenarios:**
- Happy path: `<Canvas />` 렌더링되고 스티키 노트 생성 가능
- Edge case: CSS 충돌 확인 — pig-ma styles.css import 전후로 sonix-viviane의 버튼, 폼, 레이아웃 시각적 변화 없는지 비교. 변화 있으면 U5 차단 (CSS prefix 검토 필요)
- Integration: Zustand store가 호스트 앱 store와 독립적으로 동작 — pig-ma 상태 변경이 호스트 앱 컴포넌트 리렌더를 유발하지 않는지 확인

**Verification:**
- 캔버스 렌더링, 도형 생성/이동/삭제 동작
- 브라우저 콘솔에 에러 없음
- sonix-viviane 기존 페이지의 시각적 레이아웃 변화 없음 (CSS 충돌 없음 확인)
- pig-ma 도형 조작 시 sonix-viviane 상태에 영향 없음 (store 격리 확인)

---

- U5. **npm publish v0.1.0**

**Goal:** npm 레지스트리에 pig-ma v0.1.0 배포

**Requirements:** R1

**Dependencies:** U4

**Files:**
- Verify: npm registry에 `pig-ma@0.1.0` 게시

**Approach:**
- `npm login` 확인 (npmjs.com 계정)
- `npm publish` 실행 (prepublishOnly가 build:lib 자동 실행)
- 배포 후 `npm info pig-ma` 로 레지스트리 등록 확인
- sonix-viviane에서 tarball 대신 `npm install pig-ma@0.1.0` 으로 전환하여 재확인

**Test scenarios:**
- Happy path: `npm publish` 성공, `npm info pig-ma` 에 v0.1.0 표시
- Error path: 이름 충돌 시 scoped package(`@username/pig-ma`)로 전환

**Verification:**
- `npm info pig-ma` 에서 버전, description, peer dependencies 확인
- 다른 디렉토리에서 `npm install pig-ma` 성공

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| npm 패키지명 `pig-ma` 이미 사용 중 | `npm view pig-ma` 로 사전 확인, 충돌 시 scoped package 사용 |
| CSS 충돌 (Tailwind 유틸리티 클래스) | U4에서 수동 확인, 문제 시 CSS prefix 옵션 검토 |
| Zustand store 충돌 | pig-ma가 자체 store 인스턴스 생성하므로 충돌 가능성 낮음, U4에서 확인 |
| 번들 크기 3.8MB | 내부 사용에는 허용, 최적화는 Phase 2로 defer |

---

## Sources & References

- **Origin document:** ~/.gstack/projects/pig/kyb-ontact-main-design-20260430-134537.md
- Related code: `vite.config.ts`, `src/index.ts`, `package.json`, `tsconfig.lib.json`
- Related TODO: `2026-08-library-packaging-todo.md`
