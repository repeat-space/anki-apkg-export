'use strict';

const fs = require('fs');
const AnkiExport = require('../../dist/index').default;

const apkg = new AnkiExport('deck-name');

apkg.addCard('card #1 front', 'card #1 back');
apkg.addCard('card #2 front', 'card #2 back');

const zip = apkg.save();

fs.writeFileSync('./output.apkg', zip, 'binary');
console.log(`Package has been generated: output.pkg`);
