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
            fileName: (format) => `pig-ma.${format === "es" ? "js" : "cjs"}`,
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
            output: {
              // CJS 출력에서 default import 인터롭을 런타임 __esModule 체크로.
              // 기본값('default')은 네임스페이스를 그대로 default 로 취급해서
              // @tiptap/* (CJS 에 __esModule + .default) require 시
              // "StarterKit.configure is not a function" 으로 깨진다.
              interop: "auto",
              globals: {
                react: "React",
                "react-dom": "ReactDOM",
                "react/jsx-runtime": "jsxRuntime",
              },
              assetFileNames: (assetInfo) => {
                if (assetInfo.name?.endsWith(".css")) return "styles.css";
                return assetInfo.name ?? "assets/[name][extname]";
              },
            },
          },
          sourcemap: true,
          minify: "esbuild",
          cssCodeSplit: false,
        }
      : undefined,
  };
});
