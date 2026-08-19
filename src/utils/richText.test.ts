import { describe, it, expect } from "vitest";
import {
  textToRichText,
  richTextToPlainText,
  mergeAdjacentSegments,
  splitAndApplyStyle,
  toggleStyleInRange,
  getCharIndexFromSegments,
  getSegmentFromCharIndex,
} from "./richText";
import type { TextSegment } from "@/types";

const plain = (segs: TextSegment[]) => richTextToPlainText(segs);

describe("평문 ↔ 리치텍스트", () => {
  it("왕복해도 글자가 보존된다", () => {
    for (const t of ["", "hello", "한글 텍스트", "여러\n줄\n입니다"]) {
      expect(plain(textToRichText(t))).toBe(t);
    }
  });

  it("빈 문자열은 빈 배열이다", () => {
    expect(textToRichText("")).toEqual([]);
    expect(plain([])).toBe("");
  });
});

describe("인접 세그먼트 병합", () => {
  it("같은 스타일끼리 합쳐진다", () => {
    const merged = mergeAdjacentSegments([
      { text: "ab" },
      { text: "cd" },
      { text: "ef" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.text).toBe("abcdef");
  });

  it("스타일이 다르면 안 합친다", () => {
    const merged = mergeAdjacentSegments([
      { text: "ab" },
      { text: "cd", fontWeight: "bold" },
      { text: "ef" },
    ]);
    expect(merged).toHaveLength(3);
  });

  it("병합해도 평문은 그대로다", () => {
    const segs: TextSegment[] = [
      { text: "a" },
      { text: "b" },
      { text: "c", fontWeight: "bold" },
      { text: "d", fontWeight: "bold" },
      { text: "e" },
    ];
    expect(plain(mergeAdjacentSegments(segs))).toBe(plain(segs));
    expect(mergeAdjacentSegments(segs)).toHaveLength(3);
  });

  it("빈 텍스트 세그먼트는 사라진다", () => {
    const merged = mergeAdjacentSegments([
      { text: "" },
      { text: "x", fontWeight: "bold" },
    ]);
    expect(plain(merged)).toBe("x");
  });

  it("빈 배열은 빈 배열이다", () => {
    expect(mergeAdjacentSegments([])).toEqual([]);
  });
});

describe("범위에 스타일 적용", () => {
  const base: TextSegment[] = [{ text: "0123456789" }];

  it("가운데 구간만 굵어진다", () => {
    const out = splitAndApplyStyle(base, 3, 6, { fontWeight: "bold" });

    expect(plain(out)).toBe("0123456789");
    const bold = out.filter((s) => s.fontWeight === "bold");
    expect(plain(bold)).toBe("345");
  });

  it("전체를 지정하면 전부 굵어진다", () => {
    const out = splitAndApplyStyle(base, 0, 10, { fontWeight: "bold" });
    expect(out.every((s) => s.fontWeight === "bold")).toBe(true);
    expect(plain(out)).toBe("0123456789");
  });

  it("빈 범위는 글자를 바꾸지 않는다", () => {
    expect(plain(splitAndApplyStyle(base, 4, 4, { fontWeight: "bold" }))).toBe(
      "0123456789",
    );
  });

  it("여러 번 적용해도 글자 수가 유지된다", () => {
    let segs = base;
    segs = splitAndApplyStyle(segs, 1, 4, { fontWeight: "bold" });
    segs = splitAndApplyStyle(segs, 3, 8, { textColor: "#f00" });
    segs = splitAndApplyStyle(segs, 0, 10, { fontSize: 20 });

    expect(plain(segs)).toBe("0123456789");
  });

  it("겹쳐 적용하면 두 스타일이 함께 남는다", () => {
    let segs = splitAndApplyStyle(base, 2, 6, { fontWeight: "bold" });
    segs = splitAndApplyStyle(segs, 4, 8, { textColor: "#f00" });

    const both = segs.filter(
      (s) => s.fontWeight === "bold" && s.textColor === "#f00",
    );
    expect(plain(both)).toBe("45");
  });

  it("경계를 넘겨도 터지지 않는다", () => {
    expect(() =>
      splitAndApplyStyle(base, -5, 999, { fontWeight: "bold" }),
    ).not.toThrow();
    expect(
      plain(splitAndApplyStyle(base, -5, 999, { fontWeight: "bold" })),
    ).toBe("0123456789");
  });
});

describe("스타일 토글", () => {
  const base: TextSegment[] = [{ text: "0123456789" }];

  it("한 번 누르면 켜지고 다시 누르면 꺼진다", () => {
    const on = toggleStyleInRange(base, 2, 5, "fontWeight", "bold");
    expect(plain(on.filter((s) => s.fontWeight === "bold"))).toBe("234");

    const off = toggleStyleInRange(on, 2, 5, "fontWeight", "bold");
    expect(off.filter((s) => s.fontWeight === "bold")).toHaveLength(0);
    expect(plain(off)).toBe("0123456789");
  });

  it("토글해도 글자는 절대 변하지 않는다", () => {
    let segs = base;
    for (let i = 0; i < 5; i++) {
      segs = toggleStyleInRange(segs, i, i + 3, "fontWeight", "bold");
      expect(plain(segs)).toBe("0123456789");
    }
  });
});

describe("문자 인덱스 ↔ 세그먼트", () => {
  const segs: TextSegment[] = [
    { text: "abc" },
    { text: "de", fontWeight: "bold" },
    { text: "fgh" },
  ];

  it("세그먼트/오프셋 → 전체 인덱스", () => {
    expect(getCharIndexFromSegments(segs, 0, 0)).toBe(0);
    expect(getCharIndexFromSegments(segs, 1, 1)).toBe(4);
    expect(getCharIndexFromSegments(segs, 2, 3)).toBe(8);
  });

  it("전체 인덱스 → 세그먼트/오프셋", () => {
    expect(getSegmentFromCharIndex(segs, 0)).toMatchObject({
      segmentIndex: 0,
      charOffset: 0,
    });
    expect(getSegmentFromCharIndex(segs, 4)).toMatchObject({
      segmentIndex: 1,
      charOffset: 1,
    });
  });

  it("두 변환은 서로의 역이다", () => {
    const total = plain(segs).length;
    for (let i = 0; i <= total; i++) {
      const { segmentIndex, charOffset } = getSegmentFromCharIndex(segs, i);
      expect(getCharIndexFromSegments(segs, segmentIndex, charOffset)).toBe(i);
    }
  });
});
