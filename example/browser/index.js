import { saveAs } from 'filesaverjs';
import AnkiExport from 'anki-apkg-export';

const apkg = new AnkiExport('deck-name');

const ankiLogo = require('buffer!../assets/anki.png');

apkg.addMedia('anki.png', ankiLogo);

apkg.addCard('card #1 front', 'card #1 back');
apkg.addCard('card #2 front', 'card #2 back');
apkg.addCard('card #3 with image <img src="anki.png" />', 'card #3 back');

const zip = apkg.save();
saveAs(zip, 'output.apkg');
