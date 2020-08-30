import test from 'ava';

import fs from 'fs';
import { execFile } from 'child_process';
import sqlite3 from 'sqlite3';
import isArrayBufferEqual from 'arraybuffer-equal';

import pify from 'pify';
import sinon from 'sinon';
import sortBy from 'lodash.sortby';
import initSqlJs from 'sql.js';

import AnkiExport from '../src';
import { addCards, unzipDeckToDir } from './_helpers';

const tmpDir = '/tmp';
const dest = tmpDir + '/result.apkg';
const destUnpacked = tmpDir + '/unpacked_result';
const destUnpackedDb = destUnpacked + '/collection.anki2';
const SEPARATOR = '\u001F';

test.beforeEach(async () => pify(execFile)('rm', ['-rf', dest, destUnpacked]));

test('equals to sample', async t => {
  const now = 1482680798652;
  const clock = sinon.useFakeTimers(now);

  const sql = await initSqlJs();
  const apkg = new AnkiExport({
    deckName: 'deck-name',
    template: {},
    sql
  });

  apkg.addMedia('anki.png', fs.readFileSync(__dirname + '/fixtures/anki.png'));

  apkg.addCard('card #1 front', 'card #1 back', { tags: ['food', 'fruit'] });
  apkg.addCard('card #2 front', 'card #2 back');
  apkg.addCard('card #3 with image <img src="anki.png" />', 'card #3 back');

  const zip = await apkg.save();
  fs.writeFileSync(dest, zip, 'binary');

  t.true(zip instanceof Buffer);

  const sampleZip = fs.readFileSync(`${__dirname}/fixtures/output.apkg`);
  const destZip = fs.readFileSync(dest);
  t.true(isArrayBufferEqual(destZip.buffer, sampleZip.buffer));

  sinon.restore();
  clock.restore();
});

test('check internal structure', async t => {
  // Create deck as in previous example
  const sql = await initSqlJs();
  const apkg = new AnkiExport({
    deckName: 'deck-name',
    template: {},
    sql
  });
  const cards = [
    { front: 'card #1 front', back: 'card #1 back' },
    { front: 'card #2 front', back: 'card #2 back' },
    { front: 'card #3 with image <img src="anki.png" />', back: 'card #3 back' }
  ];
  addCards(apkg, cards);
  const zip = await apkg.save();
  fs.writeFileSync(dest, zip, 'binary');

  // extract dec to tmp directory
  await unzipDeckToDir(dest, destUnpacked);
  // analize db via sqlite
  const db = new sqlite3.Database(destUnpackedDb);
  const result = await pify(db.all.bind(db))(
    `SELECT
      notes.sfld as front,
      notes.flds as back
      from cards JOIN notes where cards.nid = notes.id ORDER BY cards.id`
  );
  db.close();

  // compare content from just created db with original list of cards
  const normilizedResult = sortBy(
    result.map(({ front, back }) => ({
      front,
      back: back.split(SEPARATOR).pop()
    })),
    'front'
  );

  t.deepEqual(normilizedResult, cards);
});

test('check internal structure on adding card with tags', async t => {
  const decFile = `${dest}_with_tags.apkg`;
  const unzipedDeck = `${destUnpacked}_with_tags`;
  const sql = await initSqlJs();
  const apkg = new AnkiExport({
    deckName: 'deck-name',
    template: {},
    sql
  });
  const [front1, back1, tags1] = ['Card front side 1', 'Card back side 1', ['some', 'tag', 'tags with multiple words']];
  const [front2, back2, tags2] = ['Card front side 2', 'Card back side 2', 'some strin_tags'];
  const [front3, back3] = ['Card front side 3', 'Card back side 3'];
  apkg.addCard(front1, back1, { tags: tags1 });
  apkg.addCard(front2, back2, { tags: tags2 });
  apkg.addCard(front3, back3);

  const zip = await apkg.save();
  fs.writeFileSync(decFile, zip, 'binary');

  await unzipDeckToDir(decFile, unzipedDeck);
  const db = new sqlite3.Database(`${unzipedDeck}/collection.anki2`);
  const results = await pify(db.all.bind(db))(
    `SELECT
      notes.sfld as front,
      notes.flds as back,
      notes.tags as tags
      from cards JOIN notes where cards.nid = notes.id ORDER BY front`
  );
  db.close();

  t.deepEqual(results, [
    {
      front: front1,
      back: `${front1}${SEPARATOR}${back1}`,
      tags: ' ' + tags1.map(tag => tag.replace(/ /g, '_')).join(' ') + ' '
    },
    { front: front2, back: `${front2}${SEPARATOR}${back2}`, tags: tags2 },
    { front: front3, back: `${front3}${SEPARATOR}${back3}`, tags: '' }
  ]);
});
