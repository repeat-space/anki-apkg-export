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

export const getDb = () => new (getSql().Database)();

export const getAddCard = (updateFunc, topDeckId, topModelId, separator) => (front, back) => {
  const deck_id = topDeckId;
  const note_id = rand();

  updateFunc('insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)', {
    ':id': note_id, // integer primary key,
    ':guid': rand().toString(36), // rand(10**10).to_s(36) // text not null,
    ':mid': topModelId, // integer not null,
    ':mod': new Date().getTime() / 1000 | 0, // integer not null,
    ':usn': -1, // integer not null,
    ':tags': '', // text not null,
    ':flds': front + separator + back, // text not null,
    ':sfld': front, // integer not null,
    ':csum': checksum(front + separator + back), //integer not null,
    ':flags': 0, // integer not null,
    ':data': '' // text not null,
  });

  updateFunc(`insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)`, {
    ':id': rand(), // integer primary key,
    ':nid': note_id, // integer not null,
    ':did': deck_id, // integer not null,
    ':ord': 0, // integer not null,
    ':mod': new Date().getTime() / 1000 | 0, // integer not null,
    ':usn': -1, // integer not null,
    ':type': 0, // integer not null,
    ':queue': 0, // integer not null,
    ':due': 179, // integer not null,
    ':ivl': 0, // integer not null,
    ':factor': 0, // integer not null,
    ':reps': 0, // integer not null,
    ':lapses': 0, // integer not null,
    ':left': 0, // integer not null,
    ':odue': 0, // integer not null,
    ':odid': 0, // integer not null,
    ':flags': 0, // integer not null,
    ':data': '' // text not null
  });
};

export const getZip = (...args) => {
  const Zip = require('jszip');
  return new Zip(...args);
};

export const getSave = (zip, db, media) => (options = {}) => {
  const binaryArray = db.export();
  const mediaObj = media.reduce((prev, curr, idx) => {
    prev[idx] = curr.filename;
    return prev;
  }, {});

  zip.file('collection.anki2', new Buffer(binaryArray));
  zip.file('media', JSON.stringify(mediaObj));

  media.forEach((item, i) => zip.file(i, item.data));

  if (process.env.APP_ENV === 'browser') {
    return zip.generateAsync(Object.assign({}, { type: 'blob' }, options));
  } else {
    return zip.generateAsync(Object.assign({}, { type: 'nodebuffer', base64: false, compression: 'DEFLATE' }, options));
  }
};
