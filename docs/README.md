# Pig-ma 문서

Pig-ma는 React 애플리케이션에 삽입할 수 있는 FigJam 스타일 무한 캔버스
라이브러리입니다. 설치와 기본 사용법은 저장소의 [README](../README.md)에서
먼저 확인할 수 있습니다.

## 문서 찾기

| 문서 | 읽을 때 |
|---|---|
| [도구 가이드](./TOOLS.md) | 캔버스 도구의 사용법과 단축키를 확인할 때 |
| [API 레퍼런스](./API.md) | 공개 컴포넌트·훅·스토어 API를 연동할 때 |
| [타입 레퍼런스](./TYPES.md) | `CanvasObject`와 세부 타입을 확인할 때 |
| [아키텍처](./ARCHITECTURE.md) | 렌더링·상태·저장 구조와 설계 이유를 이해할 때 |

## 기술 구성

| 영역 | 기술 |
|---|---|
| UI | React 18·19, TypeScript |
| 빌드 | Vite |
| 캔버스 | Konva, react-konva |
| 텍스트 편집 | Tiptap |
| 상태 | Zustand, zundo, persist |
| 스타일 | Tailwind CSS |
| 테스트 | Vitest, Playwright |

## 저장소 구조

```text
src/
├── components/          # 캔버스와 도구 UI
│   ├── captions/        # 댓글 패널과 마커
│   └── shapes/          # 도형별 렌더러
├── store/               # 상태 slice와 영속화·히스토리 처리
├── hooks/               # 키보드·드래그·자동 저장 동작
├── utils/               # 객체 생성, 기하 계산, 파일 변환
├── figma/               # Figma 변환
├── excalidraw/          # Excalidraw 변환
├── mermaid/             # Mermaid 파싱과 배치
└── index.ts             # npm 공개 API
```

진행 중인 작업은 [`plans`](./plans/)에, 완료된 설계 기록은
[`archive`](./archive/)에 분리되어 있습니다. 검토했지만 채택하지 않은 구조는
[`proposals`](./proposals/)에서 확인할 수 있습니다.

## 라이선스

[MIT](../LICENSE)
