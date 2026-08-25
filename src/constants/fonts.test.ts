import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
      expect(stack).toMatch(/(sans-serif|serif|monospace|cursive)\s*$/);
    }
  });

  it("선언한 웹폰트는 자기 스택 안에 있다", () => {
    // 스택에 없는 폰트를 받아오면 로딩만 하고 쓰지는 않는 셈이다
    for (const id of FONT_FAMILY_IDS) {
      for (const family of FONTS[id].webFonts ?? []) {
        expect(FONTS[id].stack).toContain(family);
      }
    }
  });

  it("손글씨 토큰은 라틴과 한글을 모두 덮는다", () => {
    // Excalifont 에 한글이 없어서 두 폰트를 짝지은 토큰이다 — 한쪽이 빠지면
    // 한글만 시스템 폰트로 튀어 한 문장에서 서체가 갈린다.
    expect(FONTS.Handwriting.webFonts).toEqual(["Patrick Hand", "Gaegu"]);
  });

  it("기본 토큰이 레지스트리에 있다", () => {
    expect(FONTS[DEFAULT_FONT_FAMILY]).toBeDefined();
  });

  it("드롭다운 목록이 레지스트리와 같은 집합이다", () => {
    expect(FONT_OPTIONS.map((o) => o.id)).toEqual(FONT_FAMILY_IDS);
    expect(FONT_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });
});

describe("index.html 웹폰트 링크", () => {
  // 레지스트리에 폰트를 넣고 링크를 안 고치면 그 폰트는 조용히 폴백으로
  // 그려진다 — Pretendard 가 정확히 그 상태였다.
  const html = readFileSync(
    resolve(__dirname, "../../index.html"),
    "utf8",
  ).replace(/\+/g, " ");

  it("선언한 웹폰트를 전부 받아온다", () => {
    for (const id of FONT_FAMILY_IDS) {
      for (const family of FONTS[id].webFonts ?? []) {
        expect(html, `${id} 의 ${family} 가 index.html 에 없다`).toContain(
          `family=${family}`,
        );
      }
    }
  });

  it("웹폰트가 아닌 토큰은 받아오지 않는다", () => {
    // System 은 네트워크 없이 떠야 한다 — 링크에 있으면 그 전제가 깨진다
    expect(FONTS.System.webFonts ?? []).toEqual([]);
    expect(html).not.toContain("family=System");
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
