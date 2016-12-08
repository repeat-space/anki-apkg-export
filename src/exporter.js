import {
  rand,
  checksum,
  getLastItem
} from './helpers';

export const SEPARATOR = '\u001F';

export const css = `.card {
    font-family: arial;
    font-size: 20px;
    text-align: center;
    color: black;
  }`;

export default class {
  constructor(deckName) {
    this.deckName = deckName;
    this.db = this._getDb();
    this.zip = this._getZip();
    this.media = [];
    this.topDeckId = rand();
    this.topModelId = rand();
    this.separator = SEPARATOR;
    this.css = css;

    return this
      .dbRun(this.getTemplate())
      .updateInitialDeck()
      .updateInitialModelWith();
  }

  save(options) {
    const { zip, db, media } = this;
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
  }

  addMedia(filename, data) {
    this.media.push({filename, data});
  }

  update(query, obj) {
    this.db.prepare(query).getAsObject(obj);
    return this;
  }

  addCard(front, back) {
    const { topDeckId, topModelId, separator } = this;
    const note_id = rand();

    this.update('insert into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)', {
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

    return this.update(`insert into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)`, {
      ':id': rand(), // integer primary key,
      ':nid': note_id, // integer not null,
      ':did': topDeckId, // integer not null,
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

  getInitialRowValue(table, column = 'id') {
    const query = `select ${column} from ${table}`;
    return this._getFirstVal(query);
  }

  updateInitialModelWith() {
    const id = this.topModelId;
    const models = this.getInitialRowValue('col', 'models');
    const model = getLastItem(models);
    model.name = this.deckName;
    model.css = this.css;
    model.did = this.topDeckId;
    model.id = id;
    models[id + ''] = model;
    return this.update('update col set models=:models where id=1', { ':models': JSON.stringify(models) });
  }

  getTemplate() {
    let template;
    if (process.env.APP_ENV === 'browser') {
      require('script!sql.js');
      template = require('!raw!./../templates/template.sql');
    } else {
      template = require('fs').readFileSync(__dirname + '/../templates/template.sql', 'utf-8');
    }
    return template;
  }

  updateInitialDeck() {
    const { topDeckId } = this;
    const decks = this.getInitialRowValue('col', 'decks');
    const deck = getLastItem(decks);
    deck.name = this.deckName;
    deck.id = topDeckId;
    decks[topDeckId + ''] = deck;
    return this.update('update col set decks=:decks where id=1', { ':decks': JSON.stringify(decks) });
  }

  _getFirstVal(query) {
    return JSON.parse(this.db.exec(query)[0].values[0]);
  }

  _getDb() {
    let sql;
    if (process.env.APP_ENV === 'browser') {
      require('script!sql.js');
      sql = window.SQL;
    } else {
      sql = require('sql.js');
    }
    return new sql.Database();
  }

  _getZip(...args) {
    const Zip = require('jszip');
    return new Zip(...args);
  }

  dbRun(...args) {
    this.db.run(...args);
    return this;
  }
}
