import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.config.*',
        '**/*.d.ts',
        '**/types/**',
        'scripts/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/worker.ts',
        'src/lib/firebase.ts',
        'src/lib/firebaseAdmin.ts',
        // Exclude pages, services, and utils from coverage threshold
        'src/pages/**',
        'src/services/**',
        'src/utils/**',
        'src/worker/**',
        'src/shared/**',
        'src/styles/**',
        'src/hooks/**',
        'src/layouts/**',
      ],
      include: [
        'src/components/**/*.{ts,tsx}',
      ],
      all: true,
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
        autoUpdate: false,
      },
      watermarks: {
        lines: [80, 95],
        functions: [80, 95],
        branches: [75, 90],
        statements: [80, 95],
      }
    },
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.wrangler'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
