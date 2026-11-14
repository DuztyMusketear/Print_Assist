import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.PRINT_ASSIST_API_PORT ?? 8000);
const webPort = Number(process.env.PRINT_ASSIST_WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: { port: webPort, strictPort: true, proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
  test: {
    environment: 'jsdom', setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8', include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test-setup.ts', 'src/test-fixtures.ts', 'src/main.tsx', 'src/types.ts'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
