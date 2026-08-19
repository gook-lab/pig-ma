import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import dts from "vite-plugin-dts";

export default defineConfig(({ mode }) => {
  const isLibraryBuild = mode === "lib";

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isLibraryBuild
        ? [
            dts({
              include: ["src"],
              exclude: ["src/main.tsx", "src/App.tsx"],
              rollupTypes: false,
              outDir: "dist",
              insertTypesEntry: true,
              tsconfigPath: "./tsconfig.lib.json",
            }),
          ]
        : []),
    ],
    server: {
      host: true, // 0.0.0.0으로 바인딩하여 네트워크에서 접근 가능
      port: 3874,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: isLibraryBuild
      ? {
          lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "PigMa",
            formats: ["es", "cjs"],
          },
          rollupOptions: {
            // konva/react-konva/@tiptap/* 는 peerDependencies 로 외부화한다.
            // 단일 파일에 내장하면 팩토리 하나만 import 해도 1.6MB+ 를 부담
            // (tree-shaking ~22%뿐). 서브패스 import(konva/lib/... 등)까지
            // 정규식으로 매칭해야 한다.
            external: [
              "react",
              "react-dom",
              "react/jsx-runtime",
              /^konva(\/.*)?$/,
              /^react-konva(\/.*)?$/,
              /^@tiptap\//,
            ],
            // preserveModules: 소스 모듈 구조를 dist 에 그대로 유지한다.
            // 단일 파일 번들에서는 createShape 하나만 import 해도 전체
            // (lucide/lowlight/컴포넌트)를 로드했다 — 모듈별 파일이면
            // 소비자 번들러가 안 쓰는 모듈을 통째로 떨군다.
            // 공통 설정을 두 포맷에 복제하는 이유: 포맷별로 파일 확장자
            // (.js/.cjs)를 달리해야 해서 output 이 배열이어야 한다.
            output: (["es", "cjs"] as const).map((format) => ({
              format,
              preserveModules: true,
              preserveModulesRoot: "src",
              // 번들되는 의존성(@google/genai 등)은 rollup 이
              // node_modules/... 경로로 보존한다 — 일부 소비자 툴링이
              // node_modules 경로를 특별 취급(transform 제외 등)하므로
              // vendor/ 로 옮긴다.
              entryFileNames: (chunk: { name: string }) =>
                `${chunk.name.replace(/node_modules/g, "vendor")}.${
                  format === "es" ? "js" : "cjs"
                }`,
              exports: "named" as const,
              // CJS 출력에서 default import 인터롭을 런타임 __esModule 체크로.
              // 기본값('default')은 네임스페이스를 그대로 default 로 취급해서
              // @tiptap/* (CJS 에 __esModule + .default) require 시
              // "StarterKit.configure is not a function" 으로 깨진다.
              interop: "auto" as const,
              globals: {
                react: "React",
                "react-dom": "ReactDOM",
                "react/jsx-runtime": "jsxRuntime",
              },
              assetFileNames: (assetInfo: { name?: string }) => {
                if (assetInfo.name?.endsWith(".css")) return "styles.css";
                return assetInfo.name ?? "assets/[name][extname]";
              },
            })),
          },
          sourcemap: true,
          minify: "esbuild",
          cssCodeSplit: false,
        }
      : undefined,
  };
});
