import { saveAs } from 'file-saver';

import AnkiExport from '../../src';
// import AnkiExport from 'anki-apkg-export';

const apkg = new AnkiExport('deck-name-ajax');

const params = {
  method: 'GET'
};

fetch('https://raw.githubusercontent.com/ewnd9/anki-apkg-export/39ebdd664ab23b5237eee95b7dd88c457e263a20/example/assets/anki.png', params)
  .then(function(response) {
    return response.blob();
  })
  .then(function(myBlob) {
    apkg.addMedia('anki.png', myBlob);
    apkg.addCard('card #1 with image <img src="anki.png" />', 'card #1 back');

    return apkg.save()
  })
  .then(function(zip) {
    saveAs(zip, 'output.apkg');
  })
  .catch(err => console.log(err.stack || err));
