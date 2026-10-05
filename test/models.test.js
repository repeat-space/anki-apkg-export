import { afterEach, expect, it } from 'vitest';
import AnkiExport from '../src/index';
import JSZip from 'jszip';

const exporters = [];
async function create(options = {}, name = 'Languages') {
  const exporter = await AnkiExport.create(name, options);
  exporters.push(exporter);
  return exporter;
}
afterEach(() => exporters.splice(0).forEach((exporter) => exporter.close()));

it('includes parents when the initial deck is nested', async () => {
  const exporter = await create({}, 'Languages::Japanese');
  exporter.addCard('東京', 'Tokyo');
  await exporter.save();
  const decks = JSON.parse(exporter.db.exec('SELECT decks FROM col')[0].values[0][0]);
  expect(Object.values(decks).map(deck => deck.name)).toContain('Languages');
});

it('generates both directions and removes the reverse card when Back becomes empty', async () => {
  const exporter = await create({ kind: 'reversed' });
  exporter.addCard('東京', 'Tokyo', { noteId: 'tokyo' });
  expect(exporter.db.exec('SELECT ord FROM cards ORDER BY ord')[0].values).toEqual([[0], [1]]);
  exporter.addCard('東京', '', { noteId: 'tokyo' });
  expect(exporter.db.exec('SELECT ord FROM cards')[0].values).toEqual([[0]]);
});

it('generates one card per unique cloze number, including multiline deletions and hints', async () => {
  const exporter = await create({ kind: 'cloze' });
  exporter.addCloze('{{c1::Tokyo::city}} is in {{c3::Japan}}. {{c1::Repeated\ntext}}', 'Extra');
  expect(exporter.db.exec('SELECT ord FROM cards ORDER BY ord')[0].values).toEqual([[0], [2]]);
  expect(() => exporter.addCloze('No deletion')).toThrow('does not generate');
  expect(() => exporter.addCloze('{{c501::Too high}}')).toThrow('between 1 and 500');
});

it('adds basic and cloze notes to the same package', async () => {
  const exporter = await create();
  exporter.addCard('Japan', '日本');
  exporter.addCloze('The capital is {{c1::Tokyo}}');
  const zip = await JSZip.loadAsync(await exporter.save());
  expect(zip.file('collection.anki2')).not.toBeNull();
  const models = JSON.parse(exporter.db.exec('SELECT models FROM col')[0].values[0][0]);
  expect(
    Object.values(models)
      .map((model) => model.type)
      .sort(),
  ).toEqual([0, 1]);
});

it('exports custom fields, templates, sort field and nested decks', async () => {
  const exporter = await create();
  const modelId = exporter.addModel({
    id: 9001,
    name: 'Vocabulary',
    fields: ['Word', 'Reading', 'Meaning'],
    sortField: 'Reading',
    templates: [
      {
        name: 'Meaning',
        questionFormat: '{{Word}}',
        answerFormat: '{{Reading}}<hr>{{Meaning}}',
        requiredFields: ['Word'],
      },
      {
        name: 'Reading',
        questionFormat: '{{Reading}}',
        answerFormat: '{{Word}}',
        requiredFields: ['Reading'],
      },
    ],
  });
  exporter.addNotes([
    {
      fields: { Word: '東京', Reading: 'とうきょう', Meaning: 'Tokyo' },
      modelId,
      deck: 'Languages::Japanese::Cities',
    },
    { fields: ['日本', '', 'Japan'], modelId, deck: 'Languages::Japanese' },
  ]);
  expect(exporter.db.exec('SELECT count(*) FROM cards')[0].values).toEqual([[3]]);
  expect(exporter.db.exec('SELECT sfld FROM notes ORDER BY id')[0].values).toEqual([
    ['とうきょう'],
    [''],
  ]);
  await exporter.save();
  const decks = JSON.parse(exporter.db.exec('SELECT decks FROM col')[0].values[0][0]);
  expect(
    Object.values(decks)
      .map((deck) => deck.name)
      .sort(),
  ).toEqual(['Default', 'Languages', 'Languages::Japanese', 'Languages::Japanese::Cities']);
  expect(() => exporter.addNote({ Word: 'only one field' }, { modelId })).toThrow('match');
  expect(() =>
    exporter.addModel({ id: modelId, name: 'Duplicate', fields: ['A'], templates: [] }),
  ).toThrow('already used');
});

it('rolls back deck metadata alongside failed note batches', async () => {
  const exporter = await create();
  expect(() =>
    exporter.addCards([
      { front: 'Valid', back: 'Back', deck: 'New deck' },
      { front: '', back: 'Invalid' },
    ]),
  ).toThrow();
  await exporter.save();
  const decks = JSON.parse(exporter.db.exec('SELECT decks FROM col')[0].values[0][0]);
  expect(Object.values(decks).map((deck) => deck.name)).not.toContain('New deck');
});
