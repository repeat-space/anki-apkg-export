import { writeFile } from 'node:fs/promises';
import AnkiExport from 'anki-apkg-export';

const apkg = await AnkiExport.create('Japanese', { kind: 'reversed' });
try {
  apkg.addCards([
    { front: '東京', back: 'Tokyo', noteId: 'tokyo', tags: ['city'] },
    { front: '日本', back: 'Japan', noteId: 'japan' },
  ]);
  apkg.addCloze('The capital of {{c1::Japan}} is {{c2::Tokyo}}');
  const output = process.argv[2] ?? 'output.apkg';
  await writeFile(output, await apkg.save());
  console.log(output);
} finally {
  apkg.close();
}
