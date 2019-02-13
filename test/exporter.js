import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import fs from 'fs';
import sql from 'sql.js';

import 'babel-register';
import 'babel-polyfill';

const template = fs.readFileSync(__dirname + '/../templates/template.sql', 'utf-8');
const now = Date.now();

const { Exporter } = proxyquire('../src', {
  jszip: function() {
    this.file = () => null;
    this.generateAsync = () => null;
  }
});

test.beforeEach(t => {
  t.context.sandbox = sinon.sandbox.create();
  t.context.clock = sinon.useFakeTimers(now);

  t.context.exporter = new Exporter('testDeckName', {
    template,
    sql
  });
});

test.afterEach(t => {
  t.context.sandbox.restore();
  t.context.clock.restore();
});

test('Exporter.save', t => {
  const { exporter } = t.context;
  const dbExportSpy = sinon.spy(exporter.db, 'export');
  const zipFileSpy = sinon.spy(exporter.zip, 'file');
  const zipGenerateAsyncSpy = sinon.spy(exporter.zip, 'generateAsync');

  exporter.media = [{ filename: '1.jpg' }, { filename: '2.bmp' }];
  exporter.save({ some: 'options', should: { be: 'here' } });

  t.truthy(dbExportSpy.called, 'should call .export on db');
  t.truthy(zipFileSpy.calledWithMatch('collection.anki2'), 'should save notes/cards db');
  t.truthy(zipFileSpy.calledWithMatch('media'), 'should save media');
  t.truthy(zipFileSpy.calledWithMatch(0), 'should save media with two files');
  t.truthy(zipFileSpy.calledWithMatch(1), 'should save media with two files');
  t.truthy(zipGenerateAsyncSpy.called, 'should call zip.generateAsync');
  t.truthy(['blob', 'nodebuffer'].includes(zipGenerateAsyncSpy.args[0][0].type), 'zip generates binary file');
});

test('Exporter.addCard', t => {
  const { exporter } = t.context;

  const { topDeckId, topModelId, separator } = exporter;
  const [front, back] = ['Test Front', 'Test back'];
  const exporterUpdateSpy = sinon.spy(exporter, '_update');

  exporter.addCard([front, back]);

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(
    exporterUpdateSpy.args[0][0],
    'insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)'
  );
  const notesUpdate = exporterUpdateSpy.args[0][1];
  t.is(notesUpdate[':sfld'], front);
  t.is(notesUpdate[':flds'], front + separator + back);
  t.is(notesUpdate[':mid'], topModelId);

  t.is(
    exporterUpdateSpy.args[1][0],
    'insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)'
  );
  const cardsUpdate = exporterUpdateSpy.args[1][1];
  t.is(cardsUpdate[':did'], topDeckId);
  t.is(cardsUpdate[':nid'], notesUpdate[':id'], 'should link both tables via the same note_id');
});

test('Exporter.addCard with options (tags is array)', t => {
  const { exporter } = t.context;

  const { topModelId, separator } = exporter;
  const [front, back] = ['Test Front', 'Test back'];
  const tags = ['tag1', 'tag2', 'multiple words tag'];
  const exporterUpdateSpy = sinon.spy(exporter, '_update');

  exporter.addCard([front, back], { tags });

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(
    exporterUpdateSpy.args[0][0],
    'insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)'
  );
  const notesUpdate = exporterUpdateSpy.args[0][1];
  const notesTags = notesUpdate[':tags'].split(' ');
  t.is(notesUpdate[':sfld'], front);
  t.is(notesUpdate[':flds'], front + separator + back);
  t.is(notesUpdate[':mid'], topModelId);

  t.deepEqual(notesTags, [''].concat(tags.map(tag => tag.replace(/ /g, '_'))).concat(['']));
});

test('Exporter.addCard with options (tags is string)', t => {
  const { exporter } = t.context;
  const { topDeckId, topModelId, separator } = exporter;
  const [front, back, tags] = ['Test Front', 'Test back', 'Some string with_delimiters'];
  const exporterUpdateSpy = sinon.spy(exporter, '_update');

  exporter.addCard([front, back], { tags });

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(
    exporterUpdateSpy.args[0][0],
    'insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)'
  );
  const notesUpdate = exporterUpdateSpy.args[0][1];
  t.is(notesUpdate[':sfld'], front);
  t.is(notesUpdate[':flds'], front + separator + back);
  t.is(notesUpdate[':mid'], topModelId);
  t.is(notesUpdate[':tags'], tags);

  t.is(
    exporterUpdateSpy.args[1][0],
    'insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)'
  );
  const cardsUpdate = exporterUpdateSpy.args[1][1];
  t.is(cardsUpdate[':did'], topDeckId);
  t.is(cardsUpdate[':nid'], notesUpdate[':id'], 'should link both tables via the same note_id');
});

test('Exporter._getId', async t => {
  const { exporter } = t.context;
  const numberOfCards = 5;
  const [front, back] = ['Test Front', 'Test back'];
  for (let i = 0; i < numberOfCards; i++) {
    exporter.addCard([front, back]);
  }

  const noteIdsResult = exporter.db.exec('SELECT id from notes');
  t.deepEqual(
    noteIdsResult,
    [
      {
        columns: ['id'],
        values: new Array(numberOfCards).fill(0).map((el, index) => [now + index])
      }
    ],
    'It should increment values inserted at the same time'
  );
});
