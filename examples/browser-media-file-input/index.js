import { saveAs } from 'file-saver';

import AnkiExport from '../../src';
// import AnkiExport from 'anki-apkg-export';

const apkg = new AnkiExport('deck-name');
const input = document.getElementById('input');

input.onchange = function(e) {
  const reader = new FileReader();
  const filename = e.target.files[0].name;

  reader.onload = function(e) {
    const file = e.target.result;

    apkg.addMedia('anki.png', file);
    apkg.addCard('card #1 with image <img src="anki.png" />', 'card #1 back');

    apkg
      .save()
      .then(zip => {
        saveAs(zip, 'output.apkg');
      })
      .catch(err => console.log(err.stack || err));
  };

  reader.readAsArrayBuffer(e.target.files[0]);
};
