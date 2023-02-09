import { Deck, makeAnkiDB, makeApkg, Model } from "../mod.ts";
import { initSqlJs, JSZip } from "../deps.ts";
import {
  afterEach,
  assertEquals,
  beforeEach,
  DB,
  describe,
  it,
} from "./deps_test.ts";

const tmpDir = "./tmp";
const destUnpackedDb = `${tmpDir}/collection.anki2`;
const SEPARATOR = "\u001F";
const version = "1.8.0";
const sql = await initSqlJs({
  locateFile: (file) =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${version}/${file}`,
});

describe("Anki package", () => {
  beforeEach(async () => {
    try {
      await Deno.remove(tmpDir, { recursive: true });
    } catch (e: unknown) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
    await Deno.mkdir(tmpDir);
  });
  afterEach(async () => {
    try {
      await Deno.remove(tmpDir, { recursive: true });
    } catch (e: unknown) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  });

  const deck: Deck = {
    name: "deck-name",
    created: new Date().getTime(),
  };
  const model: Omit<Model, "notes"> = {
    name: "Basic",
    created: new Date().getTime(),
    fields: ["Front", "Back"],
    deckId: deck.created,
    templates: [{
      name: "Card 1",
      question: "{{Front}}",
      answer: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
    }],
  };

  it("check internal structure", async () => {
    const cards = [
      { front: "card #1 front", back: "card #1 back" },
      { front: "card #2 front", back: "card #2 back" },
      {
        front: 'card #3 with image <img src="anki.png" />',
        back: "card #3 back",
      },
    ];

    // Create deck as in previous example
    const id = new Date().getTime();
    const ankiDB = await makeAnkiDB(
      {
        decks: [deck],
        models: [{
          ...model,
          notes: cards.map(({ front, back }, index) => ({
            fields: [front, back],
            created: id + index,
          })),
        }],
      },
      sql,
    );

    const image = await Deno.readFile(
      new URL("./fixtures/anki.png", import.meta.url),
    );
    const apkg = await makeApkg(ankiDB, { "anki.png": image }, new JSZip());

    const unzip = new JSZip();
    await unzip.loadAsync(apkg);

    // analize media
    const imageRestored = await unzip.files["0"].async("uint8array");
    assertEquals(image, imageRestored);
    const mediaRestored = JSON.parse(await unzip.files.media.async("string"));
    assertEquals(mediaRestored, { 0: "anki.png" });

    // analize db via sqlite
    const ankiDBRestored = await unzip.files["collection.anki2"].async(
      "uint8array",
    );
    await Deno.writeFile(destUnpackedDb, ankiDBRestored);
    const db = new DB(destUnpackedDb, { mode: "read" });
    const result = db.queryEntries<{ flds: string }>(`SELECT
                                                                    notes.flds as flds
                                                                    from cards JOIN notes where cards.nid = notes.id ORDER BY cards.id`);
    db.close();

    // compare content from just created db with original list of cards
    const normilizedResult = result.map(({ flds }) => flds).sort()
      .map((flds) => flds.split(SEPARATOR)).map(([front, back]) => ({
        front,
        back,
      }));

    assertEquals(cards, normilizedResult);

    await Deno.writeFile(
      "./test1.apkg",
      new Uint8Array(await apkg.arrayBuffer()),
    );
  });

  it("check internal structure on adding card with tags", async () => {
    const cards: ([string, string, string[]] | [string, string])[] = [
      ["Card front side 1", "Card back side 1", [
        "some",
        "tag",
        "tags with multiple words",
      ]],
      [
        "Card front side 2",
        "Card back side 2",
        ["some_string_tags"],
      ],
      ["Card front side 3", "Card back side 3"],
    ];
    const id = new Date().getTime();
    const ankiDB = await makeAnkiDB(
      {
        decks: [deck],
        models: [{
          ...model,
          notes: cards.map(([front, back, tags], index) => ({
            fields: [front, back],
            tags,
            created: id + index,
          })),
        }],
      },
      sql,
    );

    const apkg = await makeApkg(ankiDB, {}, new JSZip());

    const unzip = new JSZip();
    await unzip.loadAsync(apkg);

    const ankiDBRestored = await unzip.files["collection.anki2"].async(
      "uint8array",
    );
    await Deno.writeFile(destUnpackedDb, ankiDBRestored);
    const db = new DB(destUnpackedDb, { mode: "read" });
    const results = db.queryEntries<
      { flds: string; tags: string }
    >(
      `SELECT
      notes.flds as flds,
      notes.tags as tags
      from cards JOIN notes where cards.nid = notes.id`,
    );
    db.close();

    assertEquals(results, [
      {
        flds: `${cards[0][0]}${SEPARATOR}${cards[0][1]}`,
        tags: `${cards[0][2]!.map((tag) => tag.replace(/ /g, "_")).join(" ")}`,
      },
      {
        flds: `${cards[1][0]}${SEPARATOR}${cards[1][1]}`,
        tags: cards[1][2]![0],
      },
      { flds: `${cards[2][0]}${SEPARATOR}${cards[2][1]}`, tags: "" },
    ]);

    await Deno.writeFile(
      "./test2.apkg",
      new Uint8Array(await apkg.arrayBuffer()),
    );
  });

  it("check a cloze note type", async () => {
    const model: Omit<Model, "notes"> = {
      name: "Basic",
      created: new Date().getTime(),
      fields: ["Front", "Hint"],
      deckId: deck.created,
      isCloze: true,
      templates: [{
        name: "Cloze",
        question: "{{cloze:Front}}",
        answer: '{{cloze:Front}}\n\n<hr id="answer">\n\n{{Hint}}',
      }],
    };
    const cards: ([string, string, string[]] | [string, string])[] = [
      ["Card {{c1::front}} side 1", "Cloze hint 1", [
        "some",
        "tag",
        "tags with multiple words",
      ]],
      [
        "{{c1::Card}} {{c1::front}} side {{c2::2}}",
        "Cloze hint 2",
        ["some_string_tags"],
      ],
      ["Card front side 3", "Card back side 3"],
    ];
    const id = new Date().getTime();
    const ankiDB = await makeAnkiDB(
      {
        decks: [deck],
        models: [{
          ...model,
          notes: cards.map(([front, back, tags], index) => ({
            fields: [front, back],
            tags,
            created: id + index,
          })),
        }],
      },
      sql,
    );

    const apkg = await makeApkg(ankiDB, {}, new JSZip());

    const unzip = new JSZip();
    await unzip.loadAsync(apkg);

    const ankiDBRestored = await unzip.files["collection.anki2"].async(
      "uint8array",
    );
    await Deno.writeFile(destUnpackedDb, ankiDBRestored);
    const db = new DB(destUnpackedDb, { mode: "read" });
    const results = db.queryEntries<
      { flds: string; tags: string; ord: number }
    >(
      `SELECT
      notes.flds as flds,
      notes.tags as tags,
      cards.ord as ord
      from cards JOIN notes where cards.nid = notes.id`,
    );
    db.close();

    assertEquals(results, [
      {
        flds: `${cards[0][0]}${SEPARATOR}${cards[0][1]}`,
        tags: `${cards[0][2]!.map((tag) => tag.replace(/ /g, "_")).join(" ")}`,
        ord: 0,
      },
      {
        flds: `${cards[1][0]}${SEPARATOR}${cards[1][1]}`,
        tags: cards[1][2]![0],
        ord: 0,
      },
      { flds: `${cards[2][0]}${SEPARATOR}${cards[2][1]}`, tags: "", ord: 0 },
      {
        flds: `${cards[1][0]}${SEPARATOR}${cards[1][1]}`,
        tags: cards[1][2]![0],
        ord: 1,
      },
    ]);

    await Deno.writeFile(
      "./test3.apkg",
      new Uint8Array(await apkg.arrayBuffer()),
    );
  });
});
