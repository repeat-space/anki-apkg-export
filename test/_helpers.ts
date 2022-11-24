import { Exporter } from "../mod.ts";
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
