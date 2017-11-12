import { saveAs } from 'file-saver';

import AnkiExport from '../../src';
// import AnkiExport from 'anki-apkg-export';

const apkg = new AnkiExport('deck-name');

apkg.addCard('card #1 front', 'card #1 back');
apkg.addCard('card #2 front', 'card #2 back');

apkg
  .save()
  .then(zip => {
    saveAs(zip, 'output.apkg');
  })
  .catch(err => console.log(err.stack || err));
