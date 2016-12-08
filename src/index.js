'use strict';

import Exporter from './exporter';
export {SEPARATOR} from './exporter';

export default function(deckName) {
  return new Exporter(deckName);
}
