import type { BindParams, Database, SqlJsStatic, SqlValue } from "./deps.ts";
import { JSZip, sha1 } from "./deps.ts";

export interface Init {
  template: string;
  sql: SqlJsStatic;
}

export interface Media {
  filename: string;
  data: JSZip.InputType;
}

const separator = "\u001F";

export default class {
  private db: Database;
  private zip = new JSZip();
  private media: Media[] = [];
  private topDeckId: number;
  private topModelId: number;

  constructor(public deckName: string, { template, sql }: Init) {
    this.db = new sql.Database();
    this.db.run(template);

    const now = Date.now();
    this.topDeckId = this._getId("cards", "did", now);
    this.topModelId = this._getId("notes", "mid", now);

    const decks = this._getInitialRowValue("col", "decks");
    const deck = getLastItem(decks);
    deck.name = this.deckName;
    deck.id = this.topDeckId;
    decks[`${this.topDeckId}`] = deck;
    this._update("update col set decks=:decks where id=1", {
      ":decks": JSON.stringify(decks),
    });

    const models = this._getInitialRowValue("col", "models");
    const model = getLastItem(models);
    model.name = this.deckName;
    model.did = this.topDeckId;
    model.id = this.topModelId;
    models[`${this.topModelId}`] = model;
    this._update("update col set models=:models where id=1", {
      ":models": JSON.stringify(models),
    });
  }

  save(
    options?: Omit<JSZip.JSZipGeneratorOptions<"blob">, "type">,
  ): Promise<Blob> {
    const binaryArray = this.db.export();
    const mediaObj = this.media.reduce((prev, curr, idx) => {
      prev[idx] = curr.filename;
      return prev;
    }, {} as Record<number, string>);

    this.zip.file("collection.anki2", binaryArray);
    this.zip.file("media", JSON.stringify(mediaObj));

    this.media.forEach((item, i) => this.zip.file(`${i}`, item.data));

    return this.zip.generateAsync({ type: "blob", ...options });
  }

  addMedia(filename: string, data: JSZip.InputType) {
    this.media.push({ filename, data });
  }

  addCard(
    front: string,
    back: string,
    { tags }: { tags?: string | string[] } = {},
  ) {
    const now = Date.now();
    const note_guid = this._getNoteGuid(this.topDeckId, front, back);
    const note_id = this._getNoteId(note_guid, now);

    const strTags = typeof tags === "string"
      ? tags
      : Array.isArray(tags)
      ? this._tagsToStr(tags)
      : "";

    this._update(
      "insert or replace into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)",
      {
        ":id": note_id, // integer primary key,
        ":guid": note_guid, // text not null,
        ":mid": this.topModelId, // integer not null,
        ":mod": this._getId("notes", "mod", now), // integer not null,
        ":usn": -1, // integer not null,
        ":tags": strTags, // text not null,
        ":flds": front + separator + back, // text not null,
        ":sfld": front, // integer not null,
        ":csum": this._checksum(front + separator + back), //integer not null,
        ":flags": 0, // integer not null,
        ":data": "", // text not null,
      },
    );

    return this._update(
      "insert or replace into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)",
      {
        ":id": this._getCardId(note_id, now), // integer primary key,
        ":nid": note_id, // integer not null,
        ":did": this.topDeckId, // integer not null,
        ":ord": 0, // integer not null,
        ":mod": this._getId("cards", "mod", now), // integer not null,
        ":usn": -1, // integer not null,
        ":type": 0, // integer not null,
        ":queue": 0, // integer not null,
        ":due": 179, // integer not null,
        ":ivl": 0, // integer not null,
        ":factor": 0, // integer not null,
        ":reps": 0, // integer not null,
        ":lapses": 0, // integer not null,
        ":left": 0, // integer not null,
        ":odue": 0, // integer not null,
        ":odid": 0, // integer not null,
        ":flags": 0, // integer not null,
        ":data": "", // text not null
      },
    );
  }

  private _update(query: string, obj?: BindParams) {
    this.db.prepare(query).getAsObject(obj);
  }

  private _getInitialRowValue(table: string, column = "id") {
    const query = `select ${column} from ${table}`;
    return this._getFirstVal(query);
  }

  private _checksum(str: string) {
    // @ts-ignore fix later
    return parseInt(sha1(str).substr(0, 8), 16);
  }

  private _getFirstVal(query: string) {
    const [firstValue] = this.db.exec(query)[0].values[0];
    return typeof firstValue === "string" ? JSON.parse(firstValue) : firstValue;
  }

  private _tagsToStr(tags: string[] = []) {
    return ` ${tags.map((tag) => tag.replaceAll(" ", "_")).join(" ")} `;
  }

  private _getId(table: string, col: string, ts: number) {
    const query =
      `SELECT ${col} from ${table} WHERE ${col} >= :ts ORDER BY ${col} DESC LIMIT 1`;
    const rowObj = this.db.prepare(query).getAsObject({ ":ts": ts });

    return rowObj[col] ? +(rowObj?.[col] ?? 0) + 1 : ts;
  }

  private _getNoteId(guid: string, ts: number) {
    const query =
      `SELECT id from notes WHERE guid = :guid ORDER BY id DESC LIMIT 1`;
    const rowObj = this.db.prepare(query).getAsObject({ ":guid": guid });

    return rowObj.id || this._getId("notes", "id", ts);
  }

  private _getNoteGuid(topDeckId: number, front: string, back: string) {
    return sha1(`${topDeckId}${front}${back}`) as string;
  }

  private _getCardId(note_id: SqlValue, ts: number) {
    const query =
      `SELECT id from cards WHERE nid = :note_id ORDER BY id DESC LIMIT 1`;
    const rowObj = this.db.prepare(query).getAsObject({ ":note_id": note_id });

    return rowObj.id || this._getId("cards", "id", ts);
  }
}

export const getLastItem = (obj: Record<string, unknown>) => {
  const keys = Object.keys(obj);
  const lastKey = keys[keys.length - 1];

  const item = obj[lastKey];
  delete obj[lastKey];

  return item;
};
