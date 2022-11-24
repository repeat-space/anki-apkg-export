import AnkiExport from "../../mod.ts";
import { initSqlJs } from "../../deps.ts";
import { JSZip } from "../deps.ts";

const version = "1.8.0";
const sql = await initSqlJs({
  locateFile: (file) =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/${version}/${file}`,
});
const apkg = AnkiExport("deck-name-node", { sql });

apkg.addMedia(
  "anki.png",
  Deno.readFile(new URL("../assets/anki.png", import.meta.url)),
);

await apkg.addCard("card #1 front", "card #1 back");
await apkg.addCard("card #2 front", "card #2 back");
await apkg.addCard('card #3 with image <img src="anki.png" />', "card #3 back");

try {
  const zip = new JSZip();
  const { "collection.anki2": collection, media, ...files } = apkg.save();
  for (const [key, value] of Object.entries(files)) {
    zip.file(key, value);
  }
  zip.file("collection.anki2", collection);
  zip.file("media", JSON.stringify(media));

  await Deno.writeFile(
    "./output.apkg",
    await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    }),
  );
  console.log(`Package has been generated: output.apkg`);
} catch (e: unknown) {
  console.error(e);
}
