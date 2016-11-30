import test from 'ava';

import fs from 'fs';
import path from 'path';
import 'babel-register';
import 'babel-polyfill';
import {
  checksum,
  getCssTemplate,
  getDb,
  getLastItem,
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
  let template = fs.readFileSync(path.join(__dirname, '../templates/template.sql'), 'utf-8');
  t.is(getTemplate(), template, 'should return correct template');
});

test('getCssTemplate', t => {
  t.plan(2);
  t.is(typeof getCssTemplate, 'function', 'should be a function');
  let template = fs.readFileSync(path.join(__dirname, '../templates/template.css'), 'utf-8');
  t.is(getCssTemplate(), template, 'should return correct template');
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

test('getZip', t => {
  t.plan(4);
  t.is(typeof getZip, 'function', 'should be a function');

  const zip = getZip();
  t.truthy(typeof zip === 'object' && !!zip, 'should be an object');
  t.is(typeof zip.file, 'function', 'zip should contains file method');
  t.is(typeof zip.generateAsync, 'function', 'zip should contains generateAsync method');
});
