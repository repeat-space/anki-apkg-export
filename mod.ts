import type { InputFormats, JSZip, SqlJsStatic } from "./deps.ts";
import { sha1 } from "./hash.ts";
import * as Schema from "./schema.ts";

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

export interface Deck {
  /** deck ID */
  id: number;
  updated?: number;
  name: string;
  description?: string;
}

export interface Note {
  guid?: string;
  /** note ID */
  id: number;
  updated?: number;
  tags?: string[];
  fields: string[];
}

export interface NoteType {
  name: string;
  /** note type ID */
  id: number;

  updated?: number;

  /** @default 1 */
  deckId?: number;

  fields: Field[] | string[];
  templates: Template[];
  latex?: [string, string];
  css?: string;
  isCloze?: boolean;
  notes: Note[];
}

export interface Field {
  name: string;
  rtl?: boolean;
  font?: string;
  fontSize?: number;
}

export interface Template {
  name: string;
  question: string;
  answer: string;
  example?: [string, string];
}

export interface CollectionInit {
  decks: Deck[];
  models: NoteType[];
}

export const makeCollection = async (
  init: CollectionInit,
  sql: Pick<SqlJsStatic, "Database">,
): Promise<Uint8Array> => {
  const db = new sql.Database();

  const conf: Schema.Conf = {
    activeDecks: [1],
    addToCur: true,
    collapseTime: 1200,
    curDeck: 1,
    curModel: "1435645724216",
    dueCounts: true,
    estTimes: true,
    newBury: true,
    newSpread: 0,
    nextPos: 1,
    sortBackwards: false,
    sortType: "noteFld",
    timeLim: 0,
  };

  const models: Record<number, Schema.Model> = {};
  const notes: Record<number, Schema.Note> = {};
  const cards: Record<number, Schema.Card> = {};
  {
    const modelIdGen = makeIdGenerator();
    const noteIdGen = makeIdGenerator();
    const cardIdGen = makeIdGenerator();
    for (const { notes: notes_, ...noteType } of init.models) {
      const model = makeNoteType(noteType, modelIdGen);
      models[model.id] = model;
      for (const note of notes_) {
        const noteScheme = await makeNote(note, noteType.id, noteIdGen);
        notes[noteScheme.id] = noteScheme;
        for (
          const card of makeCards(
            noteType,
            noteScheme.id,
            note.fields,
            cardIdGen,
          )
        ) {
          cards[card.id] = card;
        }
      }
    }
  }

  const deckIdGen = makeIdGenerator();
  deckIdGen(1);
  const decks: Record<number, Schema.Deck> = {
    1: {
      collapsed: false,
      conf: 1,
      desc: "",
      dyn: 0,
      extendNew: 10,
      extendRev: 50,
      id: 1,
      lrnToday: [0, 0],
      mod: 0,
      name: "Default",
      newToday: [0, 0],
      revToday: [0, 0],
      timeToday: [0, 0],
      usn: 0,
    },
    ...Object.fromEntries(
      init.decks.map((deck) => {
        const d = makeDeck(deck, deckIdGen);
        return [d.id, d];
      }),
    ),
  };

  const dconf: Record<number, Schema.DConf> = {
    1: {
      autoplay: true,
      id: 1,
      lapse: {
        delays: [10],
        leechAction: 0,
        leechFails: 8,
        minInt: 1,
        mult: 0,
      },
      maxTaken: 60,
      mod: 0,
      name: "Default",
      new: {
        bury: true,
        delays: [1, 10],
        initialFactor: 2500,
        ints: [1, 4, 7],
        order: 1,
        perDay: 20,
        separate: true,
      },
      replayq: true,
      rev: {
        bury: true,
        ease4: 1.3,
        fuzz: 0.05,
        ivlFct: 1,
        maxIvl: 36500,
        minSpace: 1,
        perDay: 100,
      },
      timer: 0,
      usn: 0,
    },
  };

  const template = `
    PRAGMA foreign_keys=OFF;
    BEGIN TRANSACTION;
    CREATE TABLE col (
        id              integer primary key,
        crt             integer not null,
        mod             integer not null,
        scm             integer not null,
        ver             integer not null,
        dty             integer not null,
        usn             integer not null,
        ls              integer not null,
        conf            text not null,
        models          text not null,
        decks           text not null,
        dconf           text not null,
        tags            text not null
    );
    INSERT INTO "col" VALUES(
      1,
      1388548800,
      1435645724219,
      1435645724215,
      11,
      0,
      0,
      0,
      '${JSON.stringify(conf)}',
      '${JSON.stringify(models)}',
      '${JSON.stringify(decks)}',
      '${JSON.stringify(dconf)}',
      '{}'
    );
    CREATE TABLE notes (
        id              integer primary key,   /* 0 */
        guid            text not null,         /* 1 */
        mid             integer not null,      /* 2 */
        mod             integer not null,      /* 3 */
        usn             integer not null,      /* 4 */
        tags            text not null,         /* 5 */
        flds            text not null,         /* 6 */
        sfld            integer not null,      /* 7 */
        csum            integer not null,      /* 8 */
        flags           integer not null,      /* 9 */
        data            text not null          /* 10 */
    );
    CREATE TABLE cards (
        id              integer primary key,   /* 0 */
        nid             integer not null,      /* 1 */
        did             integer not null,      /* 2 */
        ord             integer not null,      /* 3 */
        mod             integer not null,      /* 4 */
        usn             integer not null,      /* 5 */
        type            integer not null,      /* 6 */
        queue           integer not null,      /* 7 */
        due             integer not null,      /* 8 */
        ivl             integer not null,      /* 9 */
        factor          integer not null,      /* 10 */
        reps            integer not null,      /* 11 */
        lapses          integer not null,      /* 12 */
        left            integer not null,      /* 13 */
        odue            integer not null,      /* 14 */
        odid            integer not null,      /* 15 */
        flags           integer not null,      /* 16 */
        data            text not null          /* 17 */
    );
    CREATE TABLE revlog (
        id              integer primary key,
        cid             integer not null,
        usn             integer not null,
        ease            integer not null,
        ivl             integer not null,
        lastIvl         integer not null,
        factor          integer not null,
        time            integer not null,
        type            integer not null
    );
    CREATE TABLE graves (
        usn             integer not null,
        oid             integer not null,
        type            integer not null
    );
    ANALYZE sqlite_master;
    INSERT INTO "sqlite_stat1" VALUES('col',NULL,'1');
    CREATE INDEX ix_notes_usn on notes (usn);
    CREATE INDEX ix_cards_usn on cards (usn);
    CREATE INDEX ix_revlog_usn on revlog (usn);
    CREATE INDEX ix_cards_nid on cards (nid);
    CREATE INDEX ix_cards_sched on cards (did, queue, due);
    CREATE INDEX ix_revlog_cid on revlog (cid);
    CREATE INDEX ix_notes_csum on notes (csum);
    COMMIT;
  `;

  db.run(template);

  const noteStmt = db.prepare(
    "insert or replace into notes values(:id,:guid,:mid,:mod,:usn,:tags,:flds,:sfld,:csum,:flags,:data)",
  );
  for (const note of Object.values(notes)) {
    noteStmt.run(
      Object.fromEntries(
        [...Object.entries(note)].map((
          [key, value],
        ) => [`:${key}`, value]),
      ),
    );
  }
  const cardStmt = db.prepare(
    "insert or replace into cards values(:id,:nid,:did,:ord,:mod,:usn,:type,:queue,:due,:ivl,:factor,:reps,:lapses,:left,:odue,:odid,:flags,:data)",
  );
  for (
    const card of Object.values(cards)
  ) {
    cardStmt.run(
      Object.fromEntries(
        [...Object.entries(card)].map((
          [key, value],
        ) => [`:${key}`, value]),
      ),
    );
  }

  return db.export();
};

export const makePackage = (
  ankiDB: Uint8Array,
  media: Record<string, InputFormats> | Map<string, InputFormats>,
  zip: JSZip,
  options?: Omit<JSZip.JSZipGeneratorOptions<"blob">, "type">,
): Promise<Blob> => {
  zip.file("collection.anki2", ankiDB);

  const entries = [
    ...(media instanceof Map ? media.entries() : Object.entries(media)),
  ];

  const filenameMap: Record<number, string> = Object.fromEntries(
    entries.map(([filename], index) => [index, filename]),
  );
  zip.file("media", JSON.stringify(filenameMap));

  entries.forEach(([, data], index) => zip.file(`${index}`, data));

  return zip.generateAsync({ type: "blob", ...options });
};

const separator = "\u001F";
const makeNote = async (
  note: Note,
  modelId: number,
  idGen: IdGen,
): Promise<Schema.Note> => {
  const flds = note.fields.join(separator);

  return {
    id: idGen(note.id),
    guid: note.guid ?? await sha1(flds),
    tags: note.tags?.map?.((tag) => tag.replaceAll(" ", "_"))?.join?.(" ") ??
      "",
    mid: modelId,
    mod: note.updated ?? note.id,
    flds,
    sfld: flds,
    usn: -1,
    flags: 0,
    data: "",
    csum: 0, // can be ignore
  };
};

const makeCards = (
  noteType: Omit<NoteType, "notes">,
  noteId: number,
  fields: string[],
  idGen: IdGen,
): Schema.Card[] =>
  noteType.isCloze
    ? makeClozeCards(noteType, noteId, fields, idGen)
    : makeNormalCards(noteType, noteId, fields, idGen);

const makeNormalCards = (
  noteType: Omit<NoteType, "notes">,
  noteId: number,
  fields: string[],
  idGen: IdGen,
): Schema.Card[] => {
  const fieldNames = noteType.fields.map((field) =>
    typeof field === "string" ? field : field.name
  );

  return noteType.templates.flatMap((template, ord) => {
    for (
      const [, fieldName] of template.question.matchAll(
        /{{(?:type\:|hint\:|#|\/)?([^}]+)}}/g,
      )
    ) {
      const index = fieldNames.indexOf(fieldName);
      if (index < 0) continue;
      if (!fields[index]) return [];
    }

    return [makeCard({
      ord,
      noteId,
      deckId: noteType.deckId ?? 1,
      created: noteId,
    }, idGen)];
  });
};

const makeClozeCards = (
  noteType: Omit<NoteType, "notes">,
  noteId: number,
  fields: string[],
  idGen: IdGen,
): Schema.Card[] => {
  const qfmt = noteType.templates[0].question;
  const clozeReplacements = new Set(
    [
      ...qfmt.matchAll(/{{[^}]*?cloze:(?:[^}]?:)*(.+?)}}/g),
      ...qfmt.matchAll(/<%cloze:(.+?)%>/g),
    ].map((
      [_, fieldName],
    ) => fieldName),
  );

  const cardOrds = new Set(
    [...clozeReplacements].flatMap((fieldName) => {
      const fieldIndex = noteType.fields
        .findIndex((field) =>
          (typeof field === "string" ? field : field.name) === fieldName
        );
      const fieldValue = fieldIndex < 0 ? "" : fields[fieldIndex];
      const updates = [...fieldValue.matchAll(/{{c(\d+)::.+?}}/g)].map((
        [_, m],
      ) => parseInt(m)).flatMap((m) => m >= 1 ? [m - 1] : []);
      return updates;
    }),
  );

  if (cardOrds.size === 0) cardOrds.add(0);
  return [...cardOrds].map((cardOrd) =>
    makeCard({
      ord: cardOrd,
      noteId,
      deckId: noteType.deckId ?? 1,
      created: noteId,
    }, idGen)
  );
};

interface Card {
  ord: number;
  created: number;
  updated?: number;
  noteId: number;
  deckId: number;
}

const makeCard = (
  card: Card,
  idGen: IdGen,
): Schema.Card => ({
  ord: card.ord,
  id: idGen(card.created),
  nid: card.noteId,
  did: card.deckId,
  mod: card.updated ?? Math.round(card.created / 1000),
  usn: -1,
  type: 0,
  queue: 0,
  due: 0,
  ivl: 0,
  factor: 0,
  reps: 0,
  lapses: 0,
  left: 0,
  odue: 0,
  odid: 0,
  flags: 0,
  data: "",
});

const makeNoteType = (
  noteType: Omit<NoteType, "notes">,
  idGen: IdGen,
): Schema.Model => ({
  vers: [],
  name: noteType.name,
  tags: [],
  did: noteType.deckId ?? 1,
  usn: -1,
  req: [[0, "all", [0]]],
  flds: noteType.fields.map((field, index) => makeField(field, index)),
  sortf: 0,
  latexPre: noteType.latex?.[0] ??
    "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
  tmpls: noteType.templates.map((template, index) =>
    makeTemplage(template, index)
  ),
  latexPost: noteType.latex?.[1] ?? "\\end{document}",
  type: noteType.isCloze ? 1 : 0,
  id: idGen(noteType.id),
  css: noteType.css ??
    ".card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\nbackground-color: white;\n}\n",
  mod: noteType.updated ?? Math.round(noteType.id / 1000),
});

const makeField = (field: string | Field, ord: number): Schema.Field =>
  typeof field === "string"
    ? ({
      name: field,
      media: [],
      sticky: false,
      rtl: false,
      ord,
      font: "Arial",
      size: 20,
    })
    : ({
      name: field.name,
      media: [],
      sticky: false,
      rtl: field.rtl ?? false,
      ord,
      font: field.font ?? "Arial",
      size: field.fontSize ?? 20,
    });

const makeTemplage = (template: Template, ord: number): Schema.Template => ({
  name: template.name,
  ord,
  did: null,
  qfmt: template.question,
  bafmt: template.example?.[0] ?? "",
  afmt: template.answer,
  bqfmt: template.example?.[1] ?? "",
});

const makeDeck = (deck: Deck, idGen: IdGen): Schema.Deck => ({
  collapsed: false,
  conf: 1,
  desc: deck.description ?? "",
  dyn: 0,
  extendNew: 10,
  extendRev: 50,
  id: idGen(deck.id),
  lrnToday: [545, 0],
  mod: deck.updated ?? Math.round(deck.id / 1000),
  name: deck.name,
  newToday: [545, 0],
  revToday: [545, 0],
  timeToday: [545, 0],
  usn: -1,
});

type IdGen = (id: number) => number;
const makeIdGenerator = (): IdGen => {
  let counter = -1;
  return (id) => {
    if (counter < id) {
      counter = id;
      return id;
    }
    return ++counter;
  };
};
