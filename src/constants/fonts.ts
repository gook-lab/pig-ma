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
   * 로드가 필요한 웹폰트 패밀리명. 시스템/설치 폰트에 기대는 토큰은 없다.
   * 로딩은 index.html 의 Google Fonts 링크가 담당한다.
   */
  webFont?: string;
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

export const FONTS: Record<FontFamily, FontDefinition> = {
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
    webFont: "Noto Sans KR",
  },
  "Nanum Gothic": {
    label: "Nanum Gothic",
    stack: `"Nanum Gothic", ${SYSTEM_SANS_STACK}`,
    webFont: "Nanum Gothic",
  },
  "Nanum Myeongjo": {
    label: "Nanum Myeongjo",
    stack: `"Nanum Myeongjo", Batang, serif`,
    webFont: "Nanum Myeongjo",
  },
  "IBM Plex Sans KR": {
    label: "IBM Plex",
    stack: `"IBM Plex Sans KR", ${SYSTEM_SANS_STACK}`,
    webFont: "IBM Plex Sans KR",
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
