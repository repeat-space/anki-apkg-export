import test from 'ava';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import fs from 'fs';
import initSqlJs from 'sql.js';

const template = fs.readFileSync(__dirname + '/../templates/template.sql', 'utf-8');
const now = Date.now();

const { Exporter } = proxyquire('../src', {
  jszip: function() {
    this.file = () => null;
    this.generateAsync = () => null;
  }
});

test.beforeEach(async t => {
  t.context.clock = sinon.useFakeTimers(now);

  t.context.exporter = new Exporter({
    deckName: 'testDeckName',
    template,
    sql: await initSqlJs()
  });
});

test.afterEach(t => {
  sinon.restore();
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

  exporter.addCard(front, back);

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(
    exporterUpdateSpy.args[0][0],
    'insert or replace into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)'
  );
  const notesUpdate = exporterUpdateSpy.args[0][1];
  t.is(notesUpdate[':sfld'], front);
  t.is(notesUpdate[':flds'], front + separator + back);
  t.is(notesUpdate[':mid'], topModelId);

  t.is(
    exporterUpdateSpy.args[1][0],
    'insert or replace into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)'
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

  exporter.addCard(front, back, { tags });

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(
    exporterUpdateSpy.args[0][0],
    'insert or replace into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)'
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

  exporter.addCard(front, back, { tags });

  t.is(exporterUpdateSpy.callCount, 2, 'should made two requests');

  t.is(
    exporterUpdateSpy.args[0][0],
    'insert or replace into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)'
  );
  const notesUpdate = exporterUpdateSpy.args[0][1];
  t.is(notesUpdate[':sfld'], front);
  t.is(notesUpdate[':flds'], front + separator + back);
  t.is(notesUpdate[':mid'], topModelId);
  t.is(notesUpdate[':tags'], tags);

  t.is(
    exporterUpdateSpy.args[1][0],
    'insert or replace into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)'
  );
  const cardsUpdate = exporterUpdateSpy.args[1][1];
  t.is(cardsUpdate[':did'], topDeckId);
  t.is(cardsUpdate[':nid'], notesUpdate[':id'], 'should link both tables via the same note_id');
});

test('Exporter.addCard updates note if it is a duplicate', t => {
  const { exporter } = t.context;

  const { topDeckId, topModelId, separator } = exporter;
  const [front, back] = ['Test Front', 'Test back'];
  const exporterUpdateSpy = sinon.spy(exporter, '_update');

  exporter.addCard(front, back);
  exporter.addCard(front, back);

  t.is(exporterUpdateSpy.callCount, 4, 'should made four requests');

  t.is(
    exporterUpdateSpy.args[0][0],
    'insert or replace into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)'
  );
  const notesUpdate = exporterUpdateSpy.args[0][1];
  const secondNotesUpdate = exporterUpdateSpy.args[2][1];
  t.is(notesUpdate[':id'], secondNotesUpdate[':id']);
  t.is(notesUpdate[':guid'], secondNotesUpdate[':guid']);
  t.is(notesUpdate[':sfld'], front);
  t.is(notesUpdate[':flds'], front + separator + back);
  t.is(notesUpdate[':mid'], topModelId);

  t.is(
    exporterUpdateSpy.args[1][0],
    'insert or replace into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)'
  );
  const cardsUpdate = exporterUpdateSpy.args[1][1];
  const secondCardsUpdate = exporterUpdateSpy.args[3][1];
  t.is(cardsUpdate[':id'], secondCardsUpdate[':id']);
  t.is(cardsUpdate[':did'], topDeckId);
  t.is(cardsUpdate[':nid'], notesUpdate[':id'], 'should link both tables via the same note_id');
});

test('Exporter._getId', t => {
  const { exporter } = t.context;
  const numberOfCards = 5;
  const [front, back] = ['Test Front', 'Test back'];
  for (let i = 0; i < numberOfCards; i++) {
    exporter.addCard(`${front} ${i}`, `${back} ${i}`);
  }

  const noteIdsResult = exporter.db.exec('SELECT id FROM notes ORDER BY id DESC');
  t.deepEqual(
    noteIdsResult,
    [
      {
        columns: ['id'],
        values: new Array(numberOfCards)
          .fill(0)
          .map((el, index) => [now + index])
          .sort((a, b) => b[0] - a[0])
      }
    ],
    'It should increment values inserted at the same time'
  );
});
