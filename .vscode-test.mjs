import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  version: '1.95.3',
  workspaceFolder: './src/test/fixtures',
  installExtensions: ['ms-azure-devops.azure-pipelines'],
  mocha: {
    timeout: 30_000,
  },
  launchArgs: ['--disable-workspace-trust'],
});
