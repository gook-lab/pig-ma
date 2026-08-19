# pig-ma 로드맵 체크리스트 (2026-08-19)

기존 기능 보완 + 신규 기능 + 파일 포맷(Import/Export) 지원 계획.
기존 `TODO-library-packaging.md`의 미완료 항목을 흡수하고, Excalidraw 지원을 신규 트랙으로 추가.

---

## 1. Import / Export 트랙

### 1-1. 자체 파일 포맷 (.pigma) — 선행 과제

현재 저장은 localStorage persist뿐. 파일 단위 저장/열기가 있어야
다른 포맷 변환의 기준점(canonical format)이 생김.

- [x] `.pigma` JSON 스키마 정의 — `src/utils/pigmaFile.ts` (PigmaFile v1: projectName + pages[] + currentPageId, 페이지 시스템 전체 직렬화)
- [x] File 메뉴 → "Save as file" (.pigma 다운로드, 현재 페이지 라이브 상태 동기화 포함)
- [x] File 메뉴 → "Open file" (파일 선택 + 유효성 검증 + 교체 confirm + undo 히스토리 초기화)
- [x] 유닛 테스트 11개 — 라운드트립, 검증 에러, store 적용 (`pigmaFile.test.ts`)
- [x] 캔버스에 파일 드래그&드롭으로 열기 — `useImageDrop.ts`에서 .pigma 분기 (Header "Open file"과 동일 UX, 다른 세션에서 완료)
- [ ] 버전 마이그레이션 훅 (v2 스키마 변경 시점에 구현 — 현재는 미래 버전 거부만)

### 1-2. Excalidraw Import (.excalidraw → pig-ma)

`src/excalidraw/` 모듈 신설 — `src/figma/`와 대칭 구조 (types / mapper / import / export / __tests__).
Excalidraw 파일은 로컬 JSON이라 API 인증이 필요 없어 Figma보다 구현이 단순함.

- [x] `src/excalidraw/types.ts` — ExcalidrawElement 타입 정의 (`type: "excalidraw", version: 2, elements[], appState, files{}`)
- [x] `convertExcalidraw()` 매퍼 (`src/excalidraw/mapper.ts`) — 요소 매핑:

| Excalidraw | pig-ma | 비고 |
|------------|--------|------|
| `rectangle` | shape(`rectangle`/`roundedRect`) | roundness 유무로 분기 |
| `ellipse` | shape(`ellipse`/`circle`) | w≈h면 circle |
| `diamond` | shape(`diamond`) | |
| `arrow` | connector | startBinding/endBinding → sourceId/targetId |
| `line` | connector(standalone) 또는 line | 2점=connector, 다점=line |
| `freedraw` | line (pencil) | points 배열, pressure 무시 |
| `text` | textBox | 폰트 매핑: Virgil→handwriting, Cascadia→mono |
| `image` | image | `files[fileId].dataURL` → src |
| `frame` | group (customBounds) | frameId 멤버십 → 그룹 멤버 |

- [x] 스타일 매핑 — strokeColor→stroke, backgroundColor→fill, fillStyle(`hachure`/`cross-hatch`는 solid 근사), strokeWidth, opacity(0~100→0~1), angle(rad)→rotation(deg), strokeStyle(dashed/dotted)→lineStyle
- [x] `groupIds` → pig-ma groups 변환 (frame 우선, 그 외 최상위 groupId)
- [x] `containerId` 바운드 텍스트 → 도형 text 병합 (arrow 는 커넥터 label)
- [x] 화살표 마커 매핑 (arrow/bar→arrow, triangle→filledArrow, dot/circle→circle, diamond→diamond)
- [x] `isDeleted: true` 스킵, elbowed→pathStyle elbowed, 다점 arrow→curved 근사
- [x] import 후 뷰포트 중앙 배치 (`src/excalidraw/import.ts` — 커넥터/라인 바운드 포함 계산)
- [x] File 메뉴 → "Import Excalidraw" (Header, 숨김 input)
- [x] 드래그&드롭 .excalidraw 감지 — `useImageDrop.ts` 분기, `importExcalidrawToCanvas` 호출 + ExcalidrawImportError alert (다른 세션에서 완료, 2026-08-19)
- [x] 유닛 테스트 25개 — 요소별 변환 + 바인딩/그룹/바운드 텍스트/파싱 검증 (`__tests__/mapper.test.ts`)

### 1-3. Excalidraw Export (pig-ma → .excalidraw)

- [x] `convertToExcalidraw()` 역매퍼 (`src/excalidraw/export.ts`) — shape/stickyNote/textBox/line/connector/image/group 역변환, tiptapContent → plain text 추출(`extractPlainText`)
- [x] Excalidraw에 없는 타입 처리:
  - [x] stickyNote → `rectangle`(backgroundColor) + 바운드 `text`
  - [x] chart / codeBlock / table / embed → PNG 래스터화 후 `image` 요소 (`Konva.stages[0].findOne('#id')` + `toDataURL(pixelRatio:2)`, Canvas.tsx 수정 없음). 뷰포트 밖(가상화로 미렌더) 객체는 스킵 + 개수 alert — 알려진 한계 (2026-08-19)
- [x] connector 바인딩 복원 (sourceId/targetId → startBinding/endBinding, `boundElements` 양방향, `__group:` 가상 ID 제외)
- [x] 필수 메타 생성 — seed/versionNonce/updated/isDeleted (index는 생략 — Excalidraw restore가 재부여)
- [x] 라운드트립 테스트 포함 유닛 테스트 18개 (`__tests__/export.test.ts`)
- [x] File 메뉴 → "Export Excalidraw" (.excalidraw 다운로드, 스킵 개수 안내)

### 1-4. 기타 포맷 (후순위)

- [x] Mermaid import — `src/mermaid/` 신설 (mermaid 라이브러리 의존성 없음): flowchart 서브셋 자체 파서(도형 9종, 엣지 라벨/체인/&, 점선/굵은선, 주석/미지원 키워드 스킵) + Kahn 위상정렬 레이어드 레이아웃(TD/LR/BT/RL, 사이클 안전) + flowVariant shape/attached connector 변환 + File 메뉴 "Import Mermaid" 모달. 테스트 21개. 미지원: subgraph 그룹핑, style/classDef (2026-08-19)
- [ ] CSV/TSV import — 붙여넣기 시 table 또는 chart 데이터로 변환
- [ ] PDF export — 현재 PNG/JPEG/SVG에 추가 (jsPDF, 다중 페이지 대응)
- [ ] draw.io(mxGraph XML) import — 수요 확인 후
- [ ] Figma Export 플러그인 디버깅 — FigJam에서 노드 생성 안 되는 문제 (`figma-plugin/`, createShapeWithText 확인) ※ 기존 pending task

---

## 2. 기존 기능 보완 (TODO-library-packaging.md 이월 포함)

### 라이브러리 패키징

- [x] **P0**: react/react-dom → peerDependencies 이동 (이미 반영되어 있음 — vite lib external도 react/react-dom만 외부화, 확인 완료 2026-08-19)
- [x] package.json 메타데이터 — description/keywords/author/license 완료. repository/homepage URL은 GitHub 공개 시 기입 (사용자가 깃헙 작업 보류 중)
- [x] Consumer 프로젝트 설치 테스트 + 번들 사이즈/tree-shaking 확인 (2026-08-19)
  - npm pack → 새 프로젝트 설치: CJS require OK (319 exports, createCircle 포함), esbuild ESM 번들 OK, index.d.ts 정상
  - 번들 사이즈(minified/gzip): 전체 import 2.12MB/607KB, createShape 단독 import 1.65MB/492KB
  - **발견**: 단일 파일 번들(konva/tiptap 내장)이라 tree-shaking 효과가 ~22%뿐 — 팩토리만 쓰는 소비자도 1.65MB 부담. 개선하려면 (a) preserveModules 멀티엔트리 빌드 또는 (b) konva/react-konva(+tiptap) peerDependencies 외부화 필요. 소비자 breaking 이슈라 결정 보류 (후속 항목)
- [x] createCircle factory export 추가 (factory.ts 래퍼 + index.ts export, 2026-08-19)
- [x] README.md / CHANGELOG.md — README는 기존 문서 세션에서 작성됨, CHANGELOG.md 신규 생성 (Keep a Changelog 형식, 2026-08-19)

### 코어 버그/개선

- [x] Chart 더블클릭 핸들러 수정 — 본문 더블클릭 = 제목 편집(헤더와 동일, NOOP TODO 제거). 헤더 숨김 시엔 무동작 (ShapeRenderer.tsx, 2026-08-19)
- [x] FRAME 클리핑 (clipsContent) — 자식 있는 FRAME을 빈 사각형 대신 render API 래스터화(`imageRef: node:...`)로 변환, 크롭 반영 (figma/mapper.ts + 테스트, 2026-08-19)
- [x] 커넥터 시작점 녹색 가이드 — 확인 결과 이미 구현되어 있음 (Canvas.tsx ConnectionHandles 블록이 `__group:` 가상 객체 지원, 호버 녹색 앵커도 findSnapTarget이 groups 처리). TODO가 낡은 항목이었음
- [x] 복사 시 커넥션 유지 — 양 끝점이 선택에 포함된 커넥터를 함께 복사, paste/duplicate 시 sourceId/targetId 리매핑 (clipboard.ts, 2026-08-19 완료)

### 마감 품질 (2026-08-19 오후 추가)

- [x] alert → 토스트 통일 + import/export 성공 피드백 — 기존 `utils/toast.ts`(react-hot-toast 래퍼) 재사용. FileMenu: .pigma 저장/열기, Excalidraw import/export 성공 토스트(개수 포함) + 에러 토스트, Mermaid 모달: 성공 토스트. `.pigma` 열기 confirm은 파괴적 동작이라 window.confirm 유지 (모달 교체는 후속). useImageDrop 드롭 경로도 완료 — 이미지 용량 초과/파일 열기 실패 toast.error, .pigma 열기 성공(프로젝트명)·.excalidraw import 성공(개수+스킵) toast.success (다른 세션, 2026-08-19)
- [x] ExportPanel 마운트를 hideUI 가드 밖으로 이동 — Hide UI 토글 시 패널 상태 유실 방지 (교차검증 비고 반영)
- [ ] .pigma 열기 시 현재 프로젝트 자동 백업
- [ ] E2E 테스트 — 파일 열기/저장, Excalidraw/Mermaid import, 정렬/분배
- [ ] tsc pre-existing 에러 점진 청산 (~520줄, "신규 에러 0" 규칙은 유지 중)
- [x] 번들 사이즈 개선 — 사용자 결정에 따라 **konva/react-konva/@tiptap/* 외부화(peerDependencies)** 실행 (2026-08-19)
  - vite lib external 정규식(konva 서브패스 포함) + `output.interop: 'auto'` (기본 interop 이 @tiptap CJS require 를 깨뜨림 — "configure is not a function")
  - 신선한 소비자 검증: npm 7+ peer 16개 자동 설치 ✓, CJS require ✓, ESM 번들 ✓
  - 실측: pig-ma 자체 몫 1.44MB/378KB(gz) — konva/tiptap 을 이미 쓰는 앱은 중복 0. 팩토리-only 소비자 번들은 단일 파일 엔트리 특성상 여전히 전체 로드 — 추가 개선은 preserveModules (후속 결정)
  - README peer 안내 + CHANGELOG BREAKING 기록

### Figma 연동 품질

- [x] 폰트 매핑 개선 — `mapFigmaFontFamily`: 유니온 외 폰트명 캐스팅 금지(undefined=기본 폰트), 손글씨 계열(Figma Hand/Virgil 등)→Nanum Gothic, 대소문자 정규화. 폭은 상수 버퍼(1.2/1.5×) 대신 pig-ma 렌더 폰트로 가장 긴 줄 실측(`measureTextWidth`, DOM 없으면 추정 폴백), 고정 박스(textAutoResize NONE)는 bbox 존중 (2026-08-19)
- [x] 리치텍스트 매핑 — characterStyleOverrides+styleOverrideTable ↔ Tiptap 양방향: import는 오버라이드 런 → TextSegment → `textSegmentsToTiptap`(bold/strike/fontSize/색), export는 `tiptapToFigmaOverrides`(스타일 dedupe id 테이블). FigmaImportModal/export.ts에 tiptapContent 관통 배선. 테스트 10개 추가 (2026-08-19)
- [ ] OAuth2 인증 (PAT 1일 만료 문제 해소)

### 성능

- [x] 이미지 lazy loading — CanvasImage에 디코드 캐시(LRU 100) + 로딩 플레이스홀더. 뷰포트 재진입 시 재디코드/깜빡임 제거, 로딩 중에도 선택·드래그 가능 (2026-08-19)
- [x] React 리렌더 추가 최소화 — 전수 점검 완료: shapes/* 구독은 전부 안정 참조(액션/타입 한정)로 확인. 실누수 2건 수리: ① ShapeRenderer가 테이블/차트 편집 상태를 전 타입에서 구독 → 타입별 null 셀렉터로 좁힘(셀 선택 드래그 중 전체 리렌더 제거), ② ConnectorShapeRenderer가 objects 배열 전체 구독 + objectsById Map 재생성 → 끝점 도형/그룹 bounds 좁은 구독으로 교체, Connector의 스냅 목록은 이벤트 시점 getState()로 전환 (2026-08-19)
- [ ] WebGL 전환 검토 (PixiJS) — 대형 보드 벤치마크 후 판단

---

## 3. 신규 기능 후보 (FigJam 대비 갭)

### 편집 UX

- [x] 정렬/분배(Align & Distribute) — 다중 선택(2개+) 시 옵션바로 좌/중/우·상/중/하 정렬, 3개+ 등간격 분배. `src/utils/align.ts`(순수 계산, 테스트 10개) + `MultiSelectEditor`/`AlignOptionsBar` + App.tsx 마운트. 잠긴 객체·도형에 붙은 커넥터는 제외, 한 번의 set으로 undo 한 단계 (2026-08-19)
- ~~스마트 가이드~~ — 이미 구현됨 (AlignmentGuide, 드래그 정렬 가이드)
- ~~미니맵~~ — 이미 구현됨 (`Minimap.tsx`)
- [x] 객체 잠금 상태 시각화 개선 + 잠금 객체 일괄 관리 — ① 잠금 배지를 Selection UI 레이어로 이동(HTML 뷰어 오버레이·상위 객체에 가려지던 문제 해소), ② `setObjectsLocked(ids, locked)` 일괄 액션(잠금 시 선택 자동 해제, 무변경 시 참조 유지, 테스트 3개), ③ `LockedObjectsPanel` — 잠긴 객체 있을 때만 좌하단 칩, 목록에서 개별/전체 해제 + 클릭 시 해당 객체로 팬 이동 (2026-08-19)
- [x] Header.tsx → FileMenu.tsx 분리 리팩토링 — File 드롭다운/숨김 input/Figma·Mermaid 모달을 FileMenu가 소유, 반복 버튼 마크업을 MenuItem 공통화. Header 420줄 → 105줄 (2026-08-19)

### 협업 (장기)

- [ ] 실시간 멀티플레이어 (Yjs/Liveblocks CRDT) — store 구조가 Zustand라 도입 지점 설계 필요
- [ ] 프레젠테이션 모드 — 섹션 단위 순회
- [ ] 타이머/투표 세션 (리액션 시스템 확장)
- [ ] 스탬프 도구

### 콘텐츠

- [ ] 템플릿 갤러리 확장 (기존 plan: `2026-03-26-feat-template-gallery-enhancement-plan.md`)
- [ ] 이모지/GIF 삽입
- [ ] 모바일 터치 지원 (핀치 줌, 터치 드래그)

---

## 권장 실행 순서

1. **1-1 (.pigma 저장/열기)** — 반나절 규모, 모든 포맷 지원의 토대
2. **1-2 (Excalidraw import)** — Figma 매퍼 패턴 재사용으로 리스크 낮음
3. **1-3 (Excalidraw export)** — 래스터화 전략 결정 필요
4. **2 코어 버그** (Chart 더블클릭, FRAME 클리핑) — 병행 가능한 소규모
5. **P0 peerDependencies** — 배포 전 필수
