import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { copyFileSync, cpSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-html-assets',
      closeBundle() {
        const files = ['splash.html', 'display.html', 'remote.html'];
        const distDir = path.resolve(__dirname, 'dist');
        if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
        files.forEach((f) => {
          const src = (f === 'remote.html') ? path.resolve(__dirname, 'public', f) : path.resolve(__dirname, f);
          const dest = path.join(distDir, f);
          try {
            copyFileSync(src, dest);
            console.log(`Copied ${f} to dist/`);
          } catch (e) {
            console.warn(`Could not copy ${f}:`, e.message);
          }
        });
        const slideEditorDir = path.resolve(__dirname, 'public/slide-editor');
        const distSlideEditor = path.join(distDir, 'slide-editor');
        if (existsSync(slideEditorDir)) {
          cpSync(slideEditorDir, distSlideEditor, { recursive: true });
          console.log('Copied slide-editor/ to dist/');
        }
        // Copy assets/bibles for bible service access at runtime
        const biblesSrc = path.resolve(__dirname, 'assets/bibles');
        const biblesDest = path.join(distDir, 'assets/bibles');
        if (existsSync(biblesSrc)) {
          cpSync(biblesSrc, biblesDest, { recursive: true });
          console.log('Copied assets/bibles/ to dist/');
        }
        ['fonts', 'themes', 'lowerthirds', 'fixtures'].forEach((dir) => {
          const src = path.resolve(__dirname, 'public', dir);
          const dest = path.join(distDir, dir);
          if (existsSync(src)) {
            cpSync(src, dest, { recursive: true });
            console.log(`Copied ${dir}/ to dist/`);
          }
        });
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        splash: path.resolve(__dirname, 'splash.html'),
        audienceDisplay: path.resolve(__dirname, 'audience-display.html'),
        browserDisplay: path.resolve(__dirname, 'browser-display.html'),
        stageDisplay: path.resolve(__dirname, 'stage-display.html'),
        stageDesigner: path.resolve(__dirname, 'stage-designer.html'),
        audienceDisplayFixture: path.resolve(__dirname, 'audience-display-fixture.html'),
        programSurfaceHarness: path.resolve(__dirname, 'program-surface-harness.html'),
        programSurfaceSingle: path.resolve(__dirname, 'program-surface-single.html'),
        dockPopout: path.resolve(__dirname, 'dock-popout.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('zustand')) {
              return 'vendor-store';
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
