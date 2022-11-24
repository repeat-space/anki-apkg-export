export { default as initSqlJs } from "https://esm.sh/sql.js@1.8.0";
export type {
  BindParams,
  Database,
  SqlJsStatic,
  SqlValue,
} from "https://esm.sh/sql.js@1.8.0";

interface InputByType {
  base64: string;
  string: string;
  text: string;
  binarystring: string;
  array: number[];
  uint8array: Uint8Array;
  arraybuffer: ArrayBuffer;
  blob: Blob;
  stream: NodeJS.ReadableStream;
}

export type InputFormats =
  | InputByType[keyof InputByType]
  | Promise<InputByType[keyof InputByType]>;
