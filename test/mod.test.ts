import AnkiExport from "../mod.ts";
import { initSqlJs } from "../deps.ts";
import { addCards, unzipDeckToDir } from "./_helpers.ts";
import {
  afterEach,
  assertEquals,
  beforeEach,
  DB,
  describe,
  it,
} from "./deps_test.ts";

const tmpDir = "./tmp";
const destUnpacked = `${tmpDir}/unpacked_result`;
const destUnpackedDb = `${destUnpacked}/collection.anki2`;
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

  it("check internal structure", async () => {
    // Create deck as in previous example
    const apkg = AnkiExport("deck-name", { sql });
    const cards = [
      { front: "card #1 front", back: "card #1 back" },
      { front: "card #2 front", back: "card #2 back" },
      {
        front: 'card #3 with image <img src="anki.png" />',
        back: "card #3 back",
      },
    ];
    await addCards(apkg, cards);
    const image = await Deno.readFile(
      new URL("./fixtures/anki.png", import.meta.url),
    );
    apkg.addMedia("anki.png", image);
    const zip = await apkg.save();
    const fileName = `${tmpDir}/result.apkg`;
    await Deno.writeFile(
      fileName,
      new Uint8Array(await zip.arrayBuffer()),
    );

    // extract dec to tmp directory
    await unzipDeckToDir(fileName, destUnpacked);

    // analize media
    const imageRestored = await Deno.readFile(`${destUnpacked}/0`);
    assertEquals(image, imageRestored);
    assertEquals(JSON.parse(await Deno.readTextFile(`${destUnpacked}/media`)), {
      "0": "anki.png",
    });

    // analize db via sqlite
    const db = new DB(destUnpackedDb, { mode: "read" });
    const result = db.queryEntries<{ front: string; back: string }>(`SELECT
                                                                    notes.sfld as front,
                                                                    notes.flds as back
                                                                    from cards JOIN notes where cards.nid = notes.id ORDER BY cards.id`);
    db.close();

    // compare content from just created db with original list of cards
    const normilizedResult = result.map(({ front, back }) => ({
      front,
      back: back.split(SEPARATOR).pop(),
    })).sort((a, b) => new Intl.Collator().compare(a.front, b.front));

    assertEquals(cards, normilizedResult);
  });

  it("check internal structure on adding card with tags", async () => {
    const decFile = `${tmpDir}/result_with_tags.apkg`;
    const unzipedDeck = `${destUnpacked}_with_tags`;
    const apkg = AnkiExport("deck-name", { sql });
    const [front1, back1, tags1] = ["Card front side 1", "Card back side 1", [
      "some",
      "tag",
      "tags with multiple words",
    ]];
    const [front2, back2, tags2] = [
      "Card front side 2",
      "Card back side 2",
      "some strin_tags",
    ];
    const [front3, back3] = ["Card front side 3", "Card back side 3"];
    await apkg.addCard(front1, back1, { tags: tags1 });
    await apkg.addCard(front2, back2, { tags: tags2 });
    await apkg.addCard(front3, back3);

    const zip = await apkg.save();
    await Deno.writeFile(
      decFile,
      new Uint8Array(await zip.arrayBuffer()),
    );

    await unzipDeckToDir(decFile, unzipedDeck);
    const db = new DB(`${unzipedDeck}/collection.anki2`);
    const results = db.queryEntries<
      { front: string; back: string; tags: string }
    >(
      `SELECT
      notes.sfld as front,
      notes.flds as back,
      notes.tags as tags
      from cards JOIN notes where cards.nid = notes.id ORDER BY front`,
    );
    db.close();

    assertEquals(results, [
      {
        front: front1,
        back: `${front1}${SEPARATOR}${back1}`,
        tags: ` ${tags1.map((tag) => tag.replace(/ /g, "_")).join(" ")} `,
      },
      { front: front2, back: `${front2}${SEPARATOR}${back2}`, tags: tags2 },
      { front: front3, back: `${front3}${SEPARATOR}${back3}`, tags: "" },
    ]);
  });
});
