import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'anki-apkg-export-package-'));
function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}
const tarball = join(directory, 'anki-apkg-export.tgz');
run('corepack', ['pnpm', 'pack', '--out', tarball], process.cwd());
await writeFile(
  join(directory, 'package.json'),
  JSON.stringify({
    private: true,
    type: 'module',
    dependencies: { 'anki-apkg-export': `file:${tarball}` },
  }),
);
run('corepack', ['pnpm', 'install', '--ignore-scripts']);
const esm = `import {stat} from 'node:fs/promises';
import AnkiExport from 'anki-apkg-export';
import assert from 'node:assert/strict';
const exporter = await AnkiExport.create('Installed ESM');
try { exporter.addCard('Question', 'Answer'); assert((await exporter.save()).length > 0); }
finally {exporter.close();}
assert((await stat(new URL(import.meta.resolve('anki-apkg-export/sql-wasm.wasm')))).size > 0);`;
await writeFile(join(directory, 'esm.mjs'), esm);
await writeFile(
  join(directory, 'cjs.cjs'),
  `const {AnkiExport} = require('anki-apkg-export');
(async () => { const exporter = await AnkiExport.create('Installed CJS');
try {exporter.addCard('Question', 'Answer'); if (!(await exporter.save()).length) throw new Error('Empty output');}
finally {exporter.close();} })().catch(error => {console.error(error); process.exitCode = 1;});`,
);
await writeFile(
  join(directory, 'types.mts'),
  `import AnkiExport, {type CardInput} from 'anki-apkg-export';
const cards: CardInput[] = [{front: 'Front', back: 'Back', noteId: 'source-1'}];
const exporter = await AnkiExport.create('Typed');
exporter.addCards(cards);
const bytes: Uint8Array = await exporter.save();
const blob: Blob = await exporter.save({type: 'blob'});
const buffer: Buffer = await exporter.save({type: 'nodebuffer'});
exporter.close();
void [bytes, blob, buffer];`,
);
await writeFile(
  join(directory, 'types.cts'),
  `import {AnkiExport} from 'anki-apkg-export';
async function check() { const exporter = await AnkiExport.create('CJS types');
const bytes: Uint8Array = await exporter.save(); exporter.close(); return bytes; }
void check;`,
);
run('node', ['esm.mjs']);
run('node', ['cjs.cjs']);
run(resolve('node_modules/.bin/tsc'), [
  '--noEmit',
  '--strict',
  '--target',
  'ES2022',
  '--module',
  'NodeNext',
  '--moduleResolution',
  'NodeNext',
  'types.mts',
  'types.cts',
]);
console.log('Installed package: ESM, CommonJS, WASM and TypeScript declarations passed.');
