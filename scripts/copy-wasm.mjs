import { copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
await copyFile(require.resolve('sql.js/dist/sql-wasm.wasm'), 'dist/sql-wasm.wasm');
