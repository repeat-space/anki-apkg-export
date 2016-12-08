import test from 'ava';

import 'babel-register';
import 'babel-polyfill';

import AnkiExport, { SEPARATOR } from '../src/index';
import fs from 'fs';
import sortBy from 'lodash.sortby';
import sqlite3 from 'sqlite3';
import { exec } from  'child_process';
import pify from 'pify';
import { addCards, unzipDeckToDir } from './_helpers';
import sql from 'sql.js';

const template = require('fs').readFileSync(__dirname + '/../templates/template.sql', 'utf-8');
const tmpDir = '/tmp/';
const dest = tmpDir + 'result.apkg';
const destUnpacked = tmpDir + 'unpacked_result';
const destUnpackedDb = destUnpacked + '/collection.anki2';

test.beforeEach(async () => pify(exec)(`rm -rf ${dest} ${destUnpacked}`));

test('equals to sample', async t => {
  const apkg = new AnkiExport('deck-name', {
    template,
    DbClass: sql.Database
  });

  apkg.addMedia('anki.png', fs.readFileSync(__dirname + '/fixtures/anki.png'));

  apkg.addCard('card #1 front', 'card #1 back');
  apkg.addCard('card #2 front', 'card #2 back');
  apkg.addCard('card #3 with image <img src="anki.png" />', 'card #3 back');

  const zip = await apkg.save();
  fs.writeFileSync(dest, zip, 'binary');

  t.truthy(zip instanceof Buffer);
});

test('check internal structure', async t => {
  // Create deck as in previous example
  const apkg = new AnkiExport('deck-name', {
    template,
    DbClass: sql.Database
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
      from cards JOIN notes where cards.nid = notes.id ORDER BY cards.id`);
  db.close();

  // compare content from just created db with original list of cards
  const normilizedResult = sortBy(result.map(({ front, back }) => ({
    front,
    back: back.split(SEPARATOR).pop()
  })), 'front');

  t.deepEqual(normilizedResult, cards);
});
