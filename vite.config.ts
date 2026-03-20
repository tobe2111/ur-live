import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - single instance critical
          'react-core': ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
          // React ecosystem
          'react-router': ['react-router-dom'],
          // Firebase
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/analytics'],
          // TanStack Query
          'tanstack-query': ['@tanstack/react-query'],
          // Payment SDKs
          'payments': ['@stripe/stripe-js', '@stripe/react-stripe-js', '@tosspayments/payment-sdk', '@tosspayments/tosspayments-sdk'],
          // State management
          'zustand': ['zustand'],
          // UI libraries
          'radix-ui': [
            '@radix-ui/react-checkbox',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
          ],
          // Icons
          'lucide': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
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
