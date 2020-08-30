import AnkiExport from 'anki-apkg-export';
import { saveAs } from 'file-saver';
import 'script-loader!sql.js/dist/sql-asm';

(async () => {
  const sql = await initSqlJs();

  document.querySelector('#buttonSimple').addEventListener('click', () => {
    handleSimple(sql);
  });

  document.querySelector('#buttonAjax').addEventListener('click', () => {
    handleAjax(sql);
  });

  document.querySelector('input').addEventListener('change', e => {
    handleInput(sql, e.target.files[0]);
  });
})();

async function handleSimple(sql) {
  const apkg = new AnkiExport('deck-name', {}, sql);

  apkg.addCard('card #1 front', 'card #1 back');
  apkg.addCard('card #2 front', 'card #2 back');

  const zip = await apkg.save();
  saveAs(zip, 'output.apkg');
}

async function handleAjax(sql) {
  const apkg = new AnkiExport('deck-name-ajax', {}, sql);

  const response = await fetch('https://raw.githubusercontent.com/ewnd9/anki-apkg-export/39ebdd664ab23b5237eee95b7dd88c457e263a20/example/assets/anki.png');
  const myBlob = await response.blob();

  apkg.addMedia('anki.png', myBlob);
  apkg.addCard('card #1 with image <img src="anki.png" />', 'card #1 back');

  const zip = await apkg.save()
  saveAs(zip, 'output.apkg');
}

async function handleInput(sql, file) {
  const apkg = new AnkiExport('deck-name', {}, sql);
  const reader = new FileReader();

  reader.onload = async e => {
    const file = e.target.result;

    apkg.addMedia('anki.png', file);
    apkg.addCard('card #1 with image <img src="anki.png" />', 'card #1 back');

    const zip = await apkg.save()
    saveAs(zip, 'output.apkg');
  };

  reader.readAsArrayBuffer(file);
}
