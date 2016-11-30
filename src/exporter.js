import {
  rand,
  checksum,
  getLastItem
} from './helpers';
const EXPORTED_METHODS = ['save', 'addMedia', 'addCard', 'update'];
export const SEPARATOR = '\u001F';

export default class {
  constructor(db, zip) {
    this.db = db;
    this.zip = zip;
    this.media = [];
    this.topDeckId = rand();
    this.topModelId = rand();
    this.separator = SEPARATOR;

    EXPORTED_METHODS.forEach(methodName => this[methodName] = this[methodName].bind(this));
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

  updateInitialModelsWith({name, css, did, id}) {
    const models = this.getInitialRowValue('col', 'models');
    const model = getLastItem(models);
    model.name = name;
    model.css = css;
    model.did = did;
    model.id = id;
    models[id + ''] = model;
    return this.update('update col set models=:models where id=1', { ':models': JSON.stringify(models) });
  }

  updateInitialDecksWith({name, top_deck_id}) {
    const decks = this.getInitialRowValue('col', 'decks');
    const deck = getLastItem(decks);
    deck.name = name;
    deck.id = top_deck_id;
    decks[top_deck_id + ''] = deck;
    return this.update('update col set decks=:decks where id=1', { ':decks': JSON.stringify(decks) });
  }

  _getFirstVal(query) {
    return JSON.parse(this.db.exec(query)[0].values[0]);
  }
}
