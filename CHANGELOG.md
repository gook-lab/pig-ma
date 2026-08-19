# Changelog

All notable changes to **pig-ma** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `.pigma` project file save/open (File menu + canvas drag & drop)
- Connectors between copied shapes are now included on copy/paste, rebound to the pasted shapes
- Chart: label decimation for crowded X axes, `1.2K`-style value formatting, "No data" state for all-zero pie charts
- YouTube embeds letterbox to 16:9 — clicking the side margins selects the embed
- `createCircle` factory export

### Changed

- Selection UI (transformer handles) now renders on a dedicated layer above all objects and HTML viewer overlays
- Pasted connectors keep their authored elbow shape (rigid translation instead of reset)
- Figma import: `clipsContent` frames are rasterized via the render API so cropped content survives

### Fixed

- Elbow connector handle classification is now purely identity-based; center handles no longer disappear or sit off-center in reversed/top-anchor layouts
- Chart body double-click now opens title editing (was a no-op)

## [0.1.0] - 2026-08-19

### Added

- Initial library build: infinite canvas (React + Konva), shapes, sticky notes,
  text boxes, tables, charts (bar/line/pie), code blocks, embeds
- Straight / elbow / curved connectors with FigJam-style elbow authoring
- Rich text editing (Tiptap), @mentions, captions/comments, reactions
- Undo/redo (zundo, 500 steps, gesture debouncing), localStorage persistence
- Figma import (REST API) and export (SVG/JSON + FigJam plugin)
- PNG/JPEG/SVG image export, search, keyboard shortcuts, page system
