import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

// The data source reads DATA_DIR at import time, so it has to be set before any
// test file loads. Each run gets its own directory so tests never touch a real
// bananabook.db.
const dataDir = path.join(os.tmpdir(), `bananabook-test-${process.pid}`);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    env: { DATA_DIR: dataDir, NODE_ENV: 'test' },
    // TypeORM entities use decorators and shared connection state.
    fileParallelism: false,
  },
});
