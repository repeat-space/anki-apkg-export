'use strict';

import Exporter from './exporter';
export { SEPARATOR } from './exporter';

const isBrowser = process.env.APP_ENV === 'browser';

let sql;
let template;

if (isBrowser) {
  require('script!sql.js');
  sql = window.SQL;

  require('script!sql.js');
  template = require('!raw!./../templates/template.sql');
} else {
  sql = require('sql.js');

  template = require('fs').readFileSync(__dirname + '/../templates/template.sql', 'utf-8');
}

export default function (deckName) {
  return new Exporter(deckName, {
    template,
    DbClass: sql.Database
  });
}
