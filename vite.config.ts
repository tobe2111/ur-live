import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Large vendor libraries
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // Firebase
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            // UI libraries
            if (id.includes('@radix-ui') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            // State & utilities
            if (id.includes('zustand') || id.includes('i18next') || id.includes('date-fns')) {
              return 'vendor-utils';
            }
            // All other node_modules
            return 'vendor';
          }
          
          // Seller feature pages (lazy-loaded)
          if (id.includes('/pages/Seller') && !id.includes('Page.tsx?')) {
            return 'feature-seller';
          }
          
          // Admin feature pages (lazy-loaded)
          if (id.includes('/pages/Admin') && !id.includes('Page.tsx?')) {
            return 'feature-admin';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500, // Reduced from default 500KB
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
