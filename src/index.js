'use strict';

let sql = null;
let template = null;

if (process.env.APP_ENV === 'browser') {
  require('script!sql.js');
  sql = window.SQL;
  template = require('!raw!./../template.sql');
} else {
  sql = require('sql.js');
  template = require('fs').readFileSync(__dirname + '/../template.sql', 'utf-8');
}

const Zip = require('jszip');
const sha1 = require('sha1');

export const SEPARATOR = '\u001F';
const rand = () => Math.random() * 100000000 | 0;

function checksum(str) {
  return parseInt(sha1(str).substr(0, 8), 16);
}

export default function(deckName) {
  const options = {
    name: deckName,
    model_name: deckName,
    css: ` .card {
      font-family: arial;
      font-size: 20px;
      text-align: center;
      color: black;
    }`
  };

  const db = new sql.Database();
  db.run(template);

  const top_deck_id = rand();

  const getFirstVal = query => JSON.parse(db.exec(query)[0].values[0]);
  const decks = getFirstVal('select decks from col');

  const getLastItem = obj => {
    const keys = Object.keys(obj);
    const lastKey = keys[keys.length - 1];

    const item = obj[lastKey];
    delete obj[lastKey];

    return item;
  };

  const deck = getLastItem(decks);

  deck.name = options.name;
  deck.id = top_deck_id;

  decks[top_deck_id + ''] = deck;

  const update = (query, obj) => db.prepare(query).getAsObject(obj);

  update('update col set decks=:decks where id=1', { ':decks': JSON.stringify(decks) });
  // console.log(getFirstVal('select decks from col'));

  const top_model_id = rand();
  const models = getFirstVal('select models from col');
  const model = getLastItem(models);

  model.name = options.name;
  model.css = options.css;
  model.did = top_deck_id;
  model.id = top_model_id;

  models[top_model_id + ''] = model;

  update('update col set models=:models where id=1', { ':models': JSON.stringify(models) });
  // console.log(getFirstVal('select models from col'));

  const media = [];

  function addMedia(filename, data) {
    media.push({filename, data});
  }

  function addCard(front, back) {
    const deck_id = top_deck_id;
    const note_id = rand();

    update('insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)', {
      ':id': note_id, // integer primary key,
      ':guid': rand().toString(36), // rand(10**10).to_s(36) // text not null,
      ':mid': top_model_id, // integer not null,
      ':mod': new Date().getTime() / 1000 | 0, // integer not null,
      ':usn': -1, // integer not null,
      ':tags': '', // text not null,
      ':flds': front + SEPARATOR + back, // text not null,
      ':sfld': front, // integer not null,
      ':csum': checksum(front + SEPARATOR + back), //integertext not null,
      ':flags': 0, // integer not null,
      ':data': '' // text not null,
    });

    update(`insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)`, {
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
  }

  function save(options = {}) {
    const binaryArray = db.export();
    const zip = new Zip();
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
  }

  return {
    addMedia,
    addCard,
    save
  };
}
