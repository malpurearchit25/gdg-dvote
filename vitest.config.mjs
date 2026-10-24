import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['frontend/src/__tests__/*.test.{js,jsx}'], restoreMocks: true, testTimeout: 10000 },
});
