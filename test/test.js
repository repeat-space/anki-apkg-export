"use strict";
import test from 'ava';

import 'babel-register';
import 'babel-polyfill';

import AnkiExport from '../src/index';
import fs from 'fs';
import  decompress from 'decompress';
import _ from 'lodash';
import sqlite3 from 'sqlite3';
import { exec } from  'child_process';

let SEPARATOR = "\u001F";
let tmpDir = '/tmp/';
let dest = tmpDir + 'result.apkg';
let destUnpacked = tmpDir + 'unpacked_result';
let destUnpackedDb = destUnpacked + '/collection.anki2';
let sample = __dirname + '/fixtures/output.apkg';

let addCards = (apkg, list) => list.forEach(({front, back}) => apkg.addCard(front, back));

test.beforeEach(async t => new Promise((resolve) => exec(`rm -rf ${dest} ${destUnpacked}`, resolve)));

test('equals to sample', async t => {
  const apkg = new AnkiExport('deck-name');

  apkg.addMedia('anki.png', fs.readFileSync(__dirname + '/fixtures/anki.png'));

  apkg.addCard('card #1 front', 'card #1 back');
  apkg.addCard('card #2 front', 'card #2 back');
  apkg.addCard('card #3 with image <img src="anki.png" />', 'card #3 back');

  const zip = await apkg.save();
  fs.writeFileSync(dest, zip, 'binary');

  t.ok(zip instanceof Buffer);
});

test('check internal structure', async t => {
  // Create deck as in previous example
  const apkg = new AnkiExport('deck-name');
  const cards = [
    { front: 'card #1 front', back: 'card #1 back' },
    { front: 'card #2 front', back: 'card #2 back' },
    { front: 'card #3 with image <img src="anki.png" />', back: 'card #3 back' }
  ];
  addCards(apkg, cards);
  const zip = await apkg.save();
  fs.writeFileSync(dest, zip, 'binary');

  // extract dec to tmp directory
  await decompress(dest, destUnpacked);
  // analize db via sqlite
  const db = new sqlite3.Database(destUnpackedDb);
  const result = await new Promise((resolve, reject) => db.all(
    `SELECT
      notes.sfld as front,
      notes.flds as back
      from cards JOIN notes where cards.nid = notes.id ORDER BY cards.id`,
    (err, data) => err ? reject(err) : resolve(data)
  ));
  db.close();

  // compare content from just created db with original list of cards
  const normilizedResult = _.sortBy(result.map(({front, back}) => ({
    front,
    back: back.split(SEPARATOR).pop()
  })), 'front');

  t.ok(_.isEqual(normilizedResult, cards));
});
