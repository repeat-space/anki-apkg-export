import sha1 from 'sha1';
import Zip from 'jszip';

export class Exporter {
  constructor({ deckName, template, sql }) {
    this.db = new sql.Database();
    this.db.run(template);

    const now = Date.now();
    const topDeckId = this._getId('cards', 'did', now);
    const topModelId = this._getId('notes', 'mid', now);

    this.deckName = deckName;
    this.zip = new Zip();
    this.media = [];
    this.topDeckId = topDeckId;
    this.topModelId = topModelId;
    this.separator = '\u001F';

    const decks = this._getInitialRowValue('col', 'decks');
    const deck = getLastItem(decks);
    deck.name = this.deckName;
    deck.id = topDeckId;
    decks[topDeckId + ''] = deck;
    this._update('update col set decks=:decks where id=1', { ':decks': JSON.stringify(decks) });

    const models = this._getInitialRowValue('col', 'models');
    const model = getLastItem(models);
    model.name = this.deckName;
    model.did = this.topDeckId;
    model.id = topModelId;
    models[`${topModelId}`] = model;
    this._update('update col set models=:models where id=1', { ':models': JSON.stringify(models) });
  }

  save(options) {
    const { zip, db, media } = this;
    const binaryArray = db.export();
    const mediaObj = media.reduce((prev, curr, idx) => {
      prev[idx] = curr.filename;
      return prev;
    }, {});

    zip.file('collection.anki2', Buffer.from(binaryArray));
    zip.file('media', JSON.stringify(mediaObj));

    media.forEach((item, i) => zip.file(i, item.data));

    if (process.env.APP_ENV === 'browser' || typeof window !== 'undefined') {
      return zip.generateAsync(Object.assign({}, { type: 'blob' }, options));
    } else {
      return zip.generateAsync(
        Object.assign(
          {},
          {
            type: 'nodebuffer',
            base64: false,
            compression: 'DEFLATE'
          },
          options
        )
      );
    }
  }

  addMedia(filename, data) {
    this.media.push({ filename, data });
  }

  addCard(front, back, { tags } = {}) {
    const { topDeckId, topModelId, separator } = this;
    const now = Date.now();
    const note_guid = this._getNoteGuid(topDeckId, front, back);
    const note_id = this._getNoteId(note_guid, now);

    let strTags = '';
    if (typeof tags === 'string') {
      strTags = tags;
    } else if (Array.isArray(tags)) {
      strTags = this._tagsToStr(tags);
    }

    this._update('insert or replace into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)', {
      ':id': note_id, // integer primary key,
      ':guid': note_guid, // text not null,
      ':mid': topModelId, // integer not null,
      ':mod': this._getId('notes', 'mod', now), // integer not null,
      ':usn': -1, // integer not null,
      ':tags': strTags, // text not null,
      ':flds': front + separator + back, // text not null,
      ':sfld': front, // integer not null,
      ':csum': this._checksum(front + separator + back), //integer not null,
      ':flags': 0, // integer not null,
      ':data': '' // text not null,
    });

    return this._update(
      'insert or replace into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)',
      {
        ':id': this._getCardId(note_id, now), // integer primary key,
        ':nid': note_id, // integer not null,
        ':did': topDeckId, // integer not null,
        ':ord': 0, // integer not null,
        ':mod': this._getId('cards', 'mod', now), // integer not null,
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
      }
    );
  }

  _update(query, obj) {
    this.db.prepare(query).getAsObject(obj);
  }

  _getInitialRowValue(table, column = 'id') {
    const query = `select ${column} from ${table}`;
    return this._getFirstVal(query);
  }

  _checksum(str) {
    return parseInt(sha1(str).substr(0, 8), 16);
  }

  _getFirstVal(query) {
    return JSON.parse(this.db.exec(query)[0].values[0]);
  }

  _tagsToStr(tags = []) {
    return ' ' + tags.map(tag => tag.replace(/ /g, '_')).join(' ') + ' ';
  }

  _getId(table, col, ts) {
    const query = `SELECT ${col} from ${table} WHERE ${col} >= :ts ORDER BY ${col} DESC LIMIT 1`;
    const rowObj = this.db.prepare(query).getAsObject({ ':ts': ts });

    return rowObj[col] ? +rowObj[col] + 1 : ts;
  }

  _getNoteId(guid, ts) {
    const query = `SELECT id from notes WHERE guid = :guid ORDER BY id DESC LIMIT 1`;
    const rowObj = this.db.prepare(query).getAsObject({ ':guid': guid });

    return rowObj.id || this._getId('notes', 'id', ts);
  }

  _getNoteGuid(topDeckId, front, back) {
    return sha1(`${topDeckId}${front}${back}`);
  }

  _getCardId(note_id, ts) {
    const query = `SELECT id from cards WHERE nid = :note_id ORDER BY id DESC LIMIT 1`;
    const rowObj = this.db.prepare(query).getAsObject({ ':note_id': note_id });

    return rowObj.id || this._getId('cards', 'id', ts);
  }
}

export const getLastItem = obj => {
  const keys = Object.keys(obj);
  const lastKey = keys[keys.length - 1];

  const item = obj[lastKey];
  delete obj[lastKey];

  return item;
};
