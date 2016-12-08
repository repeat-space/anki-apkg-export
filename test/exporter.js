import test from 'ava';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import proxyquire from 'proxyquire';

import 'babel-register';
import 'babel-polyfill';

// Mock Exporter dependencies
const Exporter = proxyquire('../src/exporter', {
  jszip: function() {
    this.file = () => null;
    this.generateAsync = () => null;
  },
  sql: {
    Database: function() {
      this.export = () => "data";
      this.prepare = () => ({getAsObject: () => null });
      this.run = () => null;
      this.exec = () => null;
      }
    }
}).default;

test.beforeEach(t => {
  t.context.exporter = new Exporter('testDeckName');
});

test('Exporter class exists', t => {
  const { exporter } = t.context;

  t.truthy(exporter instanceof Exporter, 'Exporter is constructor');
});

test('Exporter.addMedia', t => {
  const { exporter } = t.context;
  t.truthy(exporter.media instanceof Array);
  t.deepEqual(exporter.media, []);
  exporter.addMedia('some.file', 'data');
  t.deepEqual(exporter.media, [{ filename: 'some.file', data: 'data' }]);
  exporter.addMedia('another.file', 'new data');
  t.deepEqual(exporter.media, [{ filename: 'some.file', data: 'data' }, { filename: 'another.file', data: 'new data' }]);
});

test('Exporter.save', t => {
  const { exporter } = t.context;
  const dbExportSpy = sinon.spy(exporter.db, 'export');
  const zipFileSpy = sinon.spy(exporter.zip, 'file');
  const zipGenerateAsyncSpy = sinon.spy(exporter.zip, 'generateAsync');

  t.is(typeof exporter.save, 'function', 'should be a function');

  exporter.media = [{filename: '1.jpg'}, {filename: '2.bmp'}];
  exporter.save({some: 'options', should: { be: 'here'}});

  t.truthy(dbExportSpy.called, 'should call .export on db');
  t.truthy(zipFileSpy.calledWithMatch('collection.anki2'), 'should save notes/cards db');
  t.truthy(zipFileSpy.calledWithMatch('media'), 'should save media');
  t.truthy(zipFileSpy.calledWithMatch(0), 'should save media with two files');
  t.truthy(zipFileSpy.calledWithMatch(1), 'should save media with two files');
  t.truthy(zipGenerateAsyncSpy.called, 'should call zip.generateAsync');
  t.truthy(['blob', 'nodebuffer'].includes(zipGenerateAsyncSpy.args[0][0].type), 'zip generates binary file');
});

test('Exporter.checksum', t => {
  const { exporter } = t.context;

  t.is(typeof exporter.checksum, 'function', 'should be a function');
  t.is(exporter.checksum('some string'), 2336613565, 'san calculate checksume for `some string`');
});

test('Exporter.addCard', t => {
  const { exporter } = t.context;

  t.is(typeof exporter.addCard, 'function', 'should be a function');
  const { topDeckId, topModelId, separator } = exporter;
  const [front, back] = [5, 9, '!separator!', 'Test Front', 'Test back'];
  const exporterUpdateSpy = sinon.spy(exporter, 'update');

  exporter.addCard(front, back);

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(exporterUpdateSpy.args[0][0], `insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)`);
  const notesUpdate = exporterUpdateSpy.args[0][1];
  t.is(notesUpdate[':sfld'], front);
  t.is(notesUpdate[':flds'], front + separator + back);
  t.is(notesUpdate[':mid'], topModelId);
  t.is(notesUpdate[':csum'], exporter.checksum(front + separator + back));

  t.is(exporterUpdateSpy.args[1][0],`insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)`);
  const cardsUpdate = exporterUpdateSpy.args[1][1];
  t.is(cardsUpdate[':did'], topDeckId);
  t.is(cardsUpdate[':nid'], notesUpdate[':id'], 'should link both tables via the same note_id');
});

test('Exporter.getTemplate', t => {
  const { exporter } = t.context;

  t.is(typeof exporter.getTemplate, 'function', 'should be a function');
  let template = fs.readFileSync(path.join(__dirname, '../templates/template.sql'), 'utf-8');
  t.is(exporter.getTemplate(), template, 'should return correct template');
});


test('getZip', t => {
  const { exporter } = t.context;

  t.is(typeof exporter._getZip, 'function', 'should be a function');

  const zip = exporter._getZip();
  t.truthy(typeof zip === 'object' && !!zip, 'should be an object');
  t.is(typeof zip.file, 'function', 'zip should contains file method');
  t.is(typeof zip.generateAsync, 'function', 'zip should contains generateAsync method');
});
