import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { version } from './package.json';
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  test: { include: ['tests/**/*.test.ts'] },
});
