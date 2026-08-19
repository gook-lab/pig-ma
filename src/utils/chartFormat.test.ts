import { describe, it, expect } from "vitest";
import {
  formatChartValue,
  roundTickValue,
  estimateLabelWidth,
  getLabelStep,
} from "./chart";

describe("formatChartValue", () => {
  it("1000 미만은 그대로 (소수 1자리까지)", () => {
    expect(formatChartValue(0)).toBe("0");
    expect(formatChartValue(999)).toBe("999");
    expect(formatChartValue(2.54)).toBe("2.5");
  });

  it("1000 이상은 K/M/B 축약", () => {
    expect(formatChartValue(1000)).toBe("1K");
    expect(formatChartValue(1234)).toBe("1.2K");
    expect(formatChartValue(123456)).toBe("123K");
    expect(formatChartValue(1500000)).toBe("1.5M");
    expect(formatChartValue(2000000000)).toBe("2B");
  });

  it("음수도 축약된다", () => {
    expect(formatChartValue(-1234)).toBe("-1.2K");
    expect(formatChartValue(-500)).toBe("-500");
  });

  it("비정상 값은 0", () => {
    expect(formatChartValue(NaN)).toBe("0");
    expect(formatChartValue(Infinity)).toBe("0");
  });
});

describe("roundTickValue", () => {
  it("범위가 넓으면 정수", () => {
    expect(roundTickValue(2.5, 40)).toBe(3);
    expect(roundTickValue(17.4, 100)).toBe(17);
  });

  it("범위가 좁으면(10 미만) 소수 1자리 — 틱 중복 방지", () => {
    expect(roundTickValue(0.25, 1)).toBe(0.3);
    expect(roundTickValue(0.5, 2)).toBe(0.5);
  });
});

describe("estimateLabelWidth", () => {
  it("라틴 문자는 fontSize*0.6", () => {
    expect(estimateLabelWidth("abc", 10)).toBeCloseTo(18);
  });

  it("한글은 fontSize 전체 폭", () => {
    expect(estimateLabelWidth("한글", 10)).toBeCloseTo(20);
  });
});

describe("getLabelStep", () => {
  it("라벨이 슬롯에 들어가면 1 (모두 표시)", () => {
    expect(getLabelStep(18, 40)).toBe(1);
  });

  it("라벨이 슬롯보다 넓으면 건너뛰는 간격", () => {
    expect(getLabelStep(50, 40)).toBe(2);
    expect(getLabelStep(130, 40)).toBe(4);
  });

  it("슬롯 폭이 0/음수/무한이면 1로 방어", () => {
    expect(getLabelStep(50, 0)).toBe(1);
    expect(getLabelStep(50, -5)).toBe(1);
    expect(getLabelStep(0, 40)).toBe(1);
  });
});
