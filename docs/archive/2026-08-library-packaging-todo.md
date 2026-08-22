# Library Packaging TODO

라이브러리 패키징 후속 태스크 목록.

> **2026-08-19~20 대규모 정리 완료** — 이 파일의 항목 대부분이 완료되었습니다.
> 상세 작업 로그와 잔여 항목은 `docs/plans/2026-08-19-roadmap-checklist.md` 참조.

## 완료 (2026-08-19~20)

- [x] peerDependencies — react/react-dom + **konva/react-konva/@tiptap/* 외부화** (BREAKING, CHANGELOG 기록)
- [x] **preserveModules 빌드** — 팩토리-only 소비자 번들 1.65MB → ~1.4KB
- [x] package.json 메타데이터 (repository/homepage URL은 GitHub 공개 시 기입)
- [x] Consumer 프로젝트 설치 테스트 + 번들 사이즈 실측
- [x] createCircle factory export
- [x] README.md / CHANGELOG.md
- [x] Figma v0.2: 폰트 매핑 개선(실측 기반), 리치텍스트(characterStyleOverrides ↔ Tiptap) 양방향
- [x] FRAME 클리핑 (clipsContent → render API 래스터화)
- [x] 성능: 이미지 lazy loading(디코드 캐시), 리렌더 격리 수리 2건, tsc 523건 → 0건

## 잔여

- [ ] Figma OAuth2 인증 (PAT 1일 만료 해소 — Figma 앱 등록 필요, 사용자 결정 대기)
- [ ] Figma Export 플러그인 디버깅 (FigJam 실기 테스트 필요)
- [ ] WebGL 전환 검토 (PixiJS) — 대형 보드 벤치마크 후 판단
- [ ] Storybook / Bundle analyzer (P3)

---

Created: 2026-03-26
Updated: 2026-08-20 (패키징·성능 트랙 완료, 잔여 항목만 유지)
