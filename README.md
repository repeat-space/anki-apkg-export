# anki-apkg-export

[![Build Status](https://travis-ci.org/repeat-space/anki-apkg-export.svg?branch=master)](https://travis-ci.org/repeat-space/anki-apkg-export)

Universal module for generating decks for Anki.

Port of the Ruby gem https://github.com/albertzak/anki2

## Install

```sh
$ npm install anki-apkg-export --save
# or
$ yarn add anki-apkg-export
```

## Usage

```js
const fs = require('fs');
const initSqlJs = require('sql.js');
const { default: AnkiExport } = require('anki-apkg-export');

(async () => {
  const sql = await initSqlJs();
  const apkg = new AnkiExport({
    deckName: 'deck-name-node',
    template: {},
    sql
  });

  apkg.addMedia('anki.png', fs.readFileSync('../assets/anki.png'));

  apkg.addCard('card #1 front', 'card #1 back');
  apkg.addCard('card #2 front', 'card #2 back');
  apkg.addCard('card #3 with image <img src="anki.png" />', 'card #3 back');

  const zip = await apkg.save();

  fs.writeFileSync('./output.apkg', zip, 'binary');
  console.log(`Package has been generated: output.apkg`);
})();
```

## Examples

- [Node.js](examples/server)
- [Browser/webpack/asm, with ajax and input media attachments](examples/browser)
- [Browser/webpack/wasm, with ajax and input media attachments](examples/browser)

## Changelog

- `v4.0.0` - expose template variables (frontside, backside and css)
- `v3.1.0` - make setting APP_ENV optional
- `v3.0.0` - add tags, ES6 refactor (breaking)
- `v2.0.0` - add media support, update jszip dependency (breaking)
- `v1.0.0` - initial rewrite

## Tips

- [issue#25](https://github.com/ewnd9/anki-apkg-export/issues/25) - Dealing with `sql.js` memory limits

## Related

- [apkg format documentation](http://decks.wikia.com/wiki/Anki_APKG_format_documentation)
- [anki-apkg-export-cli](https://github.com/ewnd9/anki-apkg-export-cli) - CLI for this module
- [anki-apkg-export-app](https://github.com/ewnd9/anki-apkg-export-app) - Simple web app to generate cards online

## License

MIT © [ewnd9](http://ewnd9.com)
