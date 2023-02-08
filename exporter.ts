import type {
  Database,
  InputFormats,
  ParamsObject,
  SqlJsStatic,
  SqlValue,
} from "./deps.ts";
import { checksum, sha1 } from "./hash.ts";
import { Card, Collection, Note } from "./types.ts";

export interface Init {
  template: string;
  sql: SqlJsStatic;
}

export interface Media {
  filename: string;
  data: InputFormats;
}

export interface Fields {
  front: string;
  back: string;
  tag?: string | string[];
}

export type TableName = "cards" | "col" | "notes";
export interface TableFieldMap {
  cards: keyof Card;
  col: keyof Collection;
  notes: keyof Note;
}

const separator = "\u001F";

export type AnkiPkg = {
  "collection.anki2": Uint8Array;
  media: Record<number, string>;
} & Record<number, InputFormats>;

export default class {
  private db: Database;
  private media: Media[] = [];
  private topDeckId: number;
  private topModelId: number;

  constructor(public deckName: string, { template, sql }: Init) {
    this.db = new sql.Database();
    this.db.run(template);

    const now = Date.now();
    this.topDeckId = this.getId("cards", "did", now);
    this.topModelId = this.getId("notes", "mid", now);

    const decks = this.getFromCollection("decks");
    const deck = getLastItem(decks);
    deck.name = this.deckName;
    deck.id = this.topDeckId;
    decks[`${this.topDeckId}`] = deck;

    const models = this.getFromCollection("models");
    const model = getLastItem(models);
    model.name = this.deckName;
    model.did = this.topDeckId;
    model.id = this.topModelId;
    models[`${this.topModelId}`] = model;

    this.setCollection({ decks, models });
  }

  save(): AnkiPkg {
    const collection = this.db.export();

    const media: Record<number, string> = {};
    const mediaList: Record<number, InputFormats> = {};

    this.media.forEach((item, i) => {
      media[i] = item.filename;
      mediaList[i] = item.data;
    });

    return { "collection.anki2": collection, media, ...mediaList };
  }

  addMedia(filename: string, data: InputFormats) {
    this.media.push({ filename, data });
  }

  async addCard(
    front: string,
    back: string,
    { tags }: { tags?: string | string[] } = {},
  ) {
    const now = Date.now();
    const note_guid = await getNoteGuid(this.topDeckId, front, back);
    const note_id = this._getNoteId(note_guid, now);

    this.db.run(
      "insert or replace into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)",
      {
        ":id": note_id, // integer primary key,
        ":guid": note_guid, // text not null,
        ":mid": this.topModelId, // integer not null,
        ":mod": this.getId("notes", "mod", now), // integer not null,
        ":usn": -1, // integer not null,
        ":tags": tagToStr(tags), // text not null,
        ":flds": front + separator + back, // text not null,
        ":sfld": front, // integer not null,
        ":csum": await checksum(front + separator + back), //integer not null,
        ":flags": 0, // integer not null,
        ":data": "", // text not null,
      },
    );

    this.db.run(
      "insert or replace into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)",
      {
        ":id": this._getCardId(note_id, now), // integer primary key,
        ":nid": note_id, // integer not null,
        ":did": this.topDeckId, // integer not null,
        ":ord": 0, // integer not null,
        ":mod": this.getId("cards", "mod", now), // integer not null,
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

  private getFromCollection<Column extends keyof Collection>(
    column: Column,
  ): Collection[Column] {
    const query = `select ${column} from col`;
    const [firstValue] = this.db.exec(query)[0].values[0];
    return typeof firstValue === "string" ? JSON.parse(firstValue) : firstValue;
  }

  private setCollection(collection: Partial<Collection>) {
    const updaters: `${string}=:${string}`[] = [];
    const params: ParamsObject = {};
    for (const [key, value] of Object.entries(collection)) {
      if (value === undefined) continue;
      updaters.push(`${key}=:${key}`);
      params[`:${key}`] = typeof value === "object"
        ? JSON.stringify(value)
        : value;
    }
    if (updaters.length === 0) return;

    const query = `update col set ${updaters.join(", ")} where id=1`;

    this.db.run(query, params);
  }

  private getId<
    TName extends TableName,
    Column extends TableFieldMap[TName],
  >(table: TName, col: Column, ts: number) {
    const query =
      `SELECT ${col} from ${table} WHERE ${col} >= :ts ORDER BY ${col} DESC LIMIT 1`;
    const statement = this.db.prepare(query);
    const rowObj = statement.getAsObject({ ":ts": ts });
    statement.free();

    return rowObj[col] ? +(rowObj?.[col] ?? 0) + 1 : ts;
  }

  private _getNoteId(guid: string, ts: number) {
    const query =
      `SELECT id from notes WHERE guid = :guid ORDER BY id DESC LIMIT 1`;
    const statement = this.db.prepare(query);
    const rowObj = statement.getAsObject({ ":guid": guid });
    statement.free();

    return rowObj.id || this.getId("notes", "id", ts);
  }

  private _getCardId(note_id: SqlValue, ts: number) {
    const query =
      `SELECT id from cards WHERE nid = :note_id ORDER BY id DESC LIMIT 1`;
    const statement = this.db.prepare(query);
    const rowObj = statement.getAsObject({ ":note_id": note_id });
    statement.free();

    return rowObj.id || this.getId("cards", "id", ts);
  }
}

export const getLastItem = <T>(obj: Record<string, T>): T => {
  const keys = Object.keys(obj);
  const lastKey = keys[keys.length - 1];

  const item = obj[lastKey];
  delete obj[lastKey];

  return item;
};

const getNoteGuid = (topDeckId: number, front: string, back: string) =>
  sha1(`${topDeckId}${front}${back}`);

const tagToStr = (tags?: string | string[]) =>
  typeof tags === "string"
    ? tags
    : Array.isArray(tags)
    ? ` ${tags.map((tag) => tag.replaceAll(" ", "_")).join(" ")} `
    : "";
