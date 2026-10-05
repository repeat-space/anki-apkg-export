import initSqlJs from 'sql.js';
import type { SqlJsStatic } from 'sql.js';
import { Exporter } from './exporter.js';
import type { ExportOptions } from './types.js';

let defaultSql: Promise<SqlJsStatic> | undefined;

export default class AnkiExport extends Exporter {
  private constructor(deckName: string, options: ExportOptions & { sql: SqlJsStatic }) {
    super(deckName, options);
  }

  static async create(deckName: string, options: ExportOptions = {}): Promise<AnkiExport> {
    const sql =
      options.sql ??
      (await (options.locateFile
        ? initSqlJs({ locateFile: options.locateFile })
        : (defaultSql ??= initSqlJs().catch((error) => {
            defaultSql = undefined;
            throw error;
          }))));
    return new AnkiExport(deckName, { ...options, sql });
  }
}

export { AnkiExport, Exporter };
export type {
  ExportOptions,
  TemplateOptions,
  CardOptions,
  CardInput,
  MediaData,
  SaveOutput,
} from './types.js';
