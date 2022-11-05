import { Exporter } from "../mod.ts";
import { JSZip } from "../deps.ts";
import { join } from "./deps_test.ts";

export const addCards = async (
  apkg: Exporter,
  list: { front: string; back: string }[],
): Promise<void> => {
  // cannnot use Promise.all. It fails to add any cards except last one.
  for (const { front, back } of list) {
    await apkg.addCard(front, back);
  }
};

export const unzipDeckToDir = async (
  pathToDeck: string | URL,
  pathToUnzipTo: string | URL,
) => {
  await Deno.mkdir(pathToUnzipTo, { recursive: true });
  const zipContent = await Deno.readFile(pathToDeck);
  const zip = new JSZip();

  await zip.loadAsync(zipContent, { createFolders: true });

  await Promise.all(
    Object.values(zip.files).map(async (file) => {
      const filePath = join(pathToUnzipTo.toString(), file.name);
      await Deno.writeFile(filePath, await file.async("uint8array"));
    }),
  );
};
