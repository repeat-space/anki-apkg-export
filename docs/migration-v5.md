# Migrating to v5

## Initialization

Replace the synchronous constructor:

```js
const apkg = new AnkiExport('Japanese');
```

with:

```js
const apkg = await AnkiExport.create('Japanese');
```

Template options such as `questionFormat`, `answerFormat` and `css` remain
properties of the second argument. The factory initializes sql.js WASM.
Node.js 22.12 or newer is required.

## Output and cleanup

`save()` now returns a Uint8Array in both Node and browsers. Node's
`fs.writeFile()` accepts it directly. Request `{ type: 'blob' }` for browser
downloads, or `{ type: 'nodebuffer' }` if you need a Buffer.
Call `close()` in a `finally` block after the last export.

## Browser setup

Remove `script-loader`, `APP_ENV` and Buffer polyfills. Serve the bundled
`anki-apkg-export/sql-wasm.wasm` asset and provide its URL through `locateFile`.
The [Vite example](../examples/browser) includes this setup.

## Stable identities

Deck and model IDs now derive from names rather than the current time. Notes
can use `noteId` to keep their GUID when their text changes. If you rename a
deck or model, preserve its numeric IDs with `deckId` and `modelId`.

The v5 GUID scheme differs from v4. A v5 export does not automatically match
notes previously exported by v4 and may create duplicates on import. Check
the migration in a separate Anki profile before switching an existing generator.

## Validation

Duplicate media filenames now throw. Empty fronts, invalid IDs, mismatched
custom fields and fields containing NUL or the Anki field separator throw too.
Whitespace-separated tag strings are normalized like tag arrays.
`addCard()` no longer returns an internal SQLite result.
