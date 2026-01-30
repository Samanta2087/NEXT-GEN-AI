import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
      ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer(),
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner(),
        ),
      ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Enable source maps for production debugging (optional)
    sourcemap: false,
    // Code splitting for better caching and smaller initial bundle
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React dependencies
          'vendor-react': ['react', 'react-dom'],
          // UI components (loaded together)
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-tabs', '@radix-ui/react-slider', '@radix-ui/react-switch', '@radix-ui/react-tooltip'],
          // Framer motion (defer if possible)
          'vendor-motion': ['framer-motion'],
          // Query client
          'vendor-query': ['@tanstack/react-query'],
          // Icons
          'vendor-icons': ['lucide-react'],
        },
        // Use content hash for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 500,
    // Enable minification with esbuild (faster than terser)
    minify: 'esbuild',
    // CSS code splitting
    cssCodeSplit: true,
    // Inline small assets
    assetsInlineLimit: 4096,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'wouter', 'framer-motion', '@tanstack/react-query'],
    exclude: ['@replit/vite-plugin-cartographer', '@replit/vite-plugin-dev-banner'],
  },
  // CSS preprocessing
  css: {
    devSourcemap: true,
  },
  // Enable experimental features
  esbuild: {
    // Remove console.log in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
