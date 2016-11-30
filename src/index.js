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
  const { topDeckId, topModelId } = exporter;

  exporter.db.run(getTemplate());

  exporter
    .updateInitialDecksWith({
      name: deckName,
      top_deck_id: topDeckId
    })
    .updateInitialModelsWith({
      name: deckName,
      css: getCssTemplate(),
      did: topDeckId,
      id: topModelId,
    });

  return ['addCard', 'addMedia', 'save'].reduce((prev, i) => {
    prev[i] = exporter[i];
    return prev;
  }, {});
}
