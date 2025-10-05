import type { FullConfig } from '@playwright/test';
import baseConfig from './api-live.config';

const config: FullConfig = {
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4000',
  },
};

export default config;
