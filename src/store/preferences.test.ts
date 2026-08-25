import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "./index";
import { DEFAULT_FONT_FAMILY } from "@/constants/fonts";
import { createShape, createStickyNote, createTextBox } from "@/utils/factory";
import type { ShapeSettings } from "@/types";

const SETTINGS: ShapeSettings = {
  fillColor: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 2,
};

const store = () => useCanvasStore.getState();

describe("defaultFontFamily 설정", () => {
  beforeEach(() => {
    store().setDefaultFontFamily(DEFAULT_FONT_FAMILY);
  });

  it("기본값은 레지스트리의 기본 토큰이다", () => {
    expect(store().defaultFontFamily).toBe(DEFAULT_FONT_FAMILY);
  });

  it("설정을 바꾸면 스토어에 남는다", () => {
    store().setDefaultFontFamily("Handwriting");
    expect(store().defaultFontFamily).toBe("Handwriting");
  });

  it("새로 만드는 객체가 설정된 폰트를 받는다", () => {
    // Canvas 가 이 값을 factory 에 넘긴다 — 여기서는 같은 계약을 직접 검증한다
    const family = "Handwriting" as const;
    expect(
      createStickyNote(0, 0, undefined, undefined, family).fontFamily,
    ).toBe(family);
    expect(createTextBox(0, 0, undefined, family).fontFamily).toBe(family);
    expect(
      createShape(0, 0, "rectangle", SETTINGS, undefined, family).fontFamily,
    ).toBe(family);
  });

  it("안 넘기면 기본 토큰으로 떨어진다 (기존 호출부 보호)", () => {
    expect(createStickyNote(0, 0).fontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(createTextBox(0, 0).fontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(createShape(0, 0, "rectangle", SETTINGS).fontFamily).toBe(
      DEFAULT_FONT_FAMILY,
    );
  });

  it("설정을 바꿔도 이미 있는 객체는 그대로다", () => {
    // 설정 한 번으로 문서 전체 서체가 바뀌면 되돌릴 방법이 없다
    const existing = createTextBox(0, 0, undefined, "Nanum Gothic");
    store().addObject(existing);

    store().setDefaultFontFamily("Handwriting");

    const after = store().objects.find((o) => o.id === existing.id)!;
    expect(after.fontFamily).toBe("Nanum Gothic");
  });
});
