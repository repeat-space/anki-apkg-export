import { mkdir, readFile, writeFile } from 'node:fs/promises';
import AnkiExport from '../dist/index.js';

await mkdir('.tmp/anki', { recursive: true });
const now = Date.now();
const originalNow = Date.now;
try {
  for (const [name, offset, answer] of [
    ['first', -10000, 'Old answer'],
    ['updated', 0, 'Tokyo'],
  ]) {
    Date.now = () => now + offset;
    const apkg = await AnkiExport.create('Languages', {
      deckId: 10001,
      modelId: 10002,
      kind: 'reversed',
    });
    try {
      apkg.addCard(name === 'first' ? '東京' : '東京 (Tokyo)', answer, {
        noteId: 'tokyo',
        tags: ['city'],
        deck: 'Languages::Japanese::Cities',
      });
      apkg.addCloze('The capital of {{c1::{{c3::Japan}}}} is Tokyo', 'Geography', {
        noteId: 'capital',
        deck: 'Languages::Japanese',
      });
      const modelId = apkg.addModel({
        id: 10003,
        name: 'Vocabulary',
        fields: ['Word', 'Reading', 'Meaning'],
        templates: [
          {
            name: 'Meaning',
            questionFormat: '{{Word}}',
            answerFormat: '{{Meaning}}',
            requiredFields: ['Word'],
          },
          {
            name: 'Reading',
            questionFormat: '{{Reading}}',
            answerFormat: '{{Word}}',
            requiredFields: ['Reading'],
          },
        ],
      });
      apkg.addNote(['<img src="anki.png"> 日本', 'にほん [sound:test.mp3]', 'Japan'], {
        modelId,
        noteId: 'japan',
      });
      apkg.addMedia('anki.png', await readFile('test/fixtures/anki.png'));
      apkg.addMedia('test.mp3', new Uint8Array([0, 1, 2, 255]));
      await writeFile(`.tmp/anki/${name}.apkg`, await apkg.save());
    } finally {
      apkg.close();
    }
  }
} finally {
  Date.now = originalNow;
}
