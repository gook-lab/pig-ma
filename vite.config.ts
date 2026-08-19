import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  const isLibraryBuild = mode === 'lib';

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isLibraryBuild
        ? [
            dts({
              include: ['src'],
              exclude: ['src/main.tsx', 'src/App.tsx'],
              rollupTypes: false,
              outDir: 'dist',
              insertTypesEntry: true,
              tsconfigPath: './tsconfig.lib.json',
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
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: isLibraryBuild
      ? {
          lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            name: 'PigMa',
            formats: ['es', 'cjs'],
            fileName: (format) => `pig-ma.${format === 'es' ? 'js' : 'cjs'}`,
          },
          rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime'],
            output: {
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
                'react/jsx-runtime': 'jsxRuntime',
              },
              assetFileNames: (assetInfo) => {
                if (assetInfo.name?.endsWith('.css')) return 'styles.css';
                return assetInfo.name ?? 'assets/[name][extname]';
              },
            },
          },
          sourcemap: true,
          minify: 'esbuild',
          cssCodeSplit: false,
        }
      : undefined,
  };
});
