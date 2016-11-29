const sha1 = require('sha1');

export const checksum = str => parseInt(sha1(str).substr(0, 8), 16);

export const getLastItem = obj => {
  const keys = Object.keys(obj);
  const lastKey = keys[keys.length - 1];

  const item = obj[lastKey];
  delete obj[lastKey];

  return item;
};

export const getTemplate = () => {
  let template;
  if (process.env.APP_ENV === 'browser') {
    require('script!sql.js');
    template = require('!raw!./../template.sql');
  } else {
    template = require('fs').readFileSync(__dirname + '/../template.sql', 'utf-8');
  }
  return template;
};

export const getSql = () => {
  let sql;
  if (process.env.APP_ENV === 'browser') {
    require('script!sql.js');
    sql = window.SQL;
  } else {
    sql = require('sql.js');
  }
  return sql;
};

export const rand = () => Math.random() * 100000000 | 0;
