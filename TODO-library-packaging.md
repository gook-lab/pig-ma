# Library Packaging TODO

라이브러리 패키징 작업 후속 태스크 목록.

## P0 (Critical)

- [ ] **peer dependency 수정**
  - react/react-dom을 dependencies에서 peerDependencies로 이동
  - `"peerDependencies": { "react": "^18.0.0 || ^19.0.0", "react-dom": "^18.0.0 || ^19.0.0" }`

## P1 (High Priority)

- [ ] **package.json 메타데이터 완성**
  - description, keywords, repository, homepage 추가
  - license 확인

- [ ] **Consumer 프로젝트 테스트**
  - 새 프로젝트에서 `npm install pig-ma` 테스트
  - 번들 사이즈 확인
  - Tree-shaking 동작 확인

- [ ] **createCircle export 추가**
  - `src/index.ts`에 createCircle factory 함수 export

- [ ] **Chart 더블클릭 핸들러 수정**
  - Chart 컴포넌트의 더블클릭 이벤트 처리 검토

## P2 (Normal)

- [ ] **README.md 작성**
  - 설치 방법
  - 기본 사용 예시
  - API 문서 링크

- [ ] **CHANGELOG.md 시작**
  - 버전 히스토리 관리

- [ ] **CSS 변수 문서화**
  - 테마 커스터마이징 가이드

## Figma Integration

- [x] **v0.1.0: Figma → pig-ma 읽기 (one-shot import)**
  - 매퍼 모듈 (`figmaToPigma`, `pigmaToFigma`, `importFigmaDocument`, `svgPathToPoints`)
  - REST API 클라이언트 (`fetchFile`, `fetchImageUrls`, `renderNodes`, `parseFigmaFileUrl`)
  - FigmaImportModal UI (Header에 Import 버튼)
  - PAT 인증, scope 에러 감지, 중복 import 방지
  - 지원: RECTANGLE, ELLIPSE, TEXT, STICKY, FRAME(배경), LINE, VECTOR, CONNECTOR, IMAGE fill
  - SECTION → pig-ma 그룹 변환 (중첩 지원, customBounds)
  - 이미지 CDN URL 해결 + 크롭된 이미지 node render
  - 프리핸드 드로잉 → node render API (PNG)
  - fontWeight, textColor, textAlign, fontSize 매핑
  - import 스케일 0.75 적용
  - 50개 유닛 테스트

- [ ] **v0.2.0: 양방향 동기화 + 품질 개선**
  - pig-ma → Figma 쓰기 (MCP 서버 경로)
  - 폰트 매핑 개선 (Figma Hand → 적절한 대체 폰트)
  - 리치텍스트 매핑 (TipTap ↔ characterStyleOverrides)
  - OAuth2 인증

## pig-ma 코어 개선

- [x] **중첩 그룹 선택/이동**
  - __group: 가상 선택 마커로 개별 obj selection indicator 숨김
  - customBounds 기반 전체 선택/이동/드래그
  - 자식 GroupBoundary 실시간 이동 (onDragMove)
  - 부모 그룹 isParentGroup → 전체 영역 드래그 가능

- [x] **커넥터 → 그룹 스냅**
  - findSnapTarget에 groups 파라미터 추가
  - GroupBoundary 외곽선 스냅 + __group: ID 자동 설정
  - ConnectorShapeRenderer에서 __group: 가상 CanvasObject 생성
  - 그룹 이동 시 커넥터 자동 추적

- [x] **텍스트 렌더링 통합 (Tiptap → Konva Text)**
  - TextBox, StickyNote, Shape 모두 Konva Text로 뷰 모드 렌더링
  - tiptapContent에서 스타일 추출 (extractFirstTextStyle)
  - 혼합 스타일 감지 (hasMixedStyles) → TextViewerOverlay 폴백
  - TEXT_CONFIG 패딩/lineHeight 일관성
  - Tiptap DOM 인스턴스 대폭 감소 (성능 10x 개선)

- [x] **그리드 dot 최적화**
  - Konva sceneFunc → CSS background-image pattern (GPU 가속)
  - 피그잼 스타일 20px 간격 촘촘한 dot
  - Stage container에 직접 적용 (z-index 충돌 없음)

- [x] **Line 캐싱**
  - CachedLine: 20+ 포인트 Line을 node.cache()로 비트맵 캐싱

- [ ] **FRAME 클리핑 (clipsContent)**
  - 이미지가 FRAME 내에서 크롭되는 동작 구현

- [ ] **커넥터 시작점 녹색 가이드**
  - ConnectionHandles가 GroupBoundary에서도 표시되도록

- [ ] **성능 추가 최적화**
  - 이미지 lazy loading
  - React 리렌더 최소화
  - WebGL 전환 검토 (PixiJS)

## P3 (Nice to have)

- [ ] **Storybook 설정**
  - 컴포넌트 문서화 및 시각적 테스트

- [ ] **Bundle analyzer 설정**
  - 번들 사이즈 모니터링

---

Created: 2026-03-26
Updated: 2026-04-01 (코어 개선 + 성능 최적화 완료)
