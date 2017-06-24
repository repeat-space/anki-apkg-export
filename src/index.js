'use strict';

import Exporter from './exporter';

let sql;
let template;

if (process.env.APP_ENV === 'browser') {
  require('script-loader!sql.js');
  sql = window.SQL;

  require('script!sql.js');
  template = require('!raw-loader!./../templates/template.sql');
} else {
  sql = require('sql.js');

  template = require('fs').readFileSync(__dirname + '/../templates/template.sql', 'utf-8');
}

export default function (deckName) {
  return new Exporter(deckName, {
    template,
    sql
  });
}
