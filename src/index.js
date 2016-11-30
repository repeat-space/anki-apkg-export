'use strict';

import {
  getDb,
  getCssTemplate,
  getTemplate,
  getZip,
}  from './helpers';
import Exporter from './exporter';
export {SEPARATOR} from './exporter';

export default function(deckName) {
  const exporter = new Exporter(getDb(), getZip());

  return exporter
    .dbRun(getTemplate())
    .updateInitialDeck(deckName)
    .updateInitialModelWith(deckName, getCssTemplate());
}
