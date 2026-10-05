import type { SqlJsConfig, SqlJsStatic } from 'sql.js';

export type MediaData = string | number[] | Uint8Array | ArrayBuffer | Blob | NodeJS.ReadableStream;

export interface SaveOutput {
  base64: string;
  string: string;
  text: string;
  binarystring: string;
  array: number[];
  uint8array: Uint8Array;
  arraybuffer: ArrayBuffer;
  blob: Blob;
  nodebuffer: Buffer;
}

export interface TemplateOptions {
  questionFormat?: string;
  answerFormat?: string;
  css?: string;
}

export interface ExportOptions extends TemplateOptions {
  deckId?: number;
  modelId?: number;
  kind?: 'basic' | 'reversed' | 'cloze';
  model?: ModelDefinition;
  /** Provide an initialized sql.js module, e.g. when managing WASM yourself. */
  sql?: SqlJsStatic;
  /** Location of sql-wasm.wasm. Required by most browser bundlers. */
  locateFile?: SqlJsConfig['locateFile'];
}

export interface CardOptions {
  /** Stable source key; keep it unchanged when editing a note. */
  noteId?: string | number;
  tags?: string | readonly string[];
  deck?: string;
  modelId?: number;
}

export interface CardInput extends CardOptions {
  front: string;
  back: string;
}

export interface CardTemplate {
  name: string;
  questionFormat: string;
  answerFormat: string;
  /** Generate this card only when all named fields are nonempty. Defaults to the first field. */
  requiredFields?: readonly string[];
}

export interface ModelDefinition {
  name: string;
  fields: readonly string[];
  templates: readonly CardTemplate[];
  id?: number;
  type?: 'basic' | 'cloze';
  css?: string;
  sortField?: string;
}

export type NoteFields = readonly string[] | Readonly<Record<string, string>>;

export interface NoteInput extends CardOptions {
  fields: NoteFields;
}
