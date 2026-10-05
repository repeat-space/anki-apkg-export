import { afterEach, describe, expect, it } from 'vitest';
import SQL from 'sql.js';
import JSZip from 'jszip';
import Exporter from '../src/exporter';
import createTemplate from '../src/template';

const exporters = [];
function create() {
  const exporter = new Exporter('Test deck', { sql: SQL, template: createTemplate() });
  exporters.push(exporter);
  return exporter;
}
afterEach(() => {
  for (const exporter of exporters.splice(0)) exporter.db.close();
});

describe('package export', () => {
  it('writes notes, cards, tags and binary media to an APKG', async () => {
    const exporter = create();
    exporter.addCard('東京', 'Tokyo', { tags: ['Japan', 'two words'] });
    exporter.addCard('Image', '<img src="image.png">');
    exporter.addMedia('image.png', new Uint8Array([0, 127, 255]));
    const zip = await JSZip.loadAsync(await exporter.save());
    expect(Object.keys(zip.files).sort()).toEqual(['0', 'collection.anki2', 'media']);
    expect(JSON.parse(await zip.file('media').async('string'))).toEqual({ 0: 'image.png' });
    expect(await zip.file('0').async('uint8array')).toEqual(new Uint8Array([0, 127, 255]));
    const db = new SQL.Database(await zip.file('collection.anki2').async('uint8array'));
    try {
      expect(db.exec('PRAGMA integrity_check')[0].values).toEqual([['ok']]);
      expect(db.exec('SELECT flds, tags FROM notes ORDER BY id')[0].values).toEqual([
        ['東京\u001fTokyo', ' Japan two_words '],
        ['Image\u001f<img src="image.png">', ''],
      ]);
      expect(
        db.exec('SELECT count(*) FROM cards JOIN notes ON cards.nid = notes.id')[0].values,
      ).toEqual([[2]]);
    } finally {
      db.close();
    }
  });

  it('deduplicates identical notes and allocates distinct IDs', () => {
    const exporter = create();
    exporter.addCard('Front', 'Back');
    exporter.addCard('Front', 'Back', { tags: ['updated'] });
    exporter.addCard('Other', 'Back');
    expect(exporter.db.exec('SELECT count(*) FROM notes')[0].values).toEqual([[2]]);
    expect(exporter.db.exec('SELECT count(*) FROM cards')[0].values).toEqual([[2]]);
    expect(exporter.db.exec("SELECT tags FROM notes WHERE sfld = 'Front'")[0].values).toEqual([
      [' updated '],
    ]);
  });
});
