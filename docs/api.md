# API

## Creating an exporter

`await AnkiExport.create(deckName, options?)`

| Option           | Default                             | Purpose                                |
| ---------------- | ----------------------------------- | -------------------------------------- |
| `kind`           | `basic`                             | `basic`, `reversed` or `cloze`         |
| `deckId`         | Derived from deck name              | Stable positive integer greater than 1 |
| `modelId`        | Derived from deck ID and model name | Stable positive integer greater than 1 |
| `questionFormat` | `{{Front}}` for basic               | Anki question template                 |
| `answerFormat`   | Front side, separator and Back      | Anki answer template                   |
| `css`            | Basic card styling                  | CSS shared by the note type            |
| `model`          | Model for the selected kind         | Custom `ModelDefinition`               |
| `locateFile`     | sql.js default                      | Function returning the WASM asset URL  |
| `sql`            | Initialized by the factory          | Already initialized sql.js module      |

For cloze, the default fields are Text and Extra, and the question uses
`{{cloze:Text}}`. The reversed kind creates forward and reverse templates.
A custom `model` supplies its own fields, templates and CSS.

## Notes and cards

- `addCard(front, back, options?)`: add a Front/Back note.
- `addCloze(text, extra?, options?)`: add a Text/Extra cloze note.
- `addNote(fields, options?)`: fields as an array in model order or an object keyed by field name.
- `addCards(iterable)`: items contain `front`, `back` and note options.
- `addNotes(iterable)`: items contain `fields` and note options.

Note options: `noteId`, `tags`, `deck`, `modelId`.
Use `modelId` to select a registered note type. `deck` is the target deck name;
missing decks and their parents are added automatically.

`noteId` is a string or safe integer representing an ID in your source data.
The GUID combines that key with the exporter and model identities. Keep the
key and identities unchanged when editing content. Without `noteId`, the GUID
is derived from all field values; changing a value creates a new note.
Repeated additions of the same note replace its contents inside the package.

Tags accept an array or whitespace-separated string. Spaces in array entries
become underscores, and duplicate tags are removed.
Fields may contain HTML, but cannot contain NUL or the Anki field separator.
A note must generate at least one card. A failed batch rolls back all of its
notes, cards and new deck metadata.

Cloze numbers range from 1 to 500. Each distinct number generates one card;
the exported ordinal is that number minus one.

## Custom models

```js
const modelId = apkg.addModel({
  id: 10001,
  name: 'Vocabulary',
  fields: ['Word', 'Reading', 'Meaning'],
  sortField: 'Reading',
  templates: [
    {
      name: 'Meaning',
      questionFormat: '{{Word}}',
      answerFormat: '{{Reading}}<hr id="answer">{{Meaning}}',
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

apkg.addNote(
  { Word: '東京', Reading: 'とうきょう', Meaning: 'Tokyo' },
  { modelId, noteId: 'tokyo', deck: 'Japanese::Cities' },
);
```

A model has a name, unique field names and one or more templates. Optional
properties are `id`, `css`, `sortField` and `type` (`basic` or `cloze`).
`id` defaults to a hash of the exporter deck ID and model name.

Each template's `requiredFields` controls card generation: all listed fields
must be nonempty. The default is the first model field. Set it explicitly for
conditional templates; generation does not evaluate the template's HTML or
conditional sections. A cloze model has exactly one template; its
`{{cloze:Field}}` references determine which fields contain deletions.

`addModel()` returns the numeric model ID. Register each model once.
Use the `model` create option to make a custom model the default.

## Decks

`addDeck(name, { deckId }?)` returns the deck ID. Hierarchy uses `::`, for example
`Japanese::Cities`. IDs default to a hash of the full name. Explicit IDs must
be safe integers greater than 1 and unique within the package.

## Media

`addMedia(filename, data)` accepts a Buffer, Uint8Array, ArrayBuffer, Blob, File,
string, number array or Node readable stream. Promises for these values are
also accepted. Names must be plain filenames; duplicate names are rejected.

Reference images with `<img src="photo.png">` and audio with
`[sound:audio.mp3]`. Export includes all added media, even if no field references it.

## Saving and closing

`await save()` returns a Uint8Array. `save({ type: 'blob' })` returns a Blob;
`save({ type: 'nodebuffer' })` returns a Buffer. Other JSZip output types and
compression options are supported. Default compression is DEFLATE.

`close()` releases SQLite memory and media references. It is safe to call
more than once. Other methods throw after close. Always close the exporter in
`finally` after finishing the export. The database and ZIP are assembled in
memory; a batch transaction improves insertion speed, but does not make export
streaming or remove the memory cost of large media.
