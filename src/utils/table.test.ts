import { describe, it, expect } from "vitest";
import { getCanvasCellContentBox, getEditorCellContentBox } from "./table";
import { TABLE_DEFAULTS } from "@/constants/table";

const W = TABLE_DEFAULTS.colWidth; // 120
const H = TABLE_DEFAULTS.rowHeight; // 40

describe("셀 텍스트 영역은 캔버스와 편집 오버레이가 같아야 한다", () => {
  it("테두리를 레이아웃에서 빼면(outline) 두 영역이 정확히 일치한다", () => {
    expect(getEditorCellContentBox(W, H, 0)).toEqual(
      getCanvasCellContentBox(W, H),
    );
  });

  it("border 2px 를 레이아웃에 넣으면 가로 4px·세로 4px 이 어긋난다 (기존 버그)", () => {
    const canvas = getCanvasCellContentBox(W, H);
    const withBorder = getEditorCellContentBox(W, H, 2);

    expect(canvas.width - withBorder.width).toBe(4);
    expect(canvas.height - withBorder.height).toBe(4);
  });

  it("셀 크기가 달라져도 일치가 유지된다", () => {
    for (const [w, h] of [
      [80, 24],
      [200, 60],
      [333, 41],
    ] as const) {
      expect(getEditorCellContentBox(w, h, 0)).toEqual(
        getCanvasCellContentBox(w, h),
      );
    }
  });
});
