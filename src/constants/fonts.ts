/**
 * 폰트 정본 — 토큰 → 실제 폰트 스택.
 *
 * `FontFamily` 는 **토큰**이지 CSS 패밀리명이 아니다. 토큰 하나가 여러 패밀리로
 * 풀리기 때문이다: 라틴과 한글을 다른 폰트로 받는 조합이 있고, 웹폰트가 아직
 * 안 붙었거나 설치돼 있지 않을 때 떨어질 자리가 필요하다.
 *
 * 폴백을 안 적으면 브라우저 기본 폰트(대개 세리프)로 떨어진다. 실제로
 * `"Pretendard"` 한 단어만 넘기고 있었고 그 폰트는 어디에서도 로드되지 않아,
 * 캔버스 텍스트 전부가 세리프로 그려지고 있었다 (2026-08-25 실측: 존재하지
 * 않는 폰트명과 측정 폭이 완전히 동일했다).
 */

import type { FontFamily } from "@/types";

export interface FontDefinition {
  /** 옵션바·설정에 보이는 이름 */
  label: string;
  /** Konva `fontFamily` 와 CSS `font-family` 에 그대로 넘기는 값 */
  stack: string;
  /**
   * 받아와야 하는 웹폰트 패밀리들. 시스템/설치 폰트에만 기대는 토큰은 비운다.
   * 실제 로딩은 index.html 의 Google Fonts 링크가 담당하고, 링크와 이 목록이
   * 어긋나지 않는지는 fonts.test.ts 가 확인한다.
   * 라틴·한글을 각각 받는 조합이 있어 배열이다.
   */
  webFonts?: string[];
}

/**
 * 어떤 토큰이든 끝에 붙는 폴백.
 *
 * 한글이 있는 문서라 한글 시스템 폰트를 먼저 세운다 — 라틴 전용 폰트를 고른
 * 경우에도 한글은 여기로 흘러내린다.
 */
export const SYSTEM_SANS_STACK =
  '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

/** 코드 블록처럼 고정폭이 필요한 자리 */
export const SYSTEM_MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/**
 * 손글씨 스택 — Excalidraw 느낌.
 *
 * Excalidraw 의 Excalifont 자체는 쓸 수 없다. Google Fonts 에 없고(자체 배포),
 * **한글 글리프가 아예 없다**. 그래서 라틴·한글을 각각 골라 짝지었다: 둘 다
 * 직립 손글씨체이고 획 두께가 비슷해 한 문장에 섞여도 어긋나지 않는다.
 * (흘림체인 Caveat·나눔펜스크립트는 캔버스 라벨 크기에서 읽기 어려워 탈락.)
 */
const HANDWRITING_STACK = '"Patrick Hand", Gaegu, cursive';

export const FONTS: Record<FontFamily, FontDefinition> = {
  // 웹폰트 없이 항상 뜨는 토큰 — 라이브러리 소비자가 폰트 설정을 전혀 하지
  // 않아도 이건 반드시 동작한다.
  System: {
    label: "System",
    stack: SYSTEM_SANS_STACK,
  },
  // Pretendard 는 웹폰트로 싣지 않는다 (한글 폰트라 용량이 크고, 라이브러리
  // 소비자에게 네트워크 의존을 강요하게 된다). 설치돼 있으면 쓰고 없으면
  // 시스템 산세리프로 떨어진다.
  Pretendard: {
    label: "Pretendard",
    stack: `Pretendard, ${SYSTEM_SANS_STACK}`,
  },
  "Noto Sans KR": {
    label: "Noto Sans",
    stack: `"Noto Sans KR", ${SYSTEM_SANS_STACK}`,
    webFonts: ["Noto Sans KR"],
  },
  "Nanum Gothic": {
    label: "Nanum Gothic",
    stack: `"Nanum Gothic", ${SYSTEM_SANS_STACK}`,
    webFonts: ["Nanum Gothic"],
  },
  "Nanum Myeongjo": {
    label: "Nanum Myeongjo",
    stack: `"Nanum Myeongjo", Batang, serif`,
    webFonts: ["Nanum Myeongjo"],
  },
  "IBM Plex Sans KR": {
    label: "IBM Plex",
    stack: `"IBM Plex Sans KR", ${SYSTEM_SANS_STACK}`,
    webFonts: ["IBM Plex Sans KR"],
  },
  // 라틴과 한글을 서로 다른 폰트로 받는 유일한 토큰 — 토큰을 CSS 패밀리명이
  // 아니라 스택으로 푸는 구조가 필요했던 이유다.
  Handwriting: {
    label: "Handwriting",
    stack: HANDWRITING_STACK,
    webFonts: ["Patrick Hand", "Gaegu"],
  },
};

/** 옵션바·설정 드롭다운이 쓰는 목록 — 세 곳에 중복돼 있던 것을 여기로 모았다 */
export const FONT_FAMILY_IDS = Object.keys(FONTS) as FontFamily[];

export const FONT_OPTIONS = FONT_FAMILY_IDS.map((id) => ({
  id,
  label: FONTS[id].label,
}));

/** 새로 만드는 객체와, fontFamily 가 비어 있는 객체가 쓰는 토큰 */
export const DEFAULT_FONT_FAMILY: FontFamily = "Pretendard";

/**
 * 토큰을 실제 폰트 스택으로 푼다. 렌더·측정에 넘기기 직전에 한 번 통과시킨다.
 *
 * 모르는 값은 그대로 돌려준다 — 외부에서 들어온 .pigma 나 Figma/Excalidraw
 * import 가 레지스트리에 없는 패밀리명을 담고 있을 수 있고, 그건 버리는
 * 것보다 브라우저에 맡기는 편이 낫다.
 */
export function fontStack(family?: string | null): string {
  if (!family) return FONTS[DEFAULT_FONT_FAMILY].stack;
  const known = FONTS[family as FontFamily];
  return known ? known.stack : family;
}
