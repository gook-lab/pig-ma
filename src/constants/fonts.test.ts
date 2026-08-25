import { describe, it, expect } from "vitest";
import {
  DEFAULT_FONT_FAMILY,
  FONTS,
  FONT_FAMILY_IDS,
  FONT_OPTIONS,
  fontStack,
  SYSTEM_SANS_STACK,
} from "./fonts";

describe("폰트 레지스트리", () => {
  it("모든 토큰이 폴백까지 가진 스택을 갖는다", () => {
    // 폴백이 없으면 그 폰트가 없을 때 브라우저 기본(세리프)으로 떨어진다 —
    // Pretendard 가 정확히 그 상태였다.
    for (const id of FONT_FAMILY_IDS) {
      const { stack } = FONTS[id];
      expect(stack.split(",").length).toBeGreaterThan(1);
      expect(stack).toMatch(/(sans-serif|serif|monospace)\s*$/);
    }
  });

  it("스택은 자기 패밀리로 시작한다", () => {
    for (const id of FONT_FAMILY_IDS) {
      expect(
        FONTS[id].stack.startsWith(id) || FONTS[id].stack.startsWith(`"${id}"`),
      ).toBe(true);
    }
  });

  it("기본 토큰이 레지스트리에 있다", () => {
    expect(FONTS[DEFAULT_FONT_FAMILY]).toBeDefined();
  });

  it("드롭다운 목록이 레지스트리와 같은 집합이다", () => {
    expect(FONT_OPTIONS.map((o) => o.id)).toEqual(FONT_FAMILY_IDS);
    expect(FONT_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });
});

describe("fontStack", () => {
  it("토큰을 스택으로 푼다", () => {
    expect(fontStack("Nanum Gothic")).toBe(FONTS["Nanum Gothic"].stack);
  });

  it("비어 있으면 기본 토큰의 스택", () => {
    expect(fontStack()).toBe(FONTS[DEFAULT_FONT_FAMILY].stack);
    expect(fontStack(undefined)).toBe(FONTS[DEFAULT_FONT_FAMILY].stack);
    expect(fontStack(null)).toBe(FONTS[DEFAULT_FONT_FAMILY].stack);
    expect(fontStack("")).toBe(FONTS[DEFAULT_FONT_FAMILY].stack);
  });

  it("모르는 패밀리명은 그대로 통과시킨다", () => {
    // 외부 .pigma / Figma·Excalidraw import 가 담아 온 값 — 버리지 않는다
    expect(fontStack("Comic Sans MS")).toBe("Comic Sans MS");
  });

  it("이미 풀린 스택을 다시 넣어도 망가지지 않는다", () => {
    expect(fontStack(SYSTEM_SANS_STACK)).toBe(SYSTEM_SANS_STACK);
  });
});
