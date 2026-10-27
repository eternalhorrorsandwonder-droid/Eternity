import { defineConfig } from 'vite';

// The whole game is a static bundle: no server-side anything.
// Manual chunking keeps the initial parse cheap on mobile.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The game is served to a sandboxed preview hostname that is not
    // predictable in advance, so the host check has to be permissive here.
    allowedHosts: true,
    // Browsers on the same network can reach the preview directly.
    cors: true,
  },
  worker: {
    format: 'es',
  },
});
