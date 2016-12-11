import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import fs from 'fs';
import sql from 'sql.js';

import 'babel-register';
import 'babel-polyfill';

const template = fs.readFileSync(__dirname + '/../templates/template.sql', 'utf-8');

const Exporter = proxyquire('../src/exporter', {
  jszip: function () {
    this.file = () => null;
    this.generateAsync = () => null;
  }
}).default;

test.beforeEach(t => {
  t.context.exporter = new Exporter('testDeckName', {
    template,
    sql
  });
});

test('Exporter.save', t => {
  const { exporter } = t.context;
  const dbExportSpy = sinon.spy(exporter.db, 'export');
  const zipFileSpy = sinon.spy(exporter.zip, 'file');
  const zipGenerateAsyncSpy = sinon.spy(exporter.zip, 'generateAsync');

  exporter.media = [ { filename: '1.jpg' }, { filename: '2.bmp' } ];
  exporter.save({ some: 'options', should: { be: 'here' } });

  t.truthy(dbExportSpy.called, 'should call .export on db');
  t.truthy(zipFileSpy.calledWithMatch('collection.anki2'), 'should save notes/cards db');
  t.truthy(zipFileSpy.calledWithMatch('media'), 'should save media');
  t.truthy(zipFileSpy.calledWithMatch(0), 'should save media with two files');
  t.truthy(zipFileSpy.calledWithMatch(1), 'should save media with two files');
  t.truthy(zipGenerateAsyncSpy.called, 'should call zip.generateAsync');
  t.truthy([ 'blob', 'nodebuffer' ].includes(zipGenerateAsyncSpy.args[ 0 ][ 0 ].type), 'zip generates binary file');
});

test('Exporter.addCard', t => {
  const { exporter } = t.context;

  const { topDeckId, topModelId, separator } = exporter;
  const [front, back] = [ 'Test Front', 'Test back' ];
  const exporterUpdateSpy = sinon.spy(exporter, '_update');

  exporter.addCard(front, back);

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(exporterUpdateSpy.args[ 0 ][ 0 ], `insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)`);
  const notesUpdate = exporterUpdateSpy.args[ 0 ][ 1 ];
  t.is(notesUpdate[ ':sfld' ], front);
  t.is(notesUpdate[ ':flds' ], front + separator + back);
  t.is(notesUpdate[ ':mid' ], topModelId);

  t.is(exporterUpdateSpy.args[ 1 ][ 0 ], `insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)`);
  const cardsUpdate = exporterUpdateSpy.args[ 1 ][ 1 ];
  t.is(cardsUpdate[ ':did' ], topDeckId);
  t.is(cardsUpdate[ ':nid' ], notesUpdate[ ':id' ], 'should link both tables via the same note_id');
});

test('Exporter.addCard with options (tags)', t => {
  const { exporter } = t.context;

  const { topDeckId, topModelId, separator } = exporter;
  const [front, back] = [ 'Test Front', 'Test back' ];
  const tags = ['tag1', 'tag2', 'multiple words tag'];
  const exporterUpdateSpy = sinon.spy(exporter, '_update');

  exporter.addCard(front, back, { tags });

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(exporterUpdateSpy.args[ 0 ][ 0 ], `insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)`);
  const notesUpdate = exporterUpdateSpy.args[ 0 ][ 1 ];
  const notesTags = notesUpdate[ ':tags' ].split(' ');
  t.is(notesUpdate[ ':sfld' ], front);
  t.is(notesUpdate[ ':flds' ], front + separator + back);
  t.is(notesUpdate[ ':mid' ], topModelId);

  t.is(notesTags.length, tags.length);
  t.is(notesTags[0], tags[0]);
  t.is(notesTags[1], tags[1]);
  t.is(notesTags[2].replace(/\W/g, '_'), tags[2].replace(/\W/g, '_'), 'Not the same but similar tag for multiwords');

  t.is(exporterUpdateSpy.args[ 1 ][ 0 ], `insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)`);
  const cardsUpdate = exporterUpdateSpy.args[ 1 ][ 1 ];
  t.is(cardsUpdate[ ':did' ], topDeckId);
  t.is(cardsUpdate[ ':nid' ], notesUpdate[ ':id' ], 'should link both tables via the same note_id');
});