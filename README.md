# anki-apkg-export

[![CI](https://github.com/repeat-space/anki-apkg-export/actions/workflows/ci.yml/badge.svg)](https://github.com/repeat-space/anki-apkg-export/actions/workflows/ci.yml)

Generate Anki `.apkg` decks in Node.js or a browser.
Supports front/back, reversed and cloze cards, custom note types, tags and media.

## Install

```sh
npm install anki-apkg-export
```

Node.js 22.12 or newer. TypeScript declarations are included.
For v4 users, see [Migrating to v5](docs/migration-v5.md).

## Node.js

```js
import { writeFile } from 'node:fs/promises';
import AnkiExport from 'anki-apkg-export';

const apkg = await AnkiExport.create('Japanese');
try {
  apkg.addCard('東京', 'Tokyo', { noteId: 'tokyo', tags: ['city'] });
  apkg.addCard('日本', 'Japan', { noteId: 'japan' });
  await writeFile('japanese.apkg', await apkg.save());
} finally {
  apkg.close();
}
```

For CommonJS: `const { AnkiExport } = require('anki-apkg-export')`.

## Browser

[Try the browser demo](https://repeat-space.github.io/anki-apkg-export/).

With Vite, import the bundled WASM asset and request a Blob:

```js
import AnkiExport from 'anki-apkg-export';
import wasmUrl from 'anki-apkg-export/sql-wasm.wasm?url';

const apkg = await AnkiExport.create('Japanese', {
  locateFile: () => wasmUrl,
});
try {
  apkg.addCard('東京', 'Tokyo');
  const blob = await apkg.save({ type: 'blob' });
  // Download with an <a download> link and URL.createObjectURL(blob).
} finally {
  apkg.close();
}
```

Other bundlers can serve `sql-wasm.wasm` as a static asset and return its URL from
`locateFile`. No webpack loaders or Node polyfills are needed.
See the [browser example](examples/browser) for downloads and file attachments.

## Card types

```js
const reversed = await AnkiExport.create('Vocabulary', { kind: 'reversed' });
reversed.addCard('東京', 'Tokyo'); // two cards
reversed.close();

const cloze = await AnkiExport.create('Geography', { kind: 'cloze' });
cloze.addCloze('The capital of {{c1::Japan}} is {{c2::Tokyo}}'); // two cards
cloze.close();
```

`addCloze()` also works on a basic deck; it adds a cloze note type to the package.
Use [custom models](docs/api.md#custom-models) for more fields or templates.

## Media, batches and subdecks

```js
apkg.addMedia('photo.png', imageBytes); // Buffer, Uint8Array, Blob or File
apkg.addCard('<img src="photo.png">', 'Tokyo');
apkg.addCard('Listen', '[sound:audio.mp3]'); // add audio.mp3 with addMedia()

apkg.addCards([
  { front: '東京', back: 'Tokyo', noteId: 'tokyo', deck: 'Japanese::Cities' },
  { front: '京都', back: 'Kyoto', noteId: 'kyoto', deck: 'Japanese::Cities' },
]);
```

Batches are transactional. Keep `noteId` unchanged when editing a note so a
later export can update it on import. Deck and model IDs are stable by default;
set them explicitly if their names will change.

## Development

```sh
corepack enable
pnpm install
pnpm check
pnpm demo
```

`pnpm test:package` checks the packed npm module in a clean project.
`pnpm test:browser` runs Playwright after `pnpm demo:build`.
`pnpm test:anki` uses [uv](https://docs.astral.sh/uv/) to check imports with Anki 26.09.3.
`pnpm benchmark 10000` reports batch insertion, export time and RSS change.

See [Releasing](docs/releasing.md) for versioning and npm publication.

Exports use the legacy `collection.anki2` package format. Import, media and
re-import behavior are tested against Anki 26.09.3; other clients are not yet
covered by the integration test.

## License

MIT © ewnd9. Originally ported from [anki2](https://github.com/albertzak/anki2).
