import { describe, it, expect, beforeEach } from "vitest";
import {
  buildPigmaFile,
  parsePigmaFile,
  exportCurrentProject,
  applyPigmaFile,
  PigmaFileError,
  PIGMA_FILE_VERSION,
} from "./pigmaFile";
import { useCanvasStore } from "@/store";
import { createShape } from "@/utils/factory";
import type { PageData, ShapeSettings } from "@/types";

const SETTINGS = {
  fill: "#ffffff",
  stroke: "#000000",
  strokeWidth: 2,
} as unknown as ShapeSettings;

const store = () => useCanvasStore.getState();

function makePage(id: string, name = "page"): PageData {
  return {
    id,
    name,
    objects: [],
    groups: [],
    captions: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    canvasBounds: { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  store().clearAllObjects();
});

describe("buildPigmaFile", () => {
  it("현재 페이지 항목에 라이브 상태를 반영한다", () => {
    const pageA = makePage("a");
    const pageB = makePage("b");
    const liveShape = createShape(10, 20, "rectangle", SETTINGS);

    const file = buildPigmaFile({
      projectName: "테스트",
      pages: [pageA, pageB],
      currentPageId: "a",
      live: {
        objects: [liveShape],
        groups: [],
        captions: [],
        viewport: { x: 5, y: 6, zoom: 2 },
        canvasBounds: pageA.canvasBounds,
      },
    });

    expect(file.type).toBe("pigma");
    expect(file.version).toBe(PIGMA_FILE_VERSION);
    const savedA = file.pages.find((p) => p.id === "a")!;
    expect(savedA.objects.map((o) => o.id)).toEqual([liveShape.id]);
    expect(savedA.viewport.zoom).toBe(2);
    // 비활성 페이지는 그대로 유지
    expect(file.pages.find((p) => p.id === "b")!.objects).toHaveLength(0);
  });
});

describe("parsePigmaFile", () => {
  it("직렬화 → 파싱 라운드트립이 성립한다", () => {
    const page = makePage("a");
    page.objects = [createShape(1, 2, "circle", SETTINGS)];
    const file = buildPigmaFile({
      projectName: "라운드트립",
      pages: [page],
      currentPageId: "a",
      live: { ...page },
    });

    const parsed = parsePigmaFile(JSON.stringify(file));

    expect(parsed.projectName).toBe("라운드트립");
    expect(parsed.currentPageId).toBe("a");
    expect(parsed.pages[0]!.objects[0]!.id).toBe(page.objects[0]!.id);
  });

  it("JSON 이 아니면 거부한다", () => {
    expect(() => parsePigmaFile("not json {")).toThrow(PigmaFileError);
  });

  it("type 마커가 없으면 거부한다", () => {
    expect(() => parsePigmaFile(JSON.stringify({ pages: [] }))).toThrow(
      /Not a \.pigma file/,
    );
  });

  it("미래 버전 파일은 거부한다", () => {
    const file = { type: "pigma", version: 999, pages: [makePage("a")] };
    expect(() => parsePigmaFile(JSON.stringify(file))).toThrow(
      /Unsupported file version/,
    );
  });

  it("페이지가 없으면 거부한다", () => {
    const file = { type: "pigma", version: 1, pages: [] };
    expect(() => parsePigmaFile(JSON.stringify(file))).toThrow(/no pages/);
  });

  it("objects 배열이 없는 페이지는 거부한다", () => {
    const broken = { ...makePage("a"), objects: undefined };
    const file = { type: "pigma", version: 1, pages: [broken] };
    expect(() => parsePigmaFile(JSON.stringify(file))).toThrow(PigmaFileError);
  });

  it("currentPageId 가 없거나 잘못되면 첫 페이지로 폴백한다", () => {
    const file = {
      type: "pigma",
      version: 1,
      pages: [makePage("a"), makePage("b")],
      currentPageId: "없는페이지",
    };
    expect(parsePigmaFile(JSON.stringify(file)).currentPageId).toBe("a");
  });

  it("누락된 부가 필드(groups/captions/viewport)는 기본값으로 채운다", () => {
    const minimalPage = { id: "a", objects: [] };
    const file = { type: "pigma", version: 1, pages: [minimalPage] };
    const parsed = parsePigmaFile(JSON.stringify(file));
    expect(parsed.pages[0]!.groups).toEqual([]);
    expect(parsed.pages[0]!.captions).toEqual([]);
    expect(parsed.pages[0]!.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe("exportCurrentProject / applyPigmaFile", () => {
  it("내보낸 프로젝트를 다시 열면 상태가 복원된다", () => {
    const shape = createShape(100, 200, "rectangle", SETTINGS);
    store().addObject(shape);
    useCanvasStore.setState({ projectName: "저장 테스트" });

    const file = exportCurrentProject();

    // 상태 훼손 후 복원
    store().clearAllObjects();
    useCanvasStore.setState({ projectName: "다른 프로젝트" });
    expect(store().objects).toHaveLength(0);

    applyPigmaFile(file);

    expect(store().projectName).toBe("저장 테스트");
    expect(store().objects.map((o) => o.id)).toEqual([shape.id]);
    expect(store().selectedIds).toEqual([]);
    expect(store().currentPageId).toBe(file.currentPageId);
  });

  it("적용 시 undo 히스토리가 초기화된다", () => {
    store().addObject(createShape(0, 0, "rectangle", SETTINGS));
    const file = exportCurrentProject();

    applyPigmaFile(file);

    expect(useCanvasStore.temporal.getState().pastStates).toHaveLength(0);
  });
});
