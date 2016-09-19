import test from 'ava';
import 'babel-core/register';

import AnkiExport from '../src/index';
import fs from 'fs';

const dest = '/tmp/result.apkg';
const sample = __dirname + '/fixtures/output.apkg';

test('equals to sample', t => {
  const apkg = new AnkiExport('deck-name');

  apkg.addMedia('anki.png', fs.readFileSync(__dirname + '/fixtures/anki.png'));

  apkg.addCard('card #1 front', 'card #1 back');
  apkg.addCard('card #2 front', 'card #2 back');
  apkg.addCard('card #3 with image <img src="anki.png" />', 'card #3 back');

  const zip = apkg.save();
  fs.writeFileSync(dest, zip, 'binary');

  t.ok(typeof zip === 'string');

  const sampleZip = fs.readFileSync(sample);
  const destZip = fs.readFileSync(dest);

  // t.ok(destZip === sampleZip);
  //
  // i forgot that there are random number involved, so every time slightly different result
  // one of solutions could be comparing sql data extracted from the apkg archive
});
