import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['frontend/src/__tests__/wallet-rpc.integration.js'], testTimeout: 15000, fileParallelism: false } });
