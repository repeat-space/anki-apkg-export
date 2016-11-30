import test from 'ava';
import sinon from 'sinon';

import 'babel-register';
import 'babel-polyfill';

import Exporter from '../src/exporter';
import { checksum } from '../src/helpers';

let dbMock;
let zipMock;
let exporter;

test.beforeEach(() => {
  dbMock = {
    export: () => "data",
    prepare: () => ({getAsObject: () => null })
  };
  zipMock = {
    file: () => null,
    generateAsync: () => null
  };
  exporter = new Exporter(dbMock, zipMock);
});

test('Exporter class exists', t => {
  t.truthy(new Exporter instanceof Exporter, 'Exporter is constructor');
  t.truthy(new Exporter !== new Exporter, 'Exporter is not singleton');
});

test('Exporter.addMedia', t => {
  t.truthy(exporter.media instanceof Array);
  t.deepEqual(exporter.media, []);
  exporter.addMedia('some.file', 'data');
  t.deepEqual(exporter.media, [{ filename: 'some.file', data: 'data' }]);
  exporter.addMedia('another.file', 'new data');
  t.deepEqual(exporter.media, [{ filename: 'some.file', data: 'data' }, { filename: 'another.file', data: 'new data' }]);
});

test('Exporter.save', t => {
  const dbExportSpy = sinon.spy(dbMock, 'export');
  const zipFileSpy = sinon.spy(zipMock, 'file');
  const zipGenerateAsyncSpy = sinon.spy(zipMock, 'generateAsync');

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

test('Exporter.addCard', t => {
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
  t.is(notesUpdate[':csum'], checksum(front + separator + back));

  t.is(exporterUpdateSpy.args[1][0],`insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)`);
  const cardsUpdate = exporterUpdateSpy.args[1][1];
  t.is(cardsUpdate[':did'], topDeckId);
  t.is(cardsUpdate[':nid'], notesUpdate[':id'], 'should link both tables via the same note_id');
});
