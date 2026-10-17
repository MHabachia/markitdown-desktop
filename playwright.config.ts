import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * End-to-end tests against the real backend and the web build of the UI.
 * The backend gets a throwaway data folder, so tests never touch real history/settings.
 */
export const E2E_DATA_DIR = process.env.MARKITDOWN_DATA_DIR ?? mkdtempSync(join(tmpdir(), 'markitdown-e2e-'));
process.env.MARKITDOWN_DATA_DIR = E2E_DATA_DIR;

const python = process.env.E2E_PYTHON ?? (process.platform === 'win32' ? '.venv\\Scripts\\python' : '.venv/bin/python');

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1400, height: 900 }
  },
  webServer: [
    {
      command: `${python} backend/api.py`,
      url: 'http://127.0.0.1:8765/api/health',
      env: { MARKITDOWN_DATA_DIR: E2E_DATA_DIR, MARKITDOWN_PORT: '8765' },
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 60_000
    }
  ]
});
