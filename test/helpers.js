import test from 'ava';

import 'babel-register';
import 'babel-polyfill';
import {
  checksum,
  getLastItem,
  getZip,
  rand
} from '../src/helpers';

test('checksum', t => {
  t.is(typeof checksum, 'function', 'should be a function');
  t.is(checksum('some string'), 2336613565, 'san calculate checksume for `some string`');
});

test('getLastItem', t => {
  t.is(typeof getLastItem, 'function', 'should be a function');
  t.is(getLastItem({ a: 0, b: 1 }), 1, 'get value of last object key');

  // next item is not valuable test, it just explain current behavior
  // it's strange for me, but you should know
  const obj = { a: 0, b: 1 };
  getLastItem(obj);
  t.deepEqual(obj, { a: 0 }, 'mutate passed param and remove extracted key');
});

test('rand', t => {
  t.is(typeof rand, 'function', 'should be a function');
  t.is(typeof rand(), 'number', 'should return a number');
});

test('getZip', t => {
  t.is(typeof getZip, 'function', 'should be a function');

  const zip = getZip();
  t.truthy(typeof zip === 'object' && !!zip, 'should be an object');
  t.is(typeof zip.file, 'function', 'zip should contains file method');
  t.is(typeof zip.generateAsync, 'function', 'zip should contains generateAsync method');
});
