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
        const stageDisplayDir = path.resolve(__dirname, 'public/stage-display');
        const distStageDisplay = path.join(distDir, 'stage-display');
        if (existsSync(stageDisplayDir)) {
          cpSync(stageDisplayDir, distStageDisplay, { recursive: true });
          console.log('Copied stage-display/ to dist/');
        }
        // Copy assets/bibles for bible service access at runtime
        const biblesSrc = path.resolve(__dirname, 'assets/bibles');
        const biblesDest = path.join(distDir, 'assets/bibles');
        if (existsSync(biblesSrc)) {
          cpSync(biblesSrc, biblesDest, { recursive: true });
          console.log('Copied assets/bibles/ to dist/');
        }
        ['fonts', 'themes', 'lowerthirds'].forEach((dir) => {
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
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        splash: path.resolve(__dirname, 'splash.html'),
        display: path.resolve(__dirname, 'display.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
