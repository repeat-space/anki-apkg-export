import Exporter from "./exporter.ts";
import { createTemplate, TemplateInit } from "./template.ts";
import type { SqlJsStatic } from "./deps.ts";

export { Exporter };
export type { SqlJsStatic, TemplateInit };

export interface Init {
  template?: TemplateInit;
  sql: SqlJsStatic;
}

const exporter = (deckName: string, init: Init) => {
  const { template, sql } = init;

  return new Exporter(deckName, {
    template: createTemplate(template),
    sql,
  });
};

export { exporter as default };
