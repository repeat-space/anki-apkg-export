'use strict';

const fs = require('fs');
const initSqlJs = require('sql.js');
const { default: AnkiExport } = require('anki-apkg-export');

(async () => {
  const sql = await initSqlJs();
  const apkg = new AnkiExport('deck-name-node', {}, sql);

  apkg.addMedia('anki.png', fs.readFileSync('../assets/anki.png'));

  apkg.addCard('card #1 front', 'card #1 back');
  apkg.addCard('card #2 front', 'card #2 back');
  apkg.addCard('card #3 with image <img src="anki.png" />', 'card #3 back');

  const zip = await apkg.save();

  fs.writeFileSync('./output.apkg', zip, 'binary');
  console.log(`Package has been generated: output.apkg`);
})();
