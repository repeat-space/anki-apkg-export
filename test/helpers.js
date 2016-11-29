import test from 'ava';

import fs from 'fs';
import path from 'path';
import 'babel-register';
import 'babel-polyfill';
import {
  checksum,
  getAddCard,
  getDb,
  getLastItem,
  getSave,
  getSql,
  getTemplate,
  getZip,
  rand
} from '../src/helpers';

test('checksum', t => {
  t.plan(2);
  t.is(typeof checksum, 'function', 'should be a function');
  t.is(checksum('some string'), 2336613565, 'san calculate checksume for `some string`');
});

test('getLastItem', t => {
  t.plan(3);

  t.is(typeof getLastItem, 'function', 'should be a function');
  t.is(getLastItem({ a: 0, b: 1 }), 1, 'get value of last object key');

  // next item is not valuable test, it just explain current behavior
  // it's strange for me, but you should know
  const obj = { a: 0, b: 1 };
  getLastItem(obj);
  t.deepEqual(obj, { a: 0 }, 'mutate passed param and remove extracted key');
});

test('getTemplate', t => {
  t.plan(2);
  t.is(typeof getTemplate, 'function', 'should be a function');
  let template = fs.readFileSync(path.join(__dirname, '../template.sql'), 'utf-8');
  t.is(getTemplate(), template, 'should return correct template');
});

test('getSql', t => {
  t.plan(3);
  t.is(typeof getSql, 'function', 'should be a function');

  const sql = getSql();
  t.truthy(typeof sql === 'object' && !!sql, 'should be an object');
  t.is(typeof sql.Database, 'function', 'should contains Database constructor');
});

test('rand', t => {
  t.plan(2);
  t.is(typeof rand, 'function', 'should be a function');
  t.is(typeof rand(), 'number', 'should return a number');
});

test('getDb', t => {
  t.plan(5);
  t.is(typeof getDb, 'function', 'should be a function');

  const db = getDb();
  t.truthy(typeof db === 'object' && !!db, 'should be an object');
  t.is(typeof db.run, 'function', 'db should contains run method');
  t.is(typeof db.exec, 'function', 'db should contains run method');
  t.is(typeof db.export, 'function', 'db should contains run method');
});

test('getAddCard', t => {
  t.plan(11);
  t.is(typeof getAddCard, 'function', 'should be a function');
  t.is(typeof getAddCard(), 'function', 'should return a function');

  const [topDeckId, topModelId, separator, front, back] = [5, 9, '!separator!', 'Test Front', 'Test back'];
  const results = {};
  const update = (query, data) => results[query] = data;
  const addCard = getAddCard(update, topDeckId, topModelId, separator);
  addCard(front, back);

  const keys = Object.keys(results);
  const notesUpdate = results[`insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)`];
  const cardsUpdate = results[`insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)`];

  t.is(keys.length, 2, 'should made two requests');

  t.truthy(cardsUpdate,'should insert card');
  t.is(notesUpdate[':sfld'], front);
  t.is(notesUpdate[':flds'], front + separator + back);
  t.is(notesUpdate[':mid'], topModelId);
  t.is(notesUpdate[':csum'], checksum(front + separator + back));

  t.truthy(cardsUpdate,'should insert note');
  t.is(cardsUpdate[':did'], topDeckId);
  t.is(cardsUpdate[':nid'], notesUpdate[':id'], 'should link both tables via the same note_id');
});

test('getZip', t => {
  t.plan(4);
  t.is(typeof getZip, 'function', 'should be a function');

  const zip = getZip();
  t.truthy(typeof zip === 'object' && !!zip, 'should be an object');
  t.is(typeof zip.file, 'function', 'zip should contains file method');
  t.is(typeof zip.generateAsync, 'function', 'zip should contains generateAsync method');
});

test('getSave', t => {
  t.is(typeof getSave, 'function', 'should be a function');
  t.is(typeof getSave(), 'function', 'should return a function');

  const flags = {};
  const dbMock = { export: () => flags['db.export'] = 'Some data' };
  const zipMock = {
    file: (path, content) => flags[`zip.file(${path})`] = content,
    generateAsync: options => flags[`zip.generateAsync`] = options
  };
  const mediaMock = [];
  const save = getSave(zipMock, dbMock, mediaMock);

  // it should process media by reference
  mediaMock.push({filename: '1.jpg'}, {filename: '2.bmp'});

  save({some: 'options', should: { be: 'here'}});
  const flagsKeys = Object.keys(flags);
  t.truthy(flagsKeys.includes('db.export'), 'should call .export on db');
  t.truthy(flagsKeys.includes('zip.file(collection.anki2)'), 'should save notes/cards db');
  t.truthy(flagsKeys.includes('zip.file(media)'), 'should save media');
  t.truthy(flagsKeys.includes('zip.file(0)'), 'should save media with two files');
  t.truthy(flagsKeys.includes('zip.file(1)'), 'should save media with two files');
  t.truthy(flagsKeys.includes('zip.generateAsync'), 'should call zip.generateAsync');
  t.truthy(['blob', 'nodebuffer'].includes(flags['zip.generateAsync'].type), 'zip generates binary file');
});

