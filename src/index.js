import Exporter from './exporter';
import createTemplate from './template';

let sql;

if (process.env.APP_ENV === 'browser' || typeof window !== 'undefined') {
  require('script-loader!sql.js');
  sql = window.SQL;
} else {
  sql = require('sql.js');
}

export { Exporter };

export default function(deckName, template) {
  return new Exporter(deckName, {
    template: createTemplate(template),
    sql
  });
}
