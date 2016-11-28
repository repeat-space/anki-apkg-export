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
};

const Zip = require('jszip');
const sha1 = require('sha1');

export const SEPARATOR = "\u001F";
const rand = () => Math.random() * 100000000 | 0;

function checksum(str) {
  return parseInt(sha1(str).substr(0, 8), 16);
};

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
    media.push({filename, data})
  }

  function addCard(front, back) {
    const deck_id = top_deck_id
    const note_id = rand();

    update('insert into notes values(:a1,:a2,:a3,:a4,:a5,:a6,:a7,:a8,:a9,:a10,:a11)', {
      ':a1': note_id,
      ':a2': rand().toString(36), // rand(10**10).to_s(36)
      ':a3': top_model_id,
      ':a4': new Date().getTime() / 1000 | 0,
      ':a5': -1,
      ':a6': '',
      ':a7': front + SEPARATOR + back,
      ':a8': front,
      ':a9': checksum(front + SEPARATOR + back),
      ':a10': 0,
      ':a11': ''
    });

    update('insert into cards values(:a1,:a2,:a3,:a4,:a5,:a6,:a7,:a8,:a9,:a10,:a11,:a12,:a13,:a14,:a15,:a16,:a17,:a18)', {
      ':a1': rand(),
      ':a2': note_id,
      ':a3': deck_id,
      ':a4': 0,
      ':a5': new Date().getTime() / 1000 | 0,
      ':a6': -1,
      ':a7': 0,
      ':a8': 0,
      ':a9': 179,
      ':a10': 0,
      ':a11': 0,
      ':a12': 0,
      ':a13': 0,
      ':a14': 0,
      ':a15': 0,
      ':a16': 0,
      ':a17': 0,
      ':a18': ''
    });
  };

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
  };

  return {
    addMedia,
    addCard,
    save
  };
};
