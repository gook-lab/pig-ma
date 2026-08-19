# Pig-ma Canvas Library

FigJam 스타일의 무한 캔버스 라이브러리. React + TypeScript + Konva.js 기반.

## Features

- **무한 캔버스**: 패닝 & 줌 (Figma 스타일 Cmd+스크롤)
- **다양한 도형**: 사각형, 원, 다각형, 플로우차트 도형
- **드로잉 도구**: 펜, 마커, 하이라이터
- **텍스트**: 리치 텍스트 편집, 폰트 스타일링
- **커넥터**: 도형 간 연결선, 자동 스냅
- **댓글 시스템**: FigJam 스타일 캡션/코멘트
- **컨텍스트 메뉴**: 우클릭 메뉴 (복사, 붙여넣기, Z-order 등)
- **Undo/Redo**: 히스토리 관리
- **로컬 저장**: localStorage 자동 저장

## Quick Start

```bash
npm install
npm run dev
```

## Documentation

- [Architecture](./ARCHITECTURE.md) - 전체 아키텍처 및 설계
- [Tools Guide](./TOOLS.md) - 도구별 상세 가이드
- [API Reference](./API.md) - 컴포넌트/훅 API
- [Types](./TYPES.md) - TypeScript 타입 정의

## Tech Stack

| 분야 | 기술 |
|------|------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Canvas | Konva.js (react-konva) |
| State | Zustand + zundo (undo/redo) + persist |
| Styling | TailwindCSS |
| Icons | Lucide React |

## Project Structure

```
src/
├── components/
│   ├── Canvas.tsx          # 메인 캔버스
│   ├── Toolbar.tsx         # 하단 도구 모음
│   ├── ContextMenu.tsx     # 우클릭 메뉴
│   ├── shapes/             # 도형 컴포넌트
│   │   ├── Rectangle.tsx
│   │   ├── Circle.tsx
│   │   ├── Shape.tsx       # 통합 도형 (다각형, 플로우차트)
│   │   ├── StickyNote.tsx
│   │   ├── TextBox.tsx
│   │   ├── Connector.tsx
│   │   └── Line.tsx
│   ├── captions/           # 댓글 시스템
│   └── ...
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useDragCoordinator.ts
│   └── ...
├── utils/
│   ├── factory.ts          # 객체 생성
│   ├── geometry.ts         # 기하학 계산
│   └── richText.ts         # 리치 텍스트 유틸
├── store.ts                # Zustand 상태 관리
├── types.ts                # TypeScript 타입
└── App.tsx
```

## License

MIT
