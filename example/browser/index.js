import { saveAs } from 'filesaverjs';
import AnkiExport from '../../dist/index';

const apkg = new AnkiExport('deck-name');

apkg.addCard('card #1 front', 'card #1 back');
apkg.addCard('card #2 front', 'card #2 back');

const zip = apkg.save();
saveAs(zip, 'output.apkg');
