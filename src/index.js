'use strict';

import Exporter from './exporter';

let sql;
let template;

if (process.env.APP_ENV === 'browser' || typeof window !== 'undefined') {
  require('script!sql.js');
  sql = window.SQL;
  template = require('!raw!./../templates/template.sql');
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
