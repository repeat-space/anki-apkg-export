import test from 'ava';

import 'babel-register';
import 'babel-polyfill';

import Exporter from '../src/exporter';
import { checksum } from '../src/helpers';

test('Exporter class exists', t => {
  t.truthy(new Exporter instanceof Exporter, 'Exporter is constructor');
  t.truthy(new Exporter !== new Exporter, 'Exporter is not singleton');
});

test('Exporter.addMedia', t => {
  const exporter = new Exporter({}, {});
  t.truthy(exporter.media instanceof Array);
  t.deepEqual(exporter.media, []);
  exporter.addMedia('some.file', 'data');
  t.deepEqual(exporter.media, [{ filename: 'some.file', data: 'data' }]);
  exporter.addMedia('another.file', 'new data');
  t.deepEqual(exporter.media, [{ filename: 'some.file', data: 'data' }, { filename: 'another.file', data: 'new data' }]);
});

test('Exporter.save', t => {
  const dbMock = { export: () => flags['db.export'] = 'Some data' };
  const zipMock = {
    file: (path, content) => flags[`zip.file(${path})`] = content,
    generateAsync: options => flags[`zip.generateAsync`] = options
  };
  const flags = {};
  const exporter = new Exporter(dbMock, zipMock);

  t.plan(8);
  t.is(typeof exporter.save, 'function', 'should be a function');

  exporter.media = [{filename: '1.jpg'}, {filename: '2.bmp'}];

  exporter.save({some: 'options', should: { be: 'here'}});
  const flagsKeys = Object.keys(flags);
  t.truthy(flagsKeys.includes('db.export'), 'should call .export on db');
  t.truthy(flagsKeys.includes('zip.file(collection.anki2)'), 'should save notes/cards db');
  t.truthy(flagsKeys.includes('zip.file(media)'), 'should save media');
  t.truthy(flagsKeys.includes('zip.file(0)'), 'should save media with two files');
  t.truthy(flagsKeys.includes('zip.file(1)'), 'should save media with two files');
  t.truthy(flagsKeys.includes('zip.generateAsync'), 'should call zip.generateAsync');
  t.truthy(['blob', 'nodebuffer'].includes(flags['zip.generateAsync'].type), 'zip generates binary file');
});

test('Exporter.addCard', t => {
  const exporter = new Exporter({}, {});

  t.is(typeof exporter.addCard, 'function', 'should be a function');
  const { topDeckId, topModelId, separator } = exporter;
  const [front, back] = [5, 9, '!separator!', 'Test Front', 'Test back'];
  const results = {};
  exporter.update = (query, data) => results[query] = data;
  exporter.addCard(front, back);

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
